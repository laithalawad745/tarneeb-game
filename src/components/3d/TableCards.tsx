'use client';

import { useGameStore } from '@/lib/gameStore';
import Card3D from './Card3D';

export default function TableCards() {
  const gameState = useGameStore(state => state.gameState);
  const myPlayerId = useGameStore(state => state.myPlayerId);

  if (!gameState?.currentDeal) return null;

  const currentRound = gameState.currentDeal.rounds[gameState.currentDeal.currentRound];
  if (!currentRound) return null;

  // ====== مواقع الكروت الـ 4 على الطاولة ======
  // نحسب الموقع النسبي لكل لاعب بالنسبة لنا
  const myIndex = gameState.players.findIndex(p => p.id === myPlayerId) || 0;

  // مقعد 0 = أنت (أقرب)، 1 = يمين، 2 = مقابل، 3 = يسار
  const seatPositions: { pos: [number, number, number]; rot: [number, number, number] }[] = [
    { pos: [0, 0.78, 0.3],   rot: [-Math.PI / 2, 0, 0] },            // أنت
    { pos: [0.35, 0.78, 0],  rot: [-Math.PI / 2, 0, 0.3] },          // يمين
    { pos: [0, 0.78, -0.3],  rot: [-Math.PI / 2, 0, Math.PI] },      // مقابل
    { pos: [-0.35, 0.78, 0], rot: [-Math.PI / 2, 0, -0.3] },         // يسار
  ];

  return (
    <group>
      {currentRound.cardsPlayed.map((play, i) => {
        // حساب المقعد النسبي
        const playerIndex = gameState.players.findIndex(p => p.id === play.playerId);
        const relativeSeat = (playerIndex - myIndex + 4) % 4;
        const { pos, rot } = seatPositions[relativeSeat] || seatPositions[0];

        return (
          <Card3D
            key={`${play.card.id}-${i}`}
            card={play.card}
            position={pos}
            rotation={rot}
            scale={0.8}
            hoverable={false}
          />
        );
      })}
    </group>
  );
}