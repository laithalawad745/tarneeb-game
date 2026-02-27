'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getPusherClient } from '@/lib/pusherClient';
import { useGameStore } from '@/lib/gameStore';
import { GameMode, PlayType } from '@/lib/types';
import { MODE_NAMES } from '@/lib/gameLogic';

// تحميل مكوّن Three.js بدون SSR
const Game3DScene = dynamic(() => import('@/components/Game3DScene'), { ssr: false });

export default function GamePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.id as string;
  const gameCode = searchParams.get('code') || '';

  const { gameState, setGameState, setMyPlayer } = useGameStore();
  const [phase, setPhase] = useState<string>('waiting');
  const [players, setPlayers] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [showTypeSelect, setShowTypeSelect] = useState(false);

  // تهيئة اللاعب
  useEffect(() => {
    const playerId = localStorage.getItem('playerId') || '';
    const playerName = localStorage.getItem('playerName') || '';
    setMyPlayer(playerId, playerName);
  }, [setMyPlayer]);

  // الاتصال بـ Pusher
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`game-${gameId}`);

    channel.bind('player-joined', (data: any) => {
      setPlayers(prev => [...prev, data]);
      setMessage(`${data.playerName} انضم للغرفة 🎉`);

      if (data.totalPlayers === 4) {
        setMessage('الغرفة اكتملت! جاهزين نبلش؟');
        // المضيف يختار نوع اللعب
        const hostId = localStorage.getItem('playerId');
        if (players.length === 0 || hostId === players[0]?.playerId) {
          setShowTypeSelect(true);
        }
      }
    });

    channel.bind('type-chosen', (data: any) => {
      setPhase('choosing_mode');
      setMessage(`نوع اللعب: ${data.playType === 'partnership' ? 'شراكة' : 'يهودي'}`);
      setShowTypeSelect(false);
      setShowModeSelect(true);
    });

    channel.bind('mode-chosen', (data: any) => {
      setPhase('playing');
      setShowModeSelect(false);
      setGameState(data.state);
      setMessage(`التسمية: ${MODE_NAMES[data.mode as GameMode]}`);
    });

    channel.bind('card-played', (data: any) => {
      setMessage(`لاعب لعب كرت`);
    });

    channel.bind('round-end', (data: any) => {
      setMessage(`اللمّة لـ ${data.winnerId}`);
    });

    channel.bind('deal-end', (data: any) => {
      setPhase('choosing_mode');
      setShowModeSelect(true);
      setMessage('البرتية خلصت! اختار التسمية الجاية');
    });

    channel.bind('cheat-steal', (data: any) => {
      // ما نعرض تفاصيل - بس نعرف إنو صار شي
    });

    channel.bind('cheat-revealed', (data: any) => {
      if (data.caught) {
        setMessage(`🚨 انكشف الغش! عقوبة: ${data.penalty} نقطة`);
      } else {
        setMessage(`✅ ما في غش - اتهام خاطئ`);
      }
    });

    channel.bind('pass', (data: any) => {
      setMessage(`لاعب قال باص`);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`game-${gameId}`);
    };
  }, [gameId, players, setGameState]);

  // إرسال أكشن للسيرفر
  const sendAction = useCallback(async (action: string, payload: any = {}) => {
    const playerId = localStorage.getItem('playerId');
    try {
      const res = await fetch('/api/game/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId, action, payload }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage(`❌ ${data.error}`);
      }
      if (data.state) {
        setGameState(data.state);
      }
    } catch (err) {
      setMessage('❌ خطأ بالاتصال');
    }
  }, [gameId, setGameState]);

  return (
    <div className="w-screen h-screen relative overflow-hidden">
      {/* مشهد Three.js ثلاثي الأبعاد */}
      <div className="game-canvas">
        <Game3DScene />
      </div>

      {/* واجهة المستخدم */}
      <div className="game-ui">
        {/* شريط علوي - كود الغرفة والرسائل */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
          <div className="player-badge text-center">
            <div className="text-xs text-gray-400">كود الغرفة</div>
            <div className="text-xl font-bold tracking-widest" style={{ color: '#d4a843', direction: 'ltr' }}>
              {gameCode}
            </div>
          </div>
        </div>

        {/* رسالة الحالة */}
        {message && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2">
            <div className="player-badge text-center animate-pulse">
              {message}
            </div>
          </div>
        )}

        {/* شاشة الانتظار */}
        {phase === 'waiting' && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
            <div className="player-badge space-y-2">
              <div className="text-lg">⏳ بانتظار اللاعبين...</div>
              <div className="text-3xl font-bold" style={{ color: '#d4a843' }}>
                {players.length + 1} / 4
              </div>
              <div className="text-sm text-gray-400">
                شارك الكود مع أصحابك
              </div>
            </div>
          </div>
        )}

        {/* اختيار نوع اللعب */}
        {showTypeSelect && (
          <div className="modal-overlay">
            <div className="modal-content text-center space-y-6">
              <h2 className="text-2xl font-bold" style={{ color: '#d4a843' }}>
                اختار نوع اللعب
              </h2>
              <div className="space-y-3">
                <button
                  onClick={() => sendAction('choose_type', { playType: 'partnership' })}
                  className="btn-game w-full"
                >
                  👥 شراكة (2 ضد 2)
                </button>
                <button
                  onClick={() => sendAction('choose_type', { playType: 'individual' })}
                  className="btn-game w-full"
                  style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)' }}
                >
                  🎯 يهودي (كل واحد لحاله)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* اختيار التسمية */}
        {showModeSelect && (
          <div className="modal-overlay">
            <div className="modal-content text-center space-y-6">
              <h2 className="text-2xl font-bold" style={{ color: '#d4a843' }}>
                اختار التسمية
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
                      style={!used ? undefined : { background: '#555' }}
                    >
                      {mode === 'queens' && '👸 بنات'}
                      {mode === 'diamonds' && '♦️ ديناري'}
                      {mode === 'tricks' && '🃏 لطش'}
                      {mode === 'tarneeb' && '💀 تركس'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* أزرار الغش والاتهام */}
        {phase === 'playing' && (
          <div className="absolute bottom-4 right-4 space-y-2">
            <button
              onClick={() => sendAction('steal_card')}
              className="btn-cheat block"
            >
              🫳 اسرق كرت
            </button>
            <button
              onClick={() => {/* فتح قائمة اللاعبين للاتهام */}}
              className="btn-cheat block"
              style={{ background: 'linear-gradient(135deg, #9333ea, #6b21a8)' }}
            >
              🔍 اتّهم بالغش
            </button>
          </div>
        )}

        {/* النقاط */}
        {gameState?.scores && Object.keys(gameState.scores).length > 0 && (
          <div className="absolute top-4 right-4">
            <div className="player-badge">
              <div className="text-xs text-gray-400 mb-1">النقاط</div>
              {Object.entries(gameState.scores).map(([pid, score]) => (
                <div key={pid} className="text-sm">
                  {gameState.players.find(p => p.id === pid)?.name}: {score}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
