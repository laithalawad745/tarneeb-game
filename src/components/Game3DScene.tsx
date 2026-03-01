'use client';

import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/lib/gameStore';

// مكوّنات المشهد
import LoadingScreen from './3d/LoadingScreen';
import PokerTable from './3d/PokerTable';
import Character from './3d/Character';
import PlayerHand from './3d/PlayerHand';
import TableCards from './3d/TableCards';
import WonTricks from './3d/WonTricks';
import OpponentHands from './3d/OpponentHands';

// ============ إعدادات الكاميرا ============
function FirstPersonCamera() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 1.4, 1.8);
    camera.lookAt(0, 0.7, 0);
    (camera as THREE.PerspectiveCamera).fov = 65;
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

// ============ أرضية داكنة ============
function DarkFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
      <circleGeometry args={[12, 64]} />
      <meshStandardMaterial color="#0a0e17" roughness={0.3} metalness={0.1} />
    </mesh>
  );
}

// ============ مواقع الـ 3 خصوم حول الطاولة ============
const SEAT_POSITIONS: Record<number, { position: [number, number, number]; rotation: [number, number, number] }> = {
  1: {
    position: [1.3, -0.45, 0],
    rotation: [0, -Math.PI / 2, 0],
  },
  2: {
    position: [0, -0.45, -1.3],
    rotation: [0, 0, 0],
  },
  3: {
    position: [-1.3, -0.45, 0],
    rotation: [0, Math.PI / 2, 0],
  },
};

// ============ المشهد الكامل ============
export default function Game3DScene() {
  const gameState = useGameStore(state => state.gameState);
  const myPlayerId = useGameStore(state => state.myPlayerId);

  // حساب الخصوم الـ 3 مع مواقعهم
  const opponents = (() => {
    if (!gameState || !myPlayerId || gameState.players.length === 0) {
      return [];
    }

    const myPlayer = gameState.players.find(p => p.id === myPlayerId);
    if (!myPlayer) return [];

    const mySeat = myPlayer.seatIndex;

    return gameState.players
      .filter(p => p.id !== myPlayerId)
      .map(p => {
        const relativeSeat = (p.seatIndex - mySeat + 4) % 4;

        const isPartner = gameState.playType === 'partnership' &&
          gameState.teams?.some(t =>
            t.players.includes(myPlayerId) && t.players.includes(p.id)
          );

        let isActive = false;
        if (gameState.currentDeal) {
          const round = gameState.currentDeal.rounds[gameState.currentDeal.currentRound];
          if (round) {
            const currentPlayer = gameState.players[round.currentPlayerIndex];
            isActive = currentPlayer?.id === p.id;
          }
        }

        return {
          name: p.name,
          seatIndex: relativeSeat,
          isActive,
          isPartner,
        };
      })
      .filter(p => p.seatIndex !== 0);
  })();

  return (
    <>
      <LoadingScreen />

      <Canvas
        shadows
        style={{ background: '#0a0e17' }}
        gl={{ antialias: true, alpha: false }}
      >
        <PerspectiveCamera makeDefault position={[0, 1.4, 1.8]} fov={65} />
        <FirstPersonCamera />

        {/* الإضاءة */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={1} castShadow shadow-mapSize={[2048, 2048]} />
        <pointLight position={[0, 2.5, 0]} intensity={1.5} color="#ffd89b" distance={6} />
        <pointLight position={[0, 1.2, 0]} intensity={0.4} color="#ffcc66" distance={4} />

        {/* البيئة */}
        <Environment preset="night" />
        <fog attach="fog" args={['#0a0e17', 6, 20]} />

        {/* الأرضية */}
        <DarkFloor />

        <Suspense fallback={null}>
          {/* الطاولة */}
          <PokerTable />

          {/* الـ 3 خصوم */}
          {opponents.map((opp) => {
            const seatConfig = SEAT_POSITIONS[opp.seatIndex];
            if (!seatConfig) return null;

            return (
              <Character
                key={opp.seatIndex}
                position={seatConfig.position}
                rotation={seatConfig.rotation}
                name={opp.isPartner ? `${opp.name} 🤝` : opp.name}
                isActive={opp.isActive}
              />
            );
          })}

          {/* كروت اللاعب (وجه) */}
          <PlayerHand />

          {/* كروت الخصوم (ظهر — مقلوبة مع العدد) */}
          <OpponentHands />

          {/* كروت الطاولة (الملعوبة) */}
          <TableCards />

          {/* اللمّات */}
          <WonTricks />
        </Suspense>
      </Canvas>
    </>
  );
}