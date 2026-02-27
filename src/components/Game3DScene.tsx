'use client';

import { Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls, Environment, useGLTF, ContactShadows, Html,
  PerspectiveCamera
} from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/lib/gameStore';

// ============ مكوّن الطاولة ============
function PokerTable() {
  const { scene } = useGLTF('/models/table-small.glb', '/basis/');
  return (
    <primitive
      object={scene}
      scale={1}
      position={[0, 0, 0]}
      rotation={[0, 0, 0]}
    />
  );
}

// طاولة بسيطة كـ fallback
function FallbackTable() {
  return (
    <group>
      {/* سطح الطاولة */}
      <mesh position={[0, 0.75, 0]} receiveShadow>
        <cylinderGeometry args={[2.5, 2.5, 0.1, 32]} />
        <meshStandardMaterial color="#1a5c2e" roughness={0.8} />
      </mesh>
      {/* حافة الطاولة */}
      <mesh position={[0, 0.75, 0]}>
        <torusGeometry args={[2.5, 0.08, 8, 32]} />
        <meshStandardMaterial color="#8B4513" roughness={0.4} />
      </mesh>
      {/* أرجل الطاولة */}
      {[0, 1, 2, 3].map(i => {
        const angle = (i * Math.PI * 2) / 4 + Math.PI / 4;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 2, 0.375, Math.sin(angle) * 2]}
            castShadow
          >
            <cylinderGeometry args={[0.08, 0.08, 0.75, 8]} />
            <meshStandardMaterial color="#654321" />
          </mesh>
        );
      })}
    </group>
  );
}

// ============ مكوّن الشخصية ============

function Character({ seatIndex, name, isActive }: {
  seatIndex: number;
  name: string;
  isActive: boolean;
}) {
  const { scene } = useGLTF('/models/scene.gltf');
  const clone = scene.clone();

  const positions: [number, number, number][] = [
    [0, -0.45, 2.2],
    [2.2, -0.45, 0],
    [0, -0.45, -2.2],
    [-2.2, -0.45, 0],
  ];

  const rotations: [number, number, number][] = [
    [0, Math.PI, 0],
    [0, Math.PI / 2, 0],
    [0, 0, 0],
    [0, -Math.PI / 2, 0],
  ];

  return (
    <group position={positions[seatIndex]} rotation={rotations[seatIndex]}>
      <primitive object={clone} scale={0.5} />
      {seatIndex !== 0 && (
        <Html position={[0, 2.2, 0]} center>
          <div className={`player-badge text-center text-sm whitespace-nowrap ${isActive ? 'active' : ''}`}>
            {name || `لاعب ${seatIndex + 1}`}
          </div>
        </Html>
      )}
    </group>
  );
}

useGLTF.preload('/models/scene.gltf');

