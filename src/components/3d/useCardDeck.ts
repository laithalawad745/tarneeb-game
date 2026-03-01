'use client';

import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useMemo } from 'react';
import { Suit, Rank } from '@/lib/types';

// ====== Mapping من الـ game ID إلى اسم الـ node بالمودل ======
const RANK_NAMES_EN: Record<Rank, string> = {
  'A': 'Ace', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five',
  '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten',
  'J': 'Jack', 'Q': 'Queen', 'K': 'King',
};

const SUIT_NAMES_EN: Record<Suit, string> = {
  spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs',
};

// المودل فيه typo: "Eigh of Hearts" بدل "Eight of Hearts"
function getCardNodeName(suit: Suit, rank: Rank): string {
  let rankName = RANK_NAMES_EN[rank];
  // إصلاح الـ typo بالمودل
  if (rankName === 'Eight' && suit === 'hearts') {
    rankName = 'Eigh';
  }
  return `${rankName} of ${SUIT_NAMES_EN[suit]}`;
}

// ====== تحميل المودل مرة وحدة (يتم تخزينه بالكاش تلقائياً) ======
export function useCardDeck() {
  const { scene } = useGLTF('/models/cards/scene.gltf');

  const cardNodes = useMemo(() => {
    const nodes: Record<string, THREE.Object3D> = {};

    const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
    const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    suits.forEach(suit => {
      ranks.forEach(rank => {
        const nodeName = getCardNodeName(suit, rank);
        const cardId = `${suit}_${rank}`;
        const node = scene.getObjectByName(nodeName);
        if (node) {
          nodes[cardId] = node;
        } else {
          console.warn(`[CARDS] كرت مش موجود: ${nodeName} (${cardId})`);
        }
      });
    });

    console.log(`[CARDS] تم تحميل ${Object.keys(nodes).length}/52 كرت`);
    return nodes;
  }, [scene]);

  // دالة تنسخ كرت وتعيد تموضعه
  const getCard = (suit: Suit, rank: Rank): THREE.Object3D | null => {
    const cardId = `${suit}_${rank}`;
    const original = cardNodes[cardId];
    if (!original) return null;

    const clone = original.clone(true);
    // إعادة تعيين الموقع (الأصل عنده offset كبير)
    clone.position.set(0, 0, 0);
    return clone;
  };

  return { cardNodes, getCard };
}

// تحميل مسبق للمودل
useGLTF.preload('/models/cards/scene.gltf');