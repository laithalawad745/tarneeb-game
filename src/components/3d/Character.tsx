'use client';

import { useMemo } from 'react';
import { useGLTF, Html } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';

const CHARACTER_MODEL = '/models/scene.gltf';

interface CharacterProps {
  position: [number, number, number];
  rotation: [number, number, number];
  name: string;
  isActive: boolean;
  scale?: number;
}

export default function Character({ position, rotation, name, isActive, scale = 0.45 }: CharacterProps) {
  const { scene } = useGLTF(CHARACTER_MODEL);

  const clone = useMemo(() => {
    try {
      return SkeletonUtils.clone(scene);
    } catch {
      return scene.clone();
    }
  }, [scene]);

  return (
    <group position={position} rotation={rotation}>
      <primitive object={clone} scale={scale} />
      <Html position={[0, 2.0, 0]} center>
        <div className={`player-badge text-center text-sm whitespace-nowrap ${isActive ? 'active' : ''}`}>
          {name}
        </div>
      </Html>
    </group>
  );
}

useGLTF.preload(CHARACTER_MODEL);