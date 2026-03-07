'use client';

import { useGameStore } from '@/lib/gameStore';
import Card3D from './Card3D';

export default function PlayerHand() {
  const myHand = useGameStore(state => state.getMyHand());
  const selectedCard = useGameStore(state => state.selectedCard);
  const selectCard = useGameStore(state => state.selectCard);

  if (myHand.length === 0) return null;

  const totalCards = myHand.length;
  const cardSpacing = 0.17;
  const totalWidth = (totalCards - 1) * cardSpacing;
  const startX = -totalWidth / 2 - 1.1;

  const baseY = 0.15;
  const baseZ = 1.2;

  return (
    <group>
      {myHand.map((card, i) => {
        const isSelected = selectedCard?.id === card.id;
        const x = startX + i * cardSpacing;

        return (
          <Card3D
            key={card.id}
            card={card}
            position={[x, baseY, baseZ]}
            rotation={[-0.4, Math.PI, 0]}
            scale={0.5}
            selected={isSelected}
            onClick={() => selectCard(isSelected ? null : card)}
            hoverable={true}
          />
        );
      })}
    </group>
  );
}