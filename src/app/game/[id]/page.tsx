'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getPusherClient } from '@/lib/pusherClient';
import { useGameStore } from '@/lib/gameStore';
import { GameMode, PlayType } from '@/lib/types';
import { MODE_NAMES } from '@/lib/gameLogic';
import { storage } from '@/lib/storage';

const Game3DScene = dynamic(() => import('@/components/Game3DScene'), { ssr: false });

interface PlayerInfo {
  playerId: string;
  playerName: string;
  seatIndex: number;
}

export default function GamePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.id as string;
  const gameCode = searchParams.get('code') || '';

  const { gameState, setGameState, setMyPlayer } = useGameStore();

  const [phase, setPhase] = useState<string>('waiting');
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [message, setMessage] = useState('');

  const [showTypeSelect, setShowTypeSelect] = useState(false);
  const [showPartnerSelect, setShowPartnerSelect] = useState(false);
  const [showPartnerRequest, setShowPartnerRequest] = useState(false);
  const [showModeSelect, setShowModeSelect] = useState(false);

  const [partnerRequestFrom, setPartnerRequestFrom] = useState<string>('');
  const [partnerRequestFromName, setPartnerRequestFromName] = useState<string>('');

  const [myId, setMyId] = useState('');
  const [isHost, setIsHost] = useState(false);

  const hasFetched = useRef(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // ============ جلب بيانات اللعبة ============
  const fetchGameData = useCallback(async (reason: string) => {
    try {
      console.log(`[FETCH] ${reason}`);
      const res = await fetch(`/api/game/${gameId}`, { cache: 'no-store' });
      if (!res.ok) { console.error(`[FETCH] فشل! Status: ${res.status}`); return null; }

      const data = await res.json();
      console.log(`[FETCH] نجح! اللاعبين: ${data.players?.length}`,
        data.players?.map((p: any) => p.playerName).join(', '));

      if (data.players?.length > 0) setPlayers(data.players);
      if (data.state) setGameState(data.state);
      if (data.phase && data.phase !== 'waiting') setPhase(data.phase);

      return data;
    } catch (err) {
      console.error('[FETCH] خطأ:', err);
      return null;
    }
  }, [gameId, setGameState]);

  // ============ تهيئة اللاعب ============
  useEffect(() => {
    const playerId   = storage.get('playerId');
    const playerName = storage.get('playerName');
    const hostFlag   = storage.get('isHost') === 'true';
    const hostGameId = storage.get('hostGameId');

    if (hostFlag && hostGameId && hostGameId !== gameId) {
      console.warn(`[MISMATCH] hostGameId: ${hostGameId} | gameId: ${gameId}`);
      storage.set('isHost', 'false');
      setIsHost(false);
    } else {
      setIsHost(hostFlag);
    }

    setMyPlayer(playerId, playerName);
    setMyId(playerId);
    console.log(`[INIT] 1 أنا: ${playerId} | مضيف: ${hostFlag} | hostGameId: ${hostGameId} | gameId: ${gameId}`);

    const cached = storage.get('cachedPlayers');
    if (cached) {
      try {
        const cachedPlayers: PlayerInfo[] = JSON.parse(cached);
        console.log(`[INIT] 1 لاعبين مخزّنين: ${cachedPlayers.length}`);
        setPlayers(cachedPlayers);

        const initialState = {
          id: gameId,
          players: cachedPlayers.map(p => ({
            id: p.playerId, name: p.playerName, seatIndex: p.seatIndex,
            hand: [], tricksWon: [], score: 0,
            cheatAccusationsLeft: 2, hasCheated: false, stolenCard: null, isConnected: true,
          })),
          playType: 'individual' as PlayType,
          dealNumber: 0, phase: 'waiting' as const,
          scores: {}, chooserIndex: 0, usedModes: [],
          currentDeal: null, createdAt: new Date().toISOString(),
        };
        setGameState(initialState);
        storage.remove('cachedPlayers');
      } catch (e) {
        console.error('[INIT] خطأ بقراءة الكاش:', e);
      }
    }
  }, [setMyPlayer, gameId, setGameState]);

  // ============ Fetch + Polling ============
  const checkIfFull = useCallback((data: any) => {
    if (data?.players?.length >= 4 && (data?.phase === 'waiting' || data?.phase === 'full')) {
      setPhase('full');
      if (storage.get('isHost') === 'true') setShowTypeSelect(true);
      else setMessage('المضيف يختار نوع اللعب...');
    }
  }, []);

  useEffect(() => {
    if (hasFetched.current || !gameId) return;
    hasFetched.current = true;

    const initialTimeout = setTimeout(async () => {
      const data = await fetchGameData('تحميل أولي');
      checkIfFull(data);
    }, 1000);

    let pollCount = 0;
    pollingRef.current = setInterval(async () => {
      pollCount++;
      if (pollCount > 10) { clearInterval(pollingRef.current!); return; }
      const data = await fetchGameData(`polling #${pollCount}`);
      checkIfFull(data);
      if (data?.phase && data.phase !== 'waiting') clearInterval(pollingRef.current!);
    }, 3000);

    return () => {
      clearTimeout(initialTimeout);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [gameId, fetchGameData, checkIfFull]);

  // ============ تحديث gameState.players ============
  const syncGameStatePlayers = useCallback((playerList: PlayerInfo[]) => {
    const currentState = useGameStore.getState().gameState;
    if (!currentState) return;

    const updatedPlayers = playerList.map(p => {
      const existing = currentState.players.find(ep => ep.id === p.playerId);
      if (existing) return { ...existing, name: p.playerName, seatIndex: p.seatIndex };
      return {
        id: p.playerId, name: p.playerName, seatIndex: p.seatIndex,
        hand: [], tricksWon: [], score: 0,
        cheatAccusationsLeft: 2, hasCheated: false, stolenCard: null, isConnected: true,
      };
    });

    setGameState({ ...currentState, players: updatedPlayers });
  }, [setGameState]);

  // ============ Pusher ============
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`game-${gameId}`);
    console.log(`[PUSHER] اشتركت بقناة: game-${gameId}`);

    channel.bind('pusher:subscription_succeeded', () => console.log('[PUSHER] الاشتراك نجح!!'));

    channel.bind('player-joined', (data: any) => {
      console.log(`[PUSHER] player-joined: ${data.playerName}, total: ${data.totalPlayers}, allPlayers: ${data.allPlayers?.length}`);

      if (data.allPlayers?.length > 0) {
        setPlayers(data.allPlayers);
        syncGameStatePlayers(data.allPlayers);
      } else {
        setPlayers(prev => {
          if (prev.some(p => p.playerId === data.playerId)) return prev;
          return [...prev, { playerId: data.playerId, playerName: data.playerName, seatIndex: data.seatIndex }];
        });
      }

      setMessage(`${data.playerName} انضم للغرفة`);

      if (data.totalPlayers === 4) {
        setPhase('full');
        setMessage('الغرفة اكتملت!');
        if (storage.get('isHost') === 'true') setShowTypeSelect(true);
        else setMessage('المضيف يختار نوع اللعب...');
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    });

    channel.bind('type-chosen', (data: { playType: PlayType; hostId: string }) => {
      console.log('[PUSHER] type-chosen:', data.playType);
      setShowTypeSelect(false);
      if (data.playType === 'individual') {
        setMessage('نوع اللعب: يهودي — كل واحد لحاله');
        setPhase('choosing_mode');
        if (storage.get('isHost') === 'true') setShowModeSelect(true);
        else setMessage('المضيف يختار التسمية...');
      } else {
        setMessage('نوع اللعب: شراكة');
        if (storage.get('isHost') === 'true') setShowPartnerSelect(true);
        else setMessage('المضيف يختار شريكه...');
      }
    });

    channel.bind('partner-request', (data: { hostId: string; hostName: string; partnerId: string }) => {
      const myPlayerId = storage.get('playerId');
      if (myPlayerId === data.partnerId) {
        setPartnerRequestFrom(data.hostId);
        setPartnerRequestFromName(data.hostName);
        setShowPartnerRequest(true);
        setMessage(`${data.hostName} يبي يكون شريكك!`);
      } else if (myPlayerId !== data.hostId) {
        setMessage(`${data.hostName} يختار شريكه...`);
      }
    });

    channel.bind('partner-rejected', (data: { partnerId: string; partnerName: string }) => {
      setShowPartnerRequest(false);
      if (storage.get('isHost') === 'true') {
        setMessage(`${data.partnerName} رفض الشراكة — اختار غيره`);
        setShowPartnerSelect(true);
      } else {
        setMessage('الشريك رفض... المضيف يختار غيره');
      }
    });

    channel.bind('partner-accepted', (data: { hostId: string; partnerId: string; seating: PlayerInfo[] }) => {
      setShowPartnerSelect(false);
      setShowPartnerRequest(false);
      setPlayers(data.seating);
      const myPlayerId = storage.get('playerId');
      const partner = data.seating.find(p => p.playerId === data.partnerId);
      const host    = data.seating.find(p => p.playerId === data.hostId);
      if (myPlayerId === data.hostId)     setMessage(`شريكك: ${partner?.playerName}`);
      else if (myPlayerId === data.partnerId) setMessage(`شريكك: ${host?.playerName}`);
      else setMessage(`${host?.playerName} و ${partner?.playerName} فريق`);

      setTimeout(() => {
        setPhase('choosing_mode');
        if (storage.get('isHost') === 'true') setShowModeSelect(true);
        else setMessage('المضيف يختار التسمية...');
      }, 2000);
    });

    channel.bind('mode-chosen', (data: any) => {
      setPhase('playing');
      setShowModeSelect(false);
      setGameState(data.state);
      setMessage(`التسمية: ${MODE_NAMES[data.mode as GameMode]}`);
    });

    channel.bind('card-played', (data: any) => { if (data.state) setGameState(data.state); });
    channel.bind('round-end',   (data: any) => { if (data.state) setGameState(data.state); });

    channel.bind('deal-end', (data: any) => {
      if (data.state) setGameState(data.state);
      setPhase('choosing_mode');
      if (storage.get('isHost') === 'true') setShowModeSelect(true);
      setMessage('البرتية خلصت!');
    });

    channel.bind('game-end', () => { setPhase('game_end'); setMessage('اللعبة خلصت!'); });

    channel.bind('cheat-revealed', (data: any) => {
      setMessage(data.caught ? `انكشف الغش! عقوبة: ${data.penalty}` : 'اتهام خاطئ');
    });

    return () => { channel.unbind_all(); pusher.unsubscribe(`game-${gameId}`); };
  }, [gameId, setGameState, syncGameStatePlayers]);

  // ============ إرسال أكشن ============
  const sendAction = useCallback(async (action: string, payload: any = {}) => {
    const playerId = storage.get('playerId');
    console.log(`[ACTION] ${action}`, payload);
    try {
      const res = await fetch('/api/game/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId, action, payload }),
      });
      const data = await res.json();
      if (data.error) setMessage(`${data.error}`);
      if (data.state) setGameState(data.state);
    } catch {
      setMessage('خطأ بالاتصال');
    }
  }, [gameId, setGameState]);

  useEffect(() => {
    console.log(`[STATE] players: ${players.length}`, players.map(p => p.playerName).join(', '),
      `| gameState.players: ${gameState?.players?.length || 0}`, `| phase: ${phase}`);
  }, [players, gameState, phase]);

  // ============ UI ============
  return (
    <div className="w-screen h-screen relative overflow-hidden">
      <div className="game-canvas"><Game3DScene /></div>
      <div className="game-ui">

{players.length < 4 && (
  <div className="absolute top-4 left-1/2 -translate-x-1/2">
    <div className="player-badge text-center">
      <div className="text-xs text-gray-400">كود الغرفة</div>
      <div className="text-xl font-bold tracking-widest" style={{ color: '#d4a843', direction: 'ltr' }}>{gameCode}</div>
    </div>
  </div>
)}

  {message && (
  <div className="absolute top-4 left-1/2 -translate-x-1/2">
    <div className="player-badge text-center animate-pulse">{message}</div>
  </div>
)}

        {(phase === 'waiting' || phase === 'full') && !showTypeSelect && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
            <div className="player-badge space-y-2">
              <div className="text-lg">{players.length < 4 ? 'بانتظار اللاعبين...' : 'الغرفة جاهزة!'}</div>
              <div className="text-3xl font-bold" style={{ color: '#d4a843' }}>{players.length} / 4</div>
              {players.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {players.map(p => (
                    <span key={p.playerId} className="px-3 py-1 rounded-full text-xs"
                      style={{ background: 'rgba(212,168,67,0.2)', color: '#d4a843' }}>
                      {p.playerName} {p.playerId === myId ? '(أنت)' : ''}
                    </span>
                  ))}
                </div>
              )}
              {players.length >= 4 && isHost ? (
                <button onClick={() => setShowTypeSelect(true)}
                  className="btn-game w-full mt-3 text-lg" style={{ animation: 'pulse 2s infinite' }}>
                  ابدأ اللعبة
                </button>
              ) : players.length >= 4 ? (
                <div className="text-sm text-gray-400 mt-2">المضيف يبدأ اللعبة...</div>
              ) : (
                <div className="text-sm text-gray-400">شارك الكود مع أصحابك</div>
              )}
            </div>
          </div>
        )}

        {showTypeSelect && (
          <div className="modal-overlay">
            <div className="modal-content text-center space-y-6">
              <h2 className="text-2xl font-bold" style={{ color: '#d4a843' }}>اختار نوع اللعب</h2>
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {players.map(p => (
                  <span key={p.playerId} className="px-3 py-1 rounded-full text-sm"
                    style={{ background: 'rgba(212,168,67,0.2)', color: '#d4a843' }}>{p.playerName}</span>
                ))}
              </div>
              <div className="space-y-3">
                <button onClick={() => sendAction('choose_type', { playType: 'individual' })} className="btn-game w-full">
                  يهودي — كل واحد لحاله
                </button>
                <button onClick={() => sendAction('choose_type', { playType: 'partnership' })} className="btn-game w-full"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white' }}>
                  شراكة — 2 ضد 2
                </button>
              </div>
            </div>
          </div>
        )}

        {showPartnerSelect && (
          <div className="modal-overlay">
            <div className="modal-content text-center space-y-6">
              <h2 className="text-2xl font-bold" style={{ color: '#d4a843' }}>اختار شريكك</h2>
              <p className="text-gray-400 text-sm">شريكك راح يكون قبالك على الطاولة</p>
              <div className="space-y-3">
                {players.filter(p => p.playerId !== myId).map(p => (
                  <button key={p.playerId} onClick={() => {
                    sendAction('request_partner', { partnerId: p.playerId });
                    setShowPartnerSelect(false);
                    setMessage(`بانتظار موافقة ${p.playerName}...`);
                  }} className="btn-game w-full text-lg" style={{
                    background: 'linear-gradient(135deg, rgba(212,168,67,0.3), rgba(212,168,67,0.1))',
                    border: '2px solid rgba(212,168,67,0.5)', color: 'white',
                  }}>{p.playerName}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {showPartnerRequest && (
          <div className="modal-overlay">
            <div className="modal-content text-center space-y-6">
              <h2 className="text-2xl font-bold" style={{ color: '#d4a843' }}>طلب شراكة</h2>
              <p className="text-lg text-white">
                <span style={{ color: '#d4a843' }}>{partnerRequestFromName}</span> يبي يكون شريكك
              </p>
              <div className="flex gap-3">
                <button onClick={() => {
                  sendAction('respond_partner', { hostId: partnerRequestFrom, accepted: true });
                  setShowPartnerRequest(false);
                }} className="btn-game flex-1" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>موافق</button>
                <button onClick={() => {
                  sendAction('respond_partner', { hostId: partnerRequestFrom, accepted: false });
                  setShowPartnerRequest(false);
                }} className="btn-game flex-1" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>رفض</button>
              </div>
            </div>
          </div>
        )}

        {showModeSelect && (
          <div className="modal-overlay">
            <div className="modal-content text-center space-y-6">
              <h2 className="text-2xl font-bold" style={{ color: '#d4a843' }}>اختار التسمية</h2>
              <div className="grid grid-cols-2 gap-3">
                {(['queens', 'diamonds', 'tricks', 'tarneeb'] as GameMode[]).map(mode => {
                  const used = gameState?.usedModes?.includes(mode);
                  return (
                    <button key={mode} onClick={() => !used && sendAction('choose_mode', { mode })}
                      disabled={used}
                      className={`btn-game ${used ? 'opacity-30 cursor-not-allowed' : ''}`}
                      style={!used ? {
                        background:
                          mode === 'queens'   ? 'linear-gradient(135deg, #ec4899, #be185d)' :
                          mode === 'diamonds' ? 'linear-gradient(135deg, #f59e0b, #d97706)' :
                          mode === 'tricks'   ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' :
                                               'linear-gradient(135deg, #ef4444, #991b1b)',
                        color: 'white',
                      } : undefined}>
                      {mode === 'queens' && 'بنات'}{mode === 'diamonds' && 'ديناري'}
                      {mode === 'tricks' && 'لطش'}{mode === 'tarneeb' && 'تركس'}{used && ' ✓'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {phase === 'playing' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
            {useGameStore.getState().selectedCard && useGameStore.getState().isMyTurn() && (
              <button onClick={() => {
                const card = useGameStore.getState().selectedCard;
                if (card) { sendAction('play_card', { card }); useGameStore.getState().selectCard(null); }
              }} className="btn-game">العب الكرت</button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}