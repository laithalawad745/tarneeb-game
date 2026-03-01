'use client';

import { Html } from '@react-three/drei';
import { useGameStore } from '@/lib/gameStore';

export default function WonTricks() {
  const gameState = useGameStore(state => state.gameState);
  const myPlayerId = useGameStore(state => state.myPlayerId);

  if (!gameState?.currentDeal) return null;

  const myIndex = gameState.players.findIndex(p => p.id === myPlayerId) || 0;

  // أماكن اللمّات بالنسبة لموقعنا
  const positions: [number, number, number][] = [
    [0.6, 0.78, 0.8],    // أنت
    [0.8, 0.78, -0.6],   // يمين
    [-0.6, 0.78, -0.8],  // مقابل
    [-0.8, 0.78, 0.6],   // يسار
  ];

  return (
    <group>
      {gameState.players.map((player, playerIdx) => {
        if (player.tricksWon.length === 0) return null;
        const relativeSeat = (playerIdx - myIndex + 4) % 4;
        const pos = positions[relativeSeat];

        return (
          <group key={player.id} position={pos}>
            {/* كومة كروت مقلوبة */}
            {player.tricksWon.map((trick, trickIdx) => (
              <mesh
                key={trickIdx}
                position={[trickIdx * 0.08, trickIdx * 0.003, 0]}
                rotation={[-Math.PI / 2, 0, (trickIdx * 0.15)]}
              >
                <boxGeometry args={[0.2, 0.3, 0.005]} />
                <meshStandardMaterial color="#1a237e" />
              </mesh>
            ))}
            {/* عدد اللمّات */}
            <Html position={[0, 0.3, 0]} center>
              <div className="text-xs bg-black/70 px-2 py-0.5 rounded text-white font-bold">
                {player.tricksWon.length}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}