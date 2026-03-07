'use client';

import { Html } from '@react-three/drei';
import { useGameStore } from '@/lib/gameStore';
import { Card, Suit } from '@/lib/types';

const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const SUIT_COLORS: Record<Suit, string> = {
  hearts: '#e74c3c',
  diamonds: '#e74c3c',
  clubs: '#1a1a2e',
  spades: '#1a1a2e',
};

function CardFace({ card }: { card: Card }) {
  const symbol = SUIT_SYMBOLS[card.suit];
  const color = SUIT_COLORS[card.suit];

  return (
    <div style={{
      width: '50px',
      height: '70px',
      background: 'white',
      borderRadius: '5px',
      border: '2px solid #ccc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      userSelect: 'none',
      pointerEvents: 'none',
    }}>
      <div style={{ color, fontSize: '16px', fontWeight: 'bold' }}>
        {card.rank}
      </div>
      <div style={{ color, fontSize: '22px' }}>
        {symbol}
      </div>
    </div>
  );
}

export default function TableCards() {
  const gameState = useGameStore(state => state.gameState);
  const myPlayerId = useGameStore(state => state.myPlayerId);

  if (!gameState?.currentDeal) return null;

  const currentRound = gameState.currentDeal.rounds[gameState.currentDeal.currentRound];
  if (!currentRound) return null;

  const myIndex = gameState.players.findIndex(p => p.id === myPlayerId) || 0;

const seatPositions: [number, number, number][] = [
    [0, 0.85, 0.45],      // أنت (قريب منك)
    [0.45, 0.85, 0],      // يمين (قريب من اليمين)
    [0, 0.85, -0.45],     // مقابل (قريب من المقابل)
    [-0.45, 0.85, 0],     // يسار (قريب من اليسار)
  ];

  return (
    <group>
      {currentRound.cardsPlayed.map((play, i) => {
        const playerIndex = gameState.players.findIndex(p => p.id === play.playerId);
        const relativeSeat = (playerIndex - myIndex + 4) % 4;
        const pos = seatPositions[relativeSeat] || seatPositions[0];

        return (
          <Html
            key={`${play.card.id}-${i}`}
            position={pos}
            center
            distanceFactor={2}
          >
            <CardFace card={play.card} />
          </Html>
        );
      })}
    </group>
  );
}