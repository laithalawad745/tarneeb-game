'use client';

import { Html } from '@react-three/drei';
import { useGameStore } from '@/lib/gameStore';

export default function WonTricks() {
  const gameState = useGameStore(state => state.gameState);

  if (!gameState) return null;

  // أماكن اللمّات (قريبة من كل لاعب)
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
        const pos = positions[playerIdx];

        return (
          <group key={player.id} position={pos}>
            {player.tricksWon.map((trick, trickIdx) => (
              <mesh
                key={trickIdx}
                position={[trickIdx * 0.12, trickIdx * 0.005, 0]}
                rotation={[-Math.PI / 2, 0, Math.random() * 0.2]}
              >
                <boxGeometry args={[0.3, 0.42, 0.01]} />
                <meshStandardMaterial color="#e8e0d0" />
              </mesh>
            ))}
            <Html position={[0, 0.3, 0]} center>
              <div className="text-xs bg-black/60 px-1 rounded">
                {player.tricksWon.length}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}