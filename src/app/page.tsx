'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';

export default function Home() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isCreating = useRef(false);

  const createGame = async () => {
    if (!playerName.trim()) { setError('اكتب اسمك أول'); return; }
    if (isCreating.current) return;
    isCreating.current = true;
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

      storage.clear();
      storage.set('playerId',   data.playerId);
      storage.set('hostId',     data.hostId || data.playerId);
      storage.set('playerName', playerName.trim());
      storage.set('seatIndex',  String(data.seatIndex));
      storage.set('isHost',     'true');
      storage.set('hostGameId', data.gameId);

      const initialPlayers = [{ playerId: data.playerId, playerName: playerName.trim(), seatIndex: 0 }];
      storage.set('cachedPlayers', JSON.stringify(initialPlayers));

      router.push(`/game/${data.gameId}?code=${data.gameCode}`);
    } catch (err: any) {
      setError(err.message);
      isCreating.current = false;
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async () => {
    if (!playerName.trim()) { setError('اكتب اسمك أول'); return; }
    if (!gameCode.trim())   { setError('اكتب كود الغرفة'); return; }
    setLoading(true);
    setError('');

    try {
      storage.clear();

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

      storage.set('playerId',   data.playerId);
      storage.set('playerName', playerName.trim());
      storage.set('seatIndex',  String(data.seatIndex));
      storage.set('isHost',     'false');

      if (data.allPlayers) {
        storage.set('cachedPlayers', JSON.stringify(data.allPlayers));
      }

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
        <div className="space-y-2">
          <h1 className="text-6xl font-black" style={{ color: '#d4a843' }}>تركس</h1>
          <p className="text-xl text-gray-400">لعبة الشدة ثلاثية الأبعاد</p>
        </div>

        {mode === 'menu' && (
          <div className="space-y-4">
            <button onClick={() => setMode('create')} className="btn-game w-64 block mx-auto">
              إنشاء غرفة جديدة
            </button>
            <button onClick={() => setMode('join')} className="btn-game w-64 block mx-auto"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
              انضمام لغرفة
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-4 max-w-xs mx-auto">
            <input type="text" placeholder="اسمك..." value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createGame()}
              className="input-game w-full" maxLength={20} />
            <button onClick={createGame} className="btn-game w-full" disabled={loading}>
              {loading ? 'جاري الإنشاء...' : 'أنشئ غرفة'}
            </button>
            <button onClick={() => { setMode('menu'); setError(''); }}
              className="text-gray-400 hover:text-white transition">← رجوع</button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-4 max-w-xs mx-auto">
            <input type="text" placeholder="اسمك..." value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              className="input-game w-full" maxLength={20} />
            <input type="text" placeholder="كود الغرفة..." value={gameCode}
              onChange={e => setGameCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && joinGame()}
              className="input-game w-full tracking-widest" maxLength={6}
              style={{ direction: 'ltr', letterSpacing: '0.3em' }} />
            <button onClick={joinGame} className="btn-game w-full" disabled={loading}>
              {loading ? 'جاري الانضمام...' : 'انضم'}
            </button>
            <button onClick={() => { setMode('menu'); setError(''); }}
              className="text-gray-400 hover:text-white transition">← رجوع</button>
          </div>
        )}

        {error && (
          <div className="text-red-400 bg-red-900/20 px-4 py-2 rounded-lg">{error}</div>
        )}
      </div>
    </div>
  );
}