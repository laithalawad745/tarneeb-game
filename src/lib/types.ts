// ============================================
// أنواع البيانات للعبة تركس
// ============================================

// أنواع الكروت
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string; // مثل "hearts_A"
}

// التسميات الأربعة
export type GameMode = 'queens' | 'diamonds' | 'tricks' | 'tarneeb';
// queens = بنات (كل ملكة = -25)
// diamonds = ديناري (كل ديناري = -10)
// tricks = لطش (كل لمّة = -15)
// tarneeb = تركس (الكل مع بعض)

// نوع اللعب
export type PlayType = 'partnership' | 'individual';
// partnership = شراكة (2 ضد 2)
// individual = يهودي (كل واحد لحاله)

// معلومات اللاعب
export interface Player {
  id: string;
  name: string;
  seatIndex: number; // 0-3 (مكان الجلوس)
  hand: Card[]; // الكروت بإيده
  tricksWon: Card[][]; // اللمّات اللي أكلها
  score: number;
  cheatAccusationsLeft: number; // عدد مرات الاتهام المتبقية (2 بكل برتية)
  hasCheated: boolean; // هل غش بهالجولة؟
  stolenCard: Card | null; // الكرت المسروق (إذا غش)
  isConnected: boolean;
}

// فريق (بحالة الشراكة)
export interface Team {
  players: [string, string]; // IDs
  score: number;
}

// حالة الجولة
export interface Round {
  cardsPlayed: { playerId: string; card: Card }[];
  leadSuit: Suit | null; // النوع اللي فتح
  currentPlayerIndex: number;
}

// حالة البرتية (مجموعة من 4 جولات)
export interface Deal {
  gameMode: GameMode;
  chooserIndex: number; // مين اختار التسمية
  rounds: Round[];
  currentRound: number;
  tricksPerPlayer: Record<string, Card[][]>;
}

// حالة اللعبة الكاملة
export interface GameState {
  id: string;
  players: Player[];
  playType: PlayType;
  teams?: [Team, Team]; // فقط بحالة الشراكة
  currentDeal: Deal | null;
  dealNumber: number;
  phase: GamePhase;
  scores: Record<string, number>;
  chooserIndex: number; // مين دوره يختار التسمية
  usedModes: GameMode[]; // التسميات المستخدمة (كل تسمية مرة واحدة)
  createdAt: string;
}

// مراحل اللعبة
export type GamePhase =
  | 'waiting'        // بانتظار اللاعبين
  | 'choosing_type'  // اختيار شراكة أو يهودي
  | 'choosing_mode'  // اختيار التسمية
  | 'playing'        // اللعب
  | 'round_end'      // نهاية الجولة
  | 'deal_end'       // نهاية البرتية
  | 'game_end';      // نهاية اللعبة

// أحداث Pusher
export type GameEvent =
  | { type: 'player_joined'; player: Player }
  | { type: 'game_started'; state: GameState }
  | { type: 'type_chosen'; playType: PlayType }
  | { type: 'mode_chosen'; mode: GameMode }
  | { type: 'card_played'; playerId: string; card: Card }
  | { type: 'round_won'; winnerId: string; cards: Card[] }
  | { type: 'cheat_steal'; playerId: string } // لاعب سرق كرت (بدون تفاصيل)
  | { type: 'cheat_accuse'; accuserId: string; accusedId: string }
  | { type: 'cheat_revealed'; accusedId: string; caught: boolean; penalty: number }
  | { type: 'deal_end'; scores: Record<string, number> }
  | { type: 'game_end'; finalScores: Record<string, number> }
  | { type: 'player_disconnected'; playerId: string }
  | { type: 'pass'; playerId: string }; // باص (بالتركس)

// نتيجة حساب النقاط
export interface ScoreResult {
  playerScores: Record<string, number>;
  teamScores?: Record<string, number>;
  details: string[];
}

// عقوبة الغش
export interface CheatPenalty {
  queens: number;   // 4 بنات
  diamonds: number;  // 14 ديناري (140 نقطة)
  tricks: number;    // 13 لطش (195 نقطة)
  tarneeb: number;   // 150 نقطة
}

export const CHEAT_PENALTIES: Record<GameMode, number> = {
  queens: 4 * 25,     // 4 بنات = 100
  diamonds: 14 * 10,  // 14 ديناري = 140
  tricks: 13 * 15,    // 13 لطش = 195
  tarneeb: 150,       // 150 نقطة ثابتة
};