// ============ كروت بإيد اللاعب ============
function PlayerHand() {
  const myHand = useGameStore(state => state.getMyHand());
  const selectedCard = useGameStore(state => state.selectedCard);
  const selectCard = useGameStore(state => state.selectCard);

  if (myHand.length === 0) return null;

  const cardWidth = 0.7;
  const totalWidth = myHand.length * cardWidth * 0.6;
  const startX = -totalWidth / 2;

  return (
    <group position={[0, 1.2, 2.5]}>
      {myHand.map((card, i) => {
        const isSelected = selectedCard?.id === card.id;
        const x = startX + i * cardWidth * 0.6;
        const y = isSelected ? 0.4 : 0;
        const rotZ = ((i - myHand.length / 2) * 0.03);

        return (
          <group
            key={card.id}
            position={[x, y, 0]}
            rotation={[isSelected ? -0.3 : -0.5, 0, rotZ]}
            onClick={() => selectCard(isSelected ? null : card)}
          >
            <mesh castShadow>
              <boxGeometry args={[0.6, 0.85, 0.01]} />
              <meshStandardMaterial color="white" />
            </mesh>
            {/* نص الكرت */}
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

// ============ كروت على الطاولة (الجولة الحالية) ============
function TableCards() {
  const gameState = useGameStore(state => state.gameState);

  if (!gameState?.currentDeal) return null;

  const currentRound = gameState.currentDeal.rounds[gameState.currentDeal.currentRound];
  if (!currentRound) return null;

  // مواقع الكروت على الطاولة (أمام كل لاعب)
  const positions: [number, number, number][] = [
    [0, 0.82, 0.8],    // لاعب 0
    [0.8, 0.82, 0],    // لاعب 1
    [0, 0.82, -0.8],   // لاعب 2
    [-0.8, 0.82, 0],   // لاعب 3
  ];

  return (
    <group>
      {currentRound.cardsPlayed.map(({ playerId, card }, i) => {
        const playerIdx = gameState.players.findIndex(p => p.id === playerId);
        const pos = positions[playerIdx] || positions[0];

        return (
          <group key={card.id} position={pos} rotation={[-Math.PI / 2, 0, Math.random() * 0.3 - 0.15]}>
            <mesh receiveShadow castShadow>
              <boxGeometry args={[0.5, 0.7, 0.01]} />
              <meshStandardMaterial color="white" />
            </mesh>
            <Html position={[0, 0, 0.01]} center transform>
              <div
                className="text-xs font-bold select-none"
                style={{
                  color: card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black',
                  fontSize: '9px',
                  width: '35px',
                  textAlign: 'center',
                }}
              >
                {card.rank}
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

// ============ اللمّات المأكولة (قدام كل لاعب) ============
function WonTricks() {
  const gameState = useGameStore(state => state.gameState);

  if (!gameState) return null;

  // مواقع اللمّات (على طرف الطاولة أمام كل لاعب)
  const positions: [number, number, number][] = [
    [1.5, 0.82, 2.0],
    [2.0, 0.82, -1.5],
    [-1.5, 0.82, -2.0],
    [-2.0, 0.82, 1.5],
  ];

  return (
    <group>
      {gameState.players.map((player, playerIdx) => {
        if (player.tricksWon.length === 0) return null;
        const pos = positions[playerIdx];

        return (
          <group key={player.id} position={pos}>
            {/* كومة كروت صغيرة */}
            {player.tricksWon.map((trick, trickIdx) => (
              <mesh
                key={trickIdx}
                position={[trickIdx * 0.15, trickIdx * 0.005, 0]}
                rotation={[-Math.PI / 2, 0, Math.random() * 0.2]}
              >
                <boxGeometry args={[0.4, 0.55, 0.01]} />
                <meshStandardMaterial color="#e8e0d0" />
              </mesh>
            ))}
            {/* عدد اللمّات */}
            <Html position={[0, 0.3, 0]} center>
              <div className="text-xs bg-black/60 px-1 rounded">
                {player.tricksWon.length}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ============ إعداد الكاميرا ============
function CameraSetup() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 5, 6);
    camera.lookAt(0, 0.8, 0);
  }, [camera]);

  return null;
}

// ============ المشهد الكامل ============
export default function Game3DScene() {
  return (
    <Canvas
      shadows
      style={{ background: '#0a0e17' }}
      gl={{ antialias: true, alpha: false }}
    >
      <PerspectiveCamera makeDefault position={[0, 5, 6]} fov={45} />

      {/* الإضاءة */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[0, 4, 0]} intensity={0.8} color="#ffd89b" />

      {/* البيئة */}
      <Environment preset="night" />
      <fog attach="fog" args={['#0a0e17', 8, 25]} />

      {/* الأرضية */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      <ContactShadows position={[0, 0, 0]} scale={10} blur={2} opacity={0.5} />

      <Suspense fallback={null}>
        {/* الطاولة */}
        <PokerTable />

        {/* الشخصيات */}
        <Character seatIndex={0} name="أنت" isActive={false} />
        <Character seatIndex={1} name="لاعب 2" isActive={false} />
        <Character seatIndex={2} name="لاعب 3" isActive={false} />
        <Character seatIndex={3} name="لاعب 4" isActive={false} />

        {/* كروت اللاعب */}
        <PlayerHand />

        {/* كروت الطاولة */}
        <TableCards />

        {/* اللمّات المأكولة */}
        <WonTricks />
      </Suspense>

      {/* تحكم بالكاميرا (للتطوير - نشيلها بعدين) */}
      <OrbitControls
        target={[0, 0.8, 0]}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={4}
        maxDistance={12}
        enablePan={false}
      />
    </Canvas>
  );
}

// تحميل الملفات مسبقاً
useGLTF.preload('/models/table-small.glb', '/basis/');
useGLTF.preload('/models/scene.gltf');