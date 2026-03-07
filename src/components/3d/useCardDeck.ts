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

  const { cardNodes, cardOffsets } = useMemo(() => {
    const nodes: Record<string, THREE.Object3D> = {};
    const offsets: Record<string, number> = {};

    scene.updateMatrixWorld(true);

    const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
    const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    let referenceZ: number | null = null;

    suits.forEach(suit => {
      ranks.forEach(rank => {
        const cardId = `${suit}_${rank}`;
        let node: THREE.Object3D | undefined;

        const namesToTry = [
          `${RANK_NAMES_EN[rank]} of ${SUIT_NAMES_EN[suit]}`,
          `${RANK_NAMES_EN[rank]}_of_${SUIT_NAMES_EN[suit]}`,
          `${RANK_NAMES_EN[rank].toLowerCase()}_of_${SUIT_NAMES_EN[suit].toLowerCase()}`,
          `${rank}${suit[0].toUpperCase()}`,
          `card_${rank}_${suit}`,
          `${suit}_${rank}`,
        ];

if (rank === '8' && suit === 'hearts') {
  namesToTry.unshift('Eigh_of_Hearts');
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

          if (referenceZ === null) {
            referenceZ = node.position.z;
          }
          offsets[cardId] = node.position.z - referenceZ;
        }
      });
    });

    console.log(`[CARDS] تم تحميل ${Object.keys(nodes).length}/52 كرت`);

    // طباعة الكروت الناقصة
    const allCardIds: string[] = [];
    suits.forEach(s => ranks.forEach(r => allCardIds.push(`${s}_${r}`)));
    const missing = allCardIds.filter(id => !nodes[id]);
    if (missing.length > 0) {
      console.log('[CARDS] كروت ناقصة:', missing);

      // نطبع كل الأسماء اللي فيها "heart" أو "eight"
      const allNames: string[] = [];
      scene.traverse((obj) => { if (obj.name) allNames.push(obj.name); });
      const heartNames = allNames.filter(n => n.toLowerCase().includes('heart'));
      console.log('[CARDS] كل أسماء Hearts:', heartNames);
      const eightNames = allNames.filter(n => n.toLowerCase().includes('eigh') || n.toLowerCase().includes('ight'));
      console.log('[CARDS] كل أسماء Eight:', eightNames);
    }

    return { cardNodes: nodes, cardOffsets: offsets };
  }, [scene]);

  return { cardNodes, cardOffsets };
}

useGLTF.preload('/models/cards/scene.gltf');