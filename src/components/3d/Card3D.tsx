'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCardDeck } from './useCardDeck';
import { Card } from '@/lib/types';

interface Card3DProps {
  card: Card;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  faceDown?: boolean;
  onClick?: () => void;
  selected?: boolean;
  hoverable?: boolean;
}

const BASE_SCALE = 0.006;

export default function Card3D({
  card,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  faceDown = false,
  onClick,
  selected = false,
  hoverable = true,
}: Card3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const { cardNodes, cardOffsets } = useCardDeck();

  const cardId = `${card.suit}_${card.rank}`;
  const originalNode = cardNodes[cardId];
  const zOffset = cardOffsets[cardId] || 0;

  useFrame(() => {
    if (!groupRef.current) return;
    const targetY = position[1] + (selected ? 0.15 : hovered ? 0.05 : 0);
    groupRef.current.position.y += (targetY - groupRef.current.position.y) * 0.15;
  });

  if (!originalNode) return null;

  const finalScale = BASE_SCALE * scale;

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[
        rotation[0],
        rotation[1] + (faceDown ? Math.PI : 0),
        rotation[2],
      ]}
      scale={[finalScale, finalScale, finalScale]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerEnter={(e) => {
        e.stopPropagation();
        if (hoverable) {
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerLeave={() => {
        if (hoverable) {
          setHovered(false);
          document.body.style.cursor = 'default';
        }
      }}
    >
      <group position={[0, 0, -zOffset]}>
        <primitive object={originalNode.clone(true)} />
      </group>
    </group>
  );
}