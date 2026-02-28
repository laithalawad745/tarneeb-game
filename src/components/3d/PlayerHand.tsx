'use client';

import { Html } from '@react-three/drei';
import { useGameStore } from '@/lib/gameStore';

export default function PlayerHand() {
  const myHand = useGameStore(state => state.getMyHand());
  const selectedCard = useGameStore(state => state.selectedCard);
  const selectCard = useGameStore(state => state.selectCard);

  if (myHand.length === 0) return null;

  const cardWidth = 0.7;
  const totalWidth = myHand.length * cardWidth * 0.55;
  const startX = -totalWidth / 2;

  return (
    <group position={[0, 0.85, 1.3]}>
      {myHand.map((card, i) => {
        const isSelected = selectedCard?.id === card.id;
        const x = startX + i * cardWidth * 0.55;
        const y = isSelected ? 0.3 : 0;
        const rotZ = (i - myHand.length / 2) * 0.02;

        return (
          <group
            key={card.id}
            position={[x, y, 0]}
            rotation={[isSelected ? -0.2 : -0.4, 0, rotZ]}
            onClick={() => selectCard(isSelected ? null : card)}
          >
            <mesh castShadow>
              <boxGeometry args={[0.55, 0.8, 0.01]} />
              <meshStandardMaterial color="white" />
            </mesh>
            <Html position={[0, 0, 0.01]} center transform>
              <div
                className="text-xs font-bold select-none cursor-pointer"
                style={{
                  color: card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black',
                  fontSize: '10px',
                  width: '40px',
                  textAlign: 'center',
                }}
              >
                {card.rank}
                <br />
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