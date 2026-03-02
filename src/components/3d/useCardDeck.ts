'use client';

import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useMemo } from 'react';
import { Suit, Rank } from '@/lib/types';

const RANK_NAMES_EN: Record<Rank, string> = {
  'A': 'Ace', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five',
  '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten',
  'J': 'Jack', 'Q': 'Queen', 'K': 'King',
};

const SUIT_NAMES_EN: Record<Suit, string> = {
  spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs',
};

export function useCardDeck() {
  const { scene } = useGLTF('/models/cards/scene.gltf');

  const cardNodes = useMemo(() => {
    const nodes: Record<string, THREE.Object3D> = {};

    // ← أول شي: اطبع كل الـ nodes الموجودة بالمودل
    const allNames: string[] = [];
    scene.traverse((obj) => {
      if (obj.name) allNames.push(obj.name);
    });
    console.log('[CARDS] كل الـ nodes بالمودل:', allNames.slice(0, 30));
    console.log('[CARDS] إجمالي الـ nodes:', allNames.length);

    const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
    const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    suits.forEach(suit => {
      ranks.forEach(rank => {
        const cardId = `${suit}_${rank}`;
        let node: THREE.Object3D | undefined;

        // ← جرب أسماء مختلفة بالترتيب
        const namesToTry = [
          // النمط الأصلي
          `${RANK_NAMES_EN[rank]} of ${SUIT_NAMES_EN[suit]}`,
          // نمط بدون مسافات
          `${RANK_NAMES_EN[rank]}_of_${SUIT_NAMES_EN[suit]}`,
          // نمط صغير
          `${RANK_NAMES_EN[rank].toLowerCase()}_of_${SUIT_NAMES_EN[suit].toLowerCase()}`,
          // نمط مختصر مثل "AS" للآص بالسباد
          `${rank}${suit[0].toUpperCase()}`,
          // نمط card_rank_suit
          `card_${rank}_${suit}`,
          // نمط suit_rank
          `${suit}_${rank}`,
        ];

        // إصلاح الـ typo المعروف بالمودل
        if (rank === '8' && suit === 'hearts') {
          namesToTry.unshift('Eigh of Hearts');
        }

        for (const name of namesToTry) {
          const found = scene.getObjectByName(name);
          if (found) {
            node = found;
            break;
          }
        }

        if (node) {
          nodes[cardId] = node;
        }
      });
    });

    console.log(`[CARDS] تم تحميل ${Object.keys(nodes).length}/52 كرت`);

    // لو ما لقينا إشي — جرب نطابق بشكل ذكي
    if (Object.keys(nodes).length === 0) {
      console.warn('[CARDS] ما تم تحميل أي كرت! جاري المطابقة الذكية...');

      // خذ أول 52 object من المشهد يشبه كرت
      const candidates = allNames.filter(name =>
        name.length > 2 && !name.includes('Scene') && !name.includes('Root')
      );
      console.log('[CARDS] المرشحون:', candidates.slice(0, 10));
    }

    return nodes;
  }, [scene]);

  const getCard = (suit: Suit, rank: Rank): THREE.Object3D | null => {
    const cardId = `${suit}_${rank}`;
    const original = cardNodes[cardId];
    if (!original) return null;
    const clone = original.clone(true);
    clone.position.set(0, 0, 0);
    return clone;
  };

  return { cardNodes, getCard };
}

useGLTF.preload('/models/cards/scene.gltf');