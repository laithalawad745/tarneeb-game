'use client';

import { useGLTF } from '@react-three/drei';

const TABLE_MODEL = '/models/poker_table_small.glb';
const TABLE_SCALE = 0.0013;

export default function PokerTable() {
  const { scene } = useGLTF(TABLE_MODEL);
  return (
    <primitive object={scene} scale={TABLE_SCALE} position={[0, 0, 0]} />
  );
}

useGLTF.preload(TABLE_MODEL);