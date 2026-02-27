// ============================================
// منطق لعبة تركس الأساسي
// ============================================

import {
  Card, Suit, Rank, GameState, GameMode, PlayType,
  Player, Round, Deal, ScoreResult, CHEAT_PENALTIES,
  GamePhase,
} from './types';

// ============ إنشاء الكروت ============

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/** إنشاء رزمة كروت كاملة (52 كرت) */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${suit}_${rank}` });
    }
  }
  return deck;
}

/** خلط الكروت */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** توزيع الكروت على 4 لاعبين (13 لكل واحد) */
export function dealCards(players: Player[]): Player[] {
  const deck = shuffleDeck(createDeck());
  return players.map((player, i) => ({
    ...player,
    hand: sortHand(deck.slice(i * 13, (i + 1) * 13)),
    tricksWon: [],
    cheatAccusationsLeft: 2,
    hasCheated: false,
    stolenCard: null,
  }));
}

/** ترتيب الكروت بالإيد (حسب النوع ثم الرقم) */
export function sortHand(hand: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
  const rankOrder: Record<Rank, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };
  return [...hand].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return rankOrder[a.rank] - rankOrder[b.rank];
  });
}

// ============ قواعد اللعب ============

/** قيمة الكرت (للمقارنة) */
export function getCardValue(card: Card): number {
  const values: Record<Rank, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };
  return values[card.rank];
}

/** هل يقدر اللاعب يلعب هالكرت؟ */
export function canPlayCard(
  card: Card,
  hand: Card[],
  leadSuit: Suit | null,
  gameMode: GameMode
): boolean {
  // أول كرت بالجولة - يقدر يلعب أي شي
  if (!leadSuit) return true;

  // إذا عنده من نفس النوع اللي فتح، لازم يلعب منه
  const hasSameSuit = hand.some(c => c.suit === leadSuit);
  if (hasSameSuit) {
    return card.suit === leadSuit;
  }

  // ما عنده من نفس النوع - يقدر يلعب أي شي
  return true;
}

/** الكروت المسموح يلعبها */
export function getPlayableCards(
  hand: Card[],
  leadSuit: Suit | null,
  gameMode: GameMode
): Card[] {
  return hand.filter(card => canPlayCard(card, hand, leadSuit, gameMode));
}

/** مين ربح الجولة (اللمّة)؟ */
export function getRoundWinner(round: Round): string {
  if (round.cardsPlayed.length !== 4 || !round.leadSuit) {
    throw new Error('الجولة لسا ما خلصت');
  }

  let winnerIndex = 0;
  let highestValue = 0;

  for (let i = 0; i < round.cardsPlayed.length; i++) {
    const { card } = round.cardsPlayed[i];
    // بس الكروت من نفس نوع الفتح بتتنافس
    if (card.suit === round.leadSuit) {
      const value = getCardValue(card);
      if (value > highestValue) {
        highestValue = value;
        winnerIndex = i;
      }
    }
  }

  return round.cardsPlayed[winnerIndex].playerId;
}

// ============ حساب النقاط ============

/** حساب نقاط البنات */
function scoreQueens(tricksWon: Card[][]): number {
  let score = 0;
  for (const trick of tricksWon) {
    for (const card of trick) {
      if (card.rank === 'Q') {
        score -= 25; // كل ملكة = -25
      }
    }
  }
  return score;
}

/** حساب نقاط الديناري */
function scoreDiamonds(tricksWon: Card[][]): number {
  let score = 0;
  for (const trick of tricksWon) {
    for (const card of trick) {
      if (card.suit === 'diamonds') {
        score -= 10; // كل ديناري = -10
      }
    }
  }
  return score;
}

/** حساب نقاط اللطش */
function scoreTricks(tricksWon: Card[][]): number {
  return tricksWon.length * -15; // كل لمّة = -15
}

/** حساب نقاط التركس (الكل مع بعض) */
function scoreTarneeb(tricksWon: Card[][]): number {
  let score = 0;
  // بنات
  score += scoreQueens(tricksWon);
  // ديناري
  score += scoreDiamonds(tricksWon);
  // لطش
  score += scoreTricks(tricksWon);
  return score;
}

/** حساب النقاط حسب التسمية */
export function calculateScores(
  players: Player[],
  gameMode: GameMode,
  playType: PlayType,
  teams?: [{ players: [string, string] }, { players: [string, string] }]
): ScoreResult {
  const playerScores: Record<string, number> = {};
  const details: string[] = [];

  // حساب نقاط كل لاعب
  for (const player of players) {
    let score = 0;
    switch (gameMode) {
      case 'queens':
        score = scoreQueens(player.tricksWon);
        break;
      case 'diamonds':
        score = scoreDiamonds(player.tricksWon);
        break;
      case 'tricks':
        score = scoreTricks(player.tricksWon);
        break;
      case 'tarneeb':
        score = scoreTarneeb(player.tricksWon);
        break;
    }
    playerScores[player.id] = score;
    if (score !== 0) {
      details.push(`${player.name}: ${score}`);
    }
  }

  // بحالة الشراكة - نجمع نقاط الفريق
  let teamScores: Record<string, number> | undefined;
  if (playType === 'partnership' && teams) {
    teamScores = {};
    for (const team of teams) {
      const teamScore = team.players.reduce((sum, pid) => sum + (playerScores[pid] || 0), 0);
      const key = team.players.join('-');
      teamScores[key] = teamScore;
    }
  }

  return { playerScores, teamScores, details };
}

// ============ نظام الغش ============

/** لاعب يسرق كرت من اللمّات قدامه */
export function stealCard(player: Player): { player: Player; stolenCard: Card } | null {
  if (player.tricksWon.length === 0) return null;
  if (player.hasCheated) return null; // بيقدر يغش مرة وحدة بس

  // ياخد آخر كرت من آخر لمّة
  const lastTrick = player.tricksWon[player.tricksWon.length - 1];
  if (lastTrick.length === 0) return null;

  const stolenCard = lastTrick[lastTrick.length - 1];

  // نشيل الكرت من اللمّة ونحطه بإيده
  const updatedTricks = [...player.tricksWon];
  updatedTricks[updatedTricks.length - 1] = lastTrick.slice(0, -1);

  // إذا اللمّة فضيت، نشيلها
  if (updatedTricks[updatedTricks.length - 1].length === 0) {
    updatedTricks.pop();
  }

  return {
    player: {
      ...player,
      hand: sortHand([...player.hand, stolenCard]),
      tricksWon: updatedTricks,
      hasCheated: true,
      stolenCard,
    },
    stolenCard,
  };
}

/** لاعب يتهم لاعب ثاني بالغش */
export function accuseCheat(
  accuser: Player,
  accused: Player,
  gameMode: GameMode,
  playType: PlayType
): {
  caught: boolean;
  penalty: number;
  updatedAccuser: Player;
  updatedAccused: Player;
} {
  if (accuser.cheatAccusationsLeft <= 0) {
    throw new Error('خلصت محاولات الاتهام');
  }

  const caught = accused.hasCheated;
  let penalty = 0;

  const updatedAccuser = {
    ...accuser,
    cheatAccusationsLeft: accuser.cheatAccusationsLeft - 1,
  };

  let updatedAccused = { ...accused };

  if (caught) {
    // انكشف! نحسب العقوبة
    penalty = CHEAT_PENALTIES[gameMode];

    // بحالة الشراكة العقوبة على الفريق كامل
    updatedAccused = {
      ...accused,
      score: accused.score - penalty,
      hasCheated: false,
      stolenCard: null,
    };
  }

  return { caught, penalty, updatedAccuser, updatedAccused };
}

/** باص بالتركس - اللاعب يقول باص وهو معه كرت يلعبه */
export function handlePass(
  player: Player,
  leadSuit: Suit | null,
  gameMode: GameMode
): { isValidPass: boolean; isCheating: boolean } {
  // بس بالتركس في باص
  if (gameMode !== 'tarneeb') {
    return { isValidPass: false, isCheating: false };
  }

  const playableCards = getPlayableCards(player.hand, leadSuit, gameMode);

  // إذا ما عنده كروت يلعبها - باص شرعي
  if (playableCards.length === 0) {
    return { isValidPass: true, isCheating: false };
  }

  // عنده كروت بس قال باص - هاد غش!
  return { isValidPass: true, isCheating: true };
}

// ============ إنشاء لعبة جديدة ============

export function createNewGame(gameId: string, hostPlayer: Player): GameState {
  return {
    id: gameId,
    players: [hostPlayer],
    playType: 'individual',
    currentDeal: null,
    dealNumber: 0,
    phase: 'waiting',
    scores: { [hostPlayer.id]: 0 },
    chooserIndex: 0,
    usedModes: [],
    createdAt: new Date().toISOString(),
  };
}

/** بدء برتية جديدة */
export function startNewDeal(state: GameState, gameMode: GameMode): GameState {
  const players = dealCards(state.players);

  const deal: Deal = {
    gameMode,
    chooserIndex: state.chooserIndex,
    rounds: [],
    currentRound: 0,
    tricksPerPlayer: {},
  };

  // تهيئة لمّات كل لاعب
  for (const p of players) {
    deal.tricksPerPlayer[p.id] = [];
  }

  return {
    ...state,
    players,
    currentDeal: deal,
    dealNumber: state.dealNumber + 1,
    phase: 'playing',
    usedModes: [...state.usedModes, gameMode],
  };
}

/** بدء جولة جديدة */
export function startNewRound(state: GameState, startingPlayerIndex: number): GameState {
  if (!state.currentDeal) throw new Error('ما في برتية حالية');

  const newRound: Round = {
    cardsPlayed: [],
    leadSuit: null,
    currentPlayerIndex: startingPlayerIndex,
  };

  return {
    ...state,
    currentDeal: {
      ...state.currentDeal,
      rounds: [...state.currentDeal.rounds, newRound],
      currentRound: state.currentDeal.rounds.length,
    },
  };
}

/** لعب كرت */
export function playCard(state: GameState, playerId: string, card: Card): GameState {
  if (!state.currentDeal) throw new Error('ما في برتية حالية');

  const deal = state.currentDeal;
  const currentRound = deal.rounds[deal.currentRound];

  if (!currentRound) throw new Error('ما في جولة حالية');

  // التحقق من صحة اللعبة
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new Error('لاعب مش موجود');

  if (!canPlayCard(card, player.hand, currentRound.leadSuit, deal.gameMode)) {
    throw new Error('ما بتقدر تلعب هالكرت');
  }

  // تحديد نوع الفتح
  const leadSuit = currentRound.leadSuit || card.suit;

  // شيل الكرت من إيد اللاعب
  const updatedPlayers = state.players.map(p => {
    if (p.id === playerId) {
      return {
        ...p,
        hand: p.hand.filter(c => c.id !== card.id),
      };
    }
    return p;
  });

  // أضف الكرت للجولة
  const updatedRound: Round = {
    ...currentRound,
    cardsPlayed: [...currentRound.cardsPlayed, { playerId, card }],
    leadSuit,
    currentPlayerIndex: (currentRound.currentPlayerIndex + 1) % 4,
  };

  const updatedRounds = [...deal.rounds];
  updatedRounds[deal.currentRound] = updatedRound;

  return {
    ...state,
    players: updatedPlayers,
    currentDeal: {
      ...deal,
      rounds: updatedRounds,
    },
  };
}

/** هل خلصت الجولة؟ (4 كروت انلعبو) */
export function isRoundComplete(state: GameState): boolean {
  if (!state.currentDeal) return false;
  const round = state.currentDeal.rounds[state.currentDeal.currentRound];
  return round?.cardsPlayed.length === 4;
}

/** هل خلصت البرتية؟ (13 جولة) */
export function isDealComplete(state: GameState): boolean {
  if (!state.currentDeal) return false;
  return state.currentDeal.rounds.length === 13 &&
    isRoundComplete(state);
}

/** هل خلصت اللعبة؟ (4 برتيات - كل التسميات اتلعبت) */
export function isGameComplete(state: GameState): boolean {
  return state.usedModes.length === 4;
}

/** الحصول على التسميات المتاحة (اللي ما اتلعبت) */
export function getAvailableModes(state: GameState): GameMode[] {
  const allModes: GameMode[] = ['queens', 'diamonds', 'tricks', 'tarneeb'];
  return allModes.filter(m => !state.usedModes.includes(m));
}

// ============ أسماء عربية ============

export const MODE_NAMES: Record<GameMode, string> = {
  queens: 'بنات',
  diamonds: 'ديناري',
  tricks: 'لطش',
  tarneeb: 'تركس',
};

export const SUIT_NAMES: Record<Suit, string> = {
  hearts: 'كبة',
  diamonds: 'ديناري',
  clubs: 'سبيت',
  spades: 'ليرة',
};

export const RANK_NAMES: Record<Rank, string> = {
  '2': '٢', '3': '٣', '4': '٤', '5': '٥', '6': '٦',
  '7': '٧', '8': '٨', '9': '٩', '10': '١٠',
  'J': 'ولد', 'Q': 'بنت', 'K': 'شايب', 'A': 'آص',
};
