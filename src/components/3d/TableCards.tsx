'use client';

import { Html } from '@react-three/drei';
import { useGameStore } from '@/lib/gameStore';

export default function TableCards() {
  const gameState = useGameStore(state => state.gameState);

  if (!gameState?.currentDeal) return null;

  const currentRound = gameState.currentDeal.rounds[gameState.currentDeal.currentRound];
  if (!currentRound) return null;

  // مواقع كروت الـ 4 لاعبين على الطاولة
  const cardPositions: [number, number, number][] = [
    [0, 0.78, 0.3],     // أنت (أقرب)
    [0.3, 0.78, 0],     // يمين
    [0, 0.78, -0.3],    // مقابل
    [-0.3, 0.78, 0],    // يسار
  ];

  return (
    <group>
      {currentRound.cardsPlayed.map((play, i) => {
        const pos = cardPositions[i];
        const card = play.card;

        return (
          <group key={i} position={pos} rotation={[-Math.PI / 2, 0, Math.random() * 0.3]}>
            <mesh castShadow>
              <boxGeometry args={[0.4, 0.56, 0.005]} />
              <meshStandardMaterial color="white" />
            </mesh>
            <Html position={[0, 0, 0.01]} center transform>
              <div
                className="text-xs font-bold select-none"
                style={{
                  color: card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black',
                  fontSize: '9px',
                  width: '35px',
                  textAlign: 'center',
                }}
              >
                {card.rank}
                {card.suit === 'hearts' ? '♥' :
                  card.suit === 'diamonds' ? '♦' :
                    card.suit === 'clubs' ? '♣' : '♠'}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}