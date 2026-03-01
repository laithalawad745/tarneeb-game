'use client';

import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/lib/gameStore';

// ====== ظهر الكرت (مقلوب) ======
function CardBack({ position, rotation }: { 
  position: [number, number, number]; 
  rotation: [number, number, number]; 
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={[0.18, 0.27, 0.005]} />
      <meshStandardMaterial color="#1a237e" roughness={0.4} />
      {/* خط ذهبي على الظهر */}
      <mesh position={[0, 0, 0.003]}>
        <boxGeometry args={[0.14, 0.23, 0.001]} />
        <meshStandardMaterial 
          color="#1a237e" 
          roughness={0.3}
          emissive="#0d1442"
          emissiveIntensity={0.3}
        />
      </mesh>
    </mesh>
  );
}

export default function OpponentHands() {
  const gameState = useGameStore(state => state.gameState);
  const myPlayerId = useGameStore(state => state.myPlayerId);

  const opponentData = useMemo(() => {
    if (!gameState?.currentDeal || !myPlayerId) return [];

    const myIndex = gameState.players.findIndex(p => p.id === myPlayerId);
    if (myIndex === -1) return [];

    return gameState.players
      .filter(p => p.id !== myPlayerId)
      .map(p => {
        const relativeSeat = (p.seatIndex - myIndex + 4) % 4;
        return {
          id: p.id,
          name: p.name,
          cardCount: p.hand.length,
          relativeSeat,
        };
      });
  }, [gameState, myPlayerId]);

  if (opponentData.length === 0) return null;

  // ====== مواقع الأيدي حول الطاولة ======
  // مقعد 1 = يمين، مقعد 2 = مقابل، مقعد 3 = يسار
  const handConfigs: Record<number, {
    basePos: [number, number, number];
    cardDir: [number, number, number]; // اتجاه توزيع الكروت
    cardRot: [number, number, number]; // دوران الكرت
  }> = {
    1: { // يمين
      basePos: [0.95, 0.82, 0.35],
      cardDir: [0, 0, -0.06],      // يتوزعو عمودياً
      cardRot: [-Math.PI / 2, 0, Math.PI / 2],
    },
    2: { // مقابل
      basePos: [-0.35, 0.82, -0.75],
      cardDir: [0.06, 0, 0],        // يتوزعو أفقياً
      cardRot: [-Math.PI / 2, 0, Math.PI],
    },
    3: { // يسار
      basePos: [-0.95, 0.82, -0.35],
      cardDir: [0, 0, 0.06],        // يتوزعو عمودياً
      cardRot: [-Math.PI / 2, 0, -Math.PI / 2],
    },
  };

  return (
    <group>
      {opponentData.map(opp => {
        const config = handConfigs[opp.relativeSeat];
        if (!config || opp.cardCount === 0) return null;

        const { basePos, cardDir, cardRot } = config;

        // عرض الكروت المقلوبة كمروحة صغيرة
        const totalCards = opp.cardCount;
        const halfSpread = (totalCards - 1) / 2;

        return (
          <group key={opp.id}>
            {Array.from({ length: totalCards }).map((_, i) => {
              const offset = (i - halfSpread);
              const pos: [number, number, number] = [
                basePos[0] + cardDir[0] * offset,
                basePos[1] + i * 0.002, // كل كرت أعلى بشوي (تكديس)
                basePos[2] + cardDir[2] * offset,
              ];

              return (
                <CardBack
                  key={i}
                  position={pos}
                  rotation={cardRot}
                />
              );
            })}
            {/* عدد الكروت */}
            <Html
              position={[
                basePos[0] + cardDir[0] * halfSpread + (opp.relativeSeat === 2 ? 0.15 : 0),
                basePos[1] + 0.2,
                basePos[2] + cardDir[2] * halfSpread,
              ]}
              center
            >
              <div className="bg-black/70 px-2 py-0.5 rounded text-xs font-bold"
                style={{ color: '#d4a843' }}>
                {opp.cardCount}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}