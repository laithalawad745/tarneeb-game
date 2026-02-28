'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createGame = async () => {
    if (!playerName.trim()) {
      setError('اكتب اسمك أول');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/game/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: playerName.trim() }),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      localStorage.setItem('playerId', data.playerId);
      localStorage.setItem('playerName', playerName.trim());
      localStorage.setItem('seatIndex', String(data.seatIndex));
      localStorage.setItem('isHost', 'true'); // ← المضيف

      router.push(`/game/${data.gameId}?code=${data.gameCode}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async () => {
    if (!playerName.trim()) {
      setError('اكتب اسمك أول');
      return;
    }
    if (!gameCode.trim()) {
      setError('اكتب كود الغرفة');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/game/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: playerName.trim(),
          gameCode: gameCode.trim().toUpperCase(),
        }),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      localStorage.setItem('playerId', data.playerId);
      localStorage.setItem('playerName', playerName.trim());
      localStorage.setItem('seatIndex', String(data.seatIndex));
      localStorage.setItem('isHost', 'false'); // ← مش مضيف

      router.push(`/game/${data.gameId}?code=${data.gameCode}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at center, #1a2a1a 0%, #0a0e17 100%)' }}>

      <div className="text-center space-y-8 p-8">
        {/* اللوغو */}
        <div className="space-y-2">
          <h1 className="text-6xl font-black" style={{ color: '#d4a843' }}>
            🃏 تركس
          </h1>
          <p className="text-xl text-gray-400">لعبة الشدة ثلاثية الأبعاد</p>
        </div>

        {/* القائمة الرئيسية */}
        {mode === 'menu' && (
          <div className="space-y-4">
            <button onClick={() => setMode('create')} className="btn-game w-64 block mx-auto">
              🎮 إنشاء غرفة جديدة
            </button>
            <button onClick={() => setMode('join')} className="btn-game w-64 block mx-auto"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
              🔗 انضمام لغرفة
            </button>
          </div>
        )}

        {/* إنشاء غرفة */}
        {mode === 'create' && (
          <div className="space-y-4 max-w-xs mx-auto">
            <input
              type="text"
              placeholder="اسمك..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="input-game w-full"
              maxLength={20}
            />
            <button onClick={createGame} className="btn-game w-full" disabled={loading}>
              {loading ? '⏳ جاري الإنشاء...' : '✨ أنشئ غرفة'}
            </button>
            <button onClick={() => setMode('menu')} className="text-gray-400 hover:text-white transition">
              ← رجوع
            </button>
          </div>
        )}

        {/* انضمام لغرفة */}
        {mode === 'join' && (
          <div className="space-y-4 max-w-xs mx-auto">
            <input
              type="text"
              placeholder="اسمك..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="input-game w-full"
              maxLength={20}
            />
            <input
              type="text"
              placeholder="كود الغرفة..."
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              className="input-game w-full tracking-widest"
              maxLength={6}
              style={{ direction: 'ltr', letterSpacing: '0.3em' }}
            />
            <button onClick={joinGame} className="btn-game w-full" disabled={loading}>
              {loading ? '⏳ جاري الانضمام...' : '🚀 انضم'}
            </button>
            <button onClick={() => setMode('menu')} className="text-gray-400 hover:text-white transition">
              ← رجوع
            </button>
          </div>
        )}

        {/* رسالة خطأ */}
        {error && (
          <div className="text-red-400 bg-red-900/20 px-4 py-2 rounded-lg">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}