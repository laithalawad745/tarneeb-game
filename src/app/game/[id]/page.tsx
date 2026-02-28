'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getPusherClient } from '@/lib/pusherClient';
import { useGameStore } from '@/lib/gameStore';
import { GameMode, PlayType } from '@/lib/types';
import { MODE_NAMES } from '@/lib/gameLogic';

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

  // النوافذ المنبثقة
  const [showTypeSelect, setShowTypeSelect] = useState(false);
  const [showPartnerSelect, setShowPartnerSelect] = useState(false);
  const [showPartnerRequest, setShowPartnerRequest] = useState(false);
  const [showModeSelect, setShowModeSelect] = useState(false);

  // بيانات طلب الشراكة
  const [partnerRequestFrom, setPartnerRequestFrom] = useState<string>('');
  const [partnerRequestFromName, setPartnerRequestFromName] = useState<string>('');

  const [myId, setMyId] = useState('');
  const [isHost, setIsHost] = useState(false);

  // ============ تهيئة اللاعب ============
  useEffect(() => {
    const playerId = localStorage.getItem('playerId') || '';
    const playerName = localStorage.getItem('playerName') || '';
    const hostFlag = localStorage.getItem('isHost') === 'true';
    setMyPlayer(playerId, playerName);
    setMyId(playerId);
    setIsHost(hostFlag);
  }, [setMyPlayer]);

  // ============ الاتصال بـ Pusher ============
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`game-${gameId}`);

    // --- لاعب جديد انضم ---
    channel.bind('player-joined', (data: PlayerInfo & { totalPlayers: number }) => {
      setPlayers(prev => {
        if (prev.some(p => p.playerId === data.playerId)) return prev;
        return [...prev, { playerId: data.playerId, playerName: data.playerName, seatIndex: data.seatIndex }];
      });
      setMessage(`${data.playerName} انضم للغرفة 🎉`);

      // لما يكتمل 4 لاعبين — المضيف بس يشوف الاختيار
      if (data.totalPlayers === 4) {
        setPhase('full');
        setMessage('الغرفة اكتملت! ✅');
        const hostFlag = localStorage.getItem('isHost') === 'true';
        if (hostFlag) {
          setShowTypeSelect(true);
        } else {
          setMessage('المضيف يختار نوع اللعب...');
        }
      }
    });

    // --- نوع اللعب تم اختياره ---
    channel.bind('type-chosen', (data: { playType: PlayType; hostId: string }) => {
      setShowTypeSelect(false);

      if (data.playType === 'individual') {
        setMessage('نوع اللعب: يهودي 🎯 كل واحد لحاله');
        setPhase('choosing_mode');
        // المضيف بس يختار التسمية
        const hostFlag = localStorage.getItem('isHost') === 'true';
        if (hostFlag) {
          setShowModeSelect(true);
        } else {
          setMessage('المضيف يختار التسمية...');
        }
      } else {
        setMessage('نوع اللعب: شراكة 👥');
        // المضيف بس يشوف اختيار الشريك
        const hostFlag = localStorage.getItem('isHost') === 'true';
        if (hostFlag) {
          setShowPartnerSelect(true);
        } else {
          setMessage('المضيف يختار شريكه...');
        }
      }
    });

    // --- طلب شراكة وصل (للشريك المختار فقط) ---
    channel.bind('partner-request', (data: { hostId: string; hostName: string; partnerId: string }) => {
      const myPlayerId = localStorage.getItem('playerId');
      if (myPlayerId === data.partnerId) {
        // أنا الشريك المختار — أعرض قبول/رفض
        setPartnerRequestFrom(data.hostId);
        setPartnerRequestFromName(data.hostName);
        setShowPartnerRequest(true);
        setMessage(`${data.hostName} يبي يكون شريكك!`);
      } else if (myPlayerId !== data.hostId) {
        // أنا مش المضيف ولا الشريك — انتظر
        setMessage(`${data.hostName} يختار شريكه...`);
      }
    });

    // --- الشريك رفض ---
    channel.bind('partner-rejected', (data: { partnerId: string; partnerName: string }) => {
      setShowPartnerRequest(false);
      const hostFlag = localStorage.getItem('isHost') === 'true';
      if (hostFlag) {
        setMessage(`${data.partnerName} رفض الشراكة 😢 اختار غيره`);
        setShowPartnerSelect(true);
      } else {
        setMessage('الشريك رفض... المضيف يختار غيره');
      }
    });

    // --- الشريك وافق ---
    channel.bind('partner-accepted', (data: { hostId: string; partnerId: string; seating: PlayerInfo[] }) => {
      setShowPartnerSelect(false);
      setShowPartnerRequest(false);
      setPlayers(data.seating);

      const myPlayerId = localStorage.getItem('playerId');
      const partner = data.seating.find(p => p.playerId === data.partnerId);
      const host = data.seating.find(p => p.playerId === data.hostId);

      if (myPlayerId === data.hostId) {
        setMessage(`شريكك: ${partner?.playerName} 🤝`);
      } else if (myPlayerId === data.partnerId) {
        setMessage(`شريكك: ${host?.playerName} 🤝`);
      } else {
        setMessage(`${host?.playerName} و ${partner?.playerName} فريق 🤝`);
      }

      setTimeout(() => {
        setPhase('choosing_mode');
        const hostFlag = localStorage.getItem('isHost') === 'true';
        if (hostFlag) {
          setShowModeSelect(true);
        } else {
          setMessage('المضيف يختار التسمية...');
        }
      }, 2000);
    });

    // --- التسمية تم اختيارها ---
    channel.bind('mode-chosen', (data: any) => {
      setPhase('playing');
      setShowModeSelect(false);
      setGameState(data.state);
      setMessage(`التسمية: ${MODE_NAMES[data.mode as GameMode]}`);
    });

    // --- كرت انلعب ---
    channel.bind('card-played', (data: any) => {
      if (data.state) setGameState(data.state);
    });

    // --- نهاية الجولة ---
    channel.bind('round-end', (data: any) => {
      if (data.state) setGameState(data.state);
      const winner = players.find(p => p.playerId === data.winnerId);
      setMessage(`اللمّة لـ ${winner?.playerName || 'لاعب'} 🏆`);
    });

    // --- نهاية البرتية ---
    channel.bind('deal-end', (data: any) => {
      if (data.state) setGameState(data.state);
      setPhase('choosing_mode');
      const hostFlag = localStorage.getItem('isHost') === 'true';
      if (hostFlag) {
        setShowModeSelect(true);
      }
      setMessage('البرتية خلصت!');
    });

    // --- نهاية اللعبة ---
    channel.bind('game-end', (data: any) => {
      setPhase('game_end');
      setMessage('اللعبة خلصت! 🎉');
    });

    channel.bind('cheat-revealed', (data: any) => {
      setMessage(data.caught ? `🚨 انكشف الغش! عقوبة: ${data.penalty}` : '✅ اتهام خاطئ');
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`game-${gameId}`);
    };
  }, [gameId, setGameState]);

  // ============ إرسال أكشن ============
  const sendAction = useCallback(async (action: string, payload: any = {}) => {
    const playerId = localStorage.getItem('playerId');
    try {
      const res = await fetch('/api/game/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId, action, payload }),
      });
      const data = await res.json();
      if (data.error) setMessage(`❌ ${data.error}`);
      if (data.state) setGameState(data.state);
    } catch {
      setMessage('❌ خطأ بالاتصال');
    }
  }, [gameId, setGameState]);

  return (
    <div className="w-screen h-screen relative overflow-hidden">
      <div className="game-canvas">
        <Game3DScene />
      </div>

      <div className="game-ui">
        {/* كود الغرفة */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <div className="player-badge text-center">
            <div className="text-xs text-gray-400">كود الغرفة</div>
            <div className="text-xl font-bold tracking-widest" style={{ color: '#d4a843', direction: 'ltr' }}>
              {gameCode}
            </div>
          </div>
        </div>

        {/* رسالة */}
        {message && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2">
            <div className="player-badge text-center animate-pulse">{message}</div>
          </div>
        )}

        {/* ======== الانتظار ======== */}
        {phase === 'waiting' && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
            <div className="player-badge space-y-2">
              <div className="text-lg">⏳ بانتظار اللاعبين...</div>
              <div className="text-3xl font-bold" style={{ color: '#d4a843' }}>
                {players.length + 1} / 4
              </div>
              <div className="text-sm text-gray-400">شارك الكود مع أصحابك</div>
            </div>
          </div>
        )}

        {/* ======== اختيار نوع اللعب (المضيف فقط) ======== */}
        {showTypeSelect && (
          <div className="modal-overlay">
            <div className="modal-content text-center space-y-6">
              <h2 className="text-2xl font-bold" style={{ color: '#d4a843' }}>
                🎮 اختار نوع اللعب
              </h2>
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {players.map(p => (
                  <span key={p.playerId} className="px-3 py-1 rounded-full text-sm"
                    style={{ background: 'rgba(212,168,67,0.2)', color: '#d4a843' }}>
                    {p.playerName}
                  </span>
                ))}
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => sendAction('choose_type', { playType: 'individual' })}
                  className="btn-game w-full"
                >
                  🎯 يهودي — كل واحد لحاله
                </button>
                <button
                  onClick={() => sendAction('choose_type', { playType: 'partnership' })}
                  className="btn-game w-full"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white' }}
                >
                  👥 شراكة — 2 ضد 2
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======== اختيار الشريك (المضيف فقط) ======== */}
        {showPartnerSelect && (
          <div className="modal-overlay">
            <div className="modal-content text-center space-y-6">
              <h2 className="text-2xl font-bold" style={{ color: '#d4a843' }}>
                🤝 اختار شريكك
              </h2>
              <p className="text-gray-400 text-sm">شريكك راح يكون قبالك على الطاولة</p>
              <div className="space-y-3">
                {players
                  .filter(p => p.playerId !== myId)
                  .map(p => (
                    <button
                      key={p.playerId}
                      onClick={() => {
                        sendAction('request_partner', { partnerId: p.playerId });
                        setShowPartnerSelect(false);
                        setMessage(`بانتظار موافقة ${p.playerName}...`);
                      }}
                      className="btn-game w-full text-lg"
                      style={{
                        background: 'linear-gradient(135deg, rgba(212,168,67,0.3), rgba(212,168,67,0.1))',
                        border: '2px solid rgba(212,168,67,0.5)',
                        color: 'white',
                      }}
                    >
                      👤 {p.playerName}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ======== طلب شراكة (الشريك المختار فقط) ======== */}
        {showPartnerRequest && (
          <div className="modal-overlay">
            <div className="modal-content text-center space-y-6">
              <h2 className="text-2xl font-bold" style={{ color: '#d4a843' }}>
                🤝 طلب شراكة
              </h2>
              <p className="text-lg text-white">
                <span style={{ color: '#d4a843' }}>{partnerRequestFromName}</span> يبي يكون شريكك
              </p>
              <p className="text-gray-400 text-sm">رح تكونوا فريق واحد ضد الثنين الباقيين</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    sendAction('respond_partner', { hostId: partnerRequestFrom, accepted: true });
                    setShowPartnerRequest(false);
                    setMessage('وافقت على الشراكة! 🤝');
                  }}
                  className="btn-game flex-1 text-lg"
                  style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                >
                  ✅ موافق
                </button>
                <button
                  onClick={() => {
                    sendAction('respond_partner', { hostId: partnerRequestFrom, accepted: false });
                    setShowPartnerRequest(false);
                    setMessage('رفضت الشراكة');
                  }}
                  className="btn-game flex-1 text-lg"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                >
                  ❌ رفض
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======== اختيار التسمية (المضيف فقط) ======== */}
        {showModeSelect && (
          <div className="modal-overlay">
            <div className="modal-content text-center space-y-6">
              <h2 className="text-2xl font-bold" style={{ color: '#d4a843' }}>
                🎴 اختار التسمية
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {(['queens', 'diamonds', 'tricks', 'tarneeb'] as GameMode[]).map(mode => {
                  const used = gameState?.usedModes?.includes(mode);
                  return (
                    <button
                      key={mode}
                      onClick={() => !used && sendAction('choose_mode', { mode })}
                      disabled={used}
                      className={`btn-game ${used ? 'opacity-30 cursor-not-allowed' : ''}`}
                      style={!used ? {
                        background: mode === 'queens' ? 'linear-gradient(135deg, #ec4899, #be185d)' :
                          mode === 'diamonds' ? 'linear-gradient(135deg, #f59e0b, #d97706)' :
                            mode === 'tricks' ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' :
                              'linear-gradient(135deg, #ef4444, #991b1b)',
                        color: 'white',
                      } : undefined}
                    >
                      {mode === 'queens' && '👸 بنات'}
                      {mode === 'diamonds' && '💎 ديناري'}
                      {mode === 'tricks' && '🃏 لطش'}
                      {mode === 'tarneeb' && '💀 تركس'}
                      {used && ' ✓'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ======== زر لعب الكرت ======== */}
        {phase === 'playing' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
            {useGameStore.getState().selectedCard && useGameStore.getState().isMyTurn() && (
              <button
                onClick={() => {
                  const card = useGameStore.getState().selectedCard;
                  if (card) {
                    sendAction('play_card', { card });
                    useGameStore.getState().selectCard(null);
                  }
                }}
                className="btn-game"
              >
                🎴 العب الكرت
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}