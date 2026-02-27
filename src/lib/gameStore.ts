import { create } from 'zustand';
import { GameState, Player, Card, GameMode, PlayType, GameEvent } from './types';

interface GameStore {
  // الحالة
  gameState: GameState | null;
  myPlayerId: string | null;
  myPlayerName: string;
  selectedCard: Card | null;
  isLoading: boolean;
  error: string | null;

  // أكشنز
  setGameState: (state: GameState) => void;
  setMyPlayer: (id: string, name: string) => void;
  selectCard: (card: Card | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  handleGameEvent: (event: GameEvent) => void;

  // Getters
  getMyPlayer: () => Player | null;
  isMyTurn: () => boolean;
  getMyHand: () => Card[];
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  myPlayerId: null,
  myPlayerName: '',
  selectedCard: null,
  isLoading: false,
  error: null,

  setGameState: (state) => set({ gameState: state }),

  setMyPlayer: (id, name) => set({ myPlayerId: id, myPlayerName: name }),

  selectCard: (card) => set({ selectedCard: card }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  handleGameEvent: (event) => {
    const { gameState } = get();
    if (!gameState) return;

    switch (event.type) {
      case 'player_joined':
        set({
          gameState: {
            ...gameState,
            players: [...gameState.players, event.player],
          },
        });
        break;

      case 'game_started':
        set({ gameState: event.state });
        break;

      case 'card_played':
        // يتم التحديث من السيرفر
        break;

      case 'cheat_revealed':
        // عرض نتيجة الاتهام
        break;

      default:
        break;
    }
  },

  getMyPlayer: () => {
    const { gameState, myPlayerId } = get();
    if (!gameState || !myPlayerId) return null;
    return gameState.players.find(p => p.id === myPlayerId) || null;
  },

  isMyTurn: () => {
    const { gameState, myPlayerId } = get();
    if (!gameState?.currentDeal || !myPlayerId) return false;
    const currentRound = gameState.currentDeal.rounds[gameState.currentDeal.currentRound];
    if (!currentRound) return false;
    const currentPlayer = gameState.players[currentRound.currentPlayerIndex];
    return currentPlayer?.id === myPlayerId;
  },

  getMyHand: () => {
    const player = get().getMyPlayer();
    return player?.hand || [];
  },
}));
