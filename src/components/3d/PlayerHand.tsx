'use client';

import { useGameStore } from '@/lib/gameStore';
import Card3D from './Card3D';

export default function PlayerHand() {
  const myHand = useGameStore(state => state.getMyHand());
  const selectedCard = useGameStore(state => state.selectedCard);
  const selectCard = useGameStore(state => state.selectCard);

  if (myHand.length === 0) return null;

  // ====== توزيع الكروت بشكل مروحة ======
  const totalCards = myHand.length;
  const spreadWidth = Math.min(totalCards * 0.22, 2.2); // عرض المروحة
  const startX = -spreadWidth / 2;
  const cardSpacing = spreadWidth / Math.max(totalCards - 1, 1);

  // الارتفاع والعمق (قريب من الكاميرا)
  const baseY = 0.7;
  const baseZ = 1.5;

  return (
    <group>
      {myHand.map((card, i) => {
        const isSelected = selectedCard?.id === card.id;

        // حساب الموقع على المروحة
        const t = totalCards > 1 ? i / (totalCards - 1) : 0.5; // 0 to 1
        const x = startX + i * cardSpacing;

        // انحناء خفيف للمروحة (القسم الوسطي أعلى قليلاً)
        const curve = -Math.pow(t - 0.5, 2) * 0.15 + 0.04;
        const y = baseY + curve;

        // زاوية الدوران (ميلان خفيف من اليمين لليسار)
        const fanAngle = (t - 0.5) * 0.15;  // ±0.075 راديان
        const tiltX = -0.5; // ميلان للخلف عشان تشوف الكروت

        return (
          <Card3D
            key={card.id}
            card={card}
            position={[x, y, baseZ - Math.abs(t - 0.5) * 0.1]}
            rotation={[tiltX, 0, fanAngle]}
            selected={isSelected}
            onClick={() => selectCard(isSelected ? null : card)}
            hoverable={true}
          />
        );
      })}
    </group>
  );
}