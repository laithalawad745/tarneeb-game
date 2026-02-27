import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getPusherServer } from '@/lib/pusherServer';
import {
  playCard, startNewDeal, startNewRound, isRoundComplete,
  isDealComplete, getRoundWinner, calculateScores, stealCard,
  accuseCheat, handlePass, getAvailableModes, CHEAT_PENALTIES,
} from '@/lib/gameLogic';
import { GameState, GameMode, PlayType, Card } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { gameId, playerId, action, payload } = await req.json();
    const pusher = getPusherServer();

    // جلب حالة اللعبة
    const { data: game, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error || !game) {
      return NextResponse.json({ error: 'لعبة مش موجودة' }, { status: 404 });
    }

    let state: GameState = game.state;
    let eventType = '';
    let eventData: any = {};

    switch (action) {
      // ========== اختيار نوع اللعب ==========
      case 'choose_type': {
        const { playType } = payload as { playType: PlayType };
        state = { ...state, playType, phase: 'choosing_mode' };

        if (playType === 'partnership') {
          // فريق 1: مقعد 0+2، فريق 2: مقعد 1+3
          const team1 = state.players.filter(p => p.seatIndex % 2 === 0).map(p => p.id) as [string, string];
          const team2 = state.players.filter(p => p.seatIndex % 2 === 1).map(p => p.id) as [string, string];
          state.teams = [
            { players: team1, score: 0 },
            { players: team2, score: 0 },
          ];
        }

        eventType = 'type-chosen';
        eventData = { playType };
        break;
      }

      // ========== اختيار التسمية ==========
      case 'choose_mode': {
        const { mode } = payload as { mode: GameMode };
        const available = getAvailableModes(state);

        if (!available.includes(mode)) {
          return NextResponse.json({ error: 'هالتسمية اتلعبت' }, { status: 400 });
        }

        state = startNewDeal(state, mode);
        state = startNewRound(state, state.chooserIndex);

        eventType = 'mode-chosen';
        eventData = { mode, state };
        break;
      }

      // ========== لعب كرت ==========
      case 'play_card': {
        const { card } = payload as { card: Card };
        state = playCard(state, playerId, card);

        eventType = 'card-played';
        eventData = { playerId, card };

        // هل خلصت الجولة؟
        if (isRoundComplete(state)) {
          const round = state.currentDeal!.rounds[state.currentDeal!.currentRound];
          const winnerId = getRoundWinner(round);
          const wonCards = round.cardsPlayed.map(cp => cp.card);

          // أضف اللمّة للفائز
          state = {
            ...state,
            players: state.players.map(p => {
              if (p.id === winnerId) {
                return { ...p, tricksWon: [...p.tricksWon, wonCards] };
              }
              return p;
            }),
          };

          // هل خلصت البرتية؟
          if (isDealComplete(state)) {
            const scores = calculateScores(
              state.players,
              state.currentDeal!.gameMode,
              state.playType,
              state.teams
            );

            // تحديث النقاط
            for (const [pid, score] of Object.entries(scores.playerScores)) {
              state.scores[pid] = (state.scores[pid] || 0) + score;
            }

            // حفظ النقاط بالداتابيز
            for (const [pid, score] of Object.entries(scores.playerScores)) {
              await supabase.from('scores').insert({
                game_id: gameId,
                player_id: pid,
                deal_number: state.dealNumber,
                game_mode: state.currentDeal!.gameMode,
                score,
              });
            }

            // الدور اللي بعده يختار
            state.chooserIndex = (state.chooserIndex + 1) % 4;
            state.phase = state.usedModes.length >= 4 ? 'game_end' : 'choosing_mode';

            eventType = 'deal-end';
            eventData = { scores: scores.playerScores, totalScores: state.scores };
          } else {
            // جولة جديدة - اللي ربح يفتح
            const winnerIdx = state.players.findIndex(p => p.id === winnerId);
            state = startNewRound(state, winnerIdx);
            eventType = 'round-end';
            eventData = { winnerId, wonCards };
          }
        }
        break;
      }

      // ========== باص (بالتركس) ==========
      case 'pass': {
        const player = state.players.find(p => p.id === playerId)!;
        const round = state.currentDeal!.rounds[state.currentDeal!.currentRound];
        const { isValidPass, isCheating } = handlePass(
          player, round.leadSuit, state.currentDeal!.gameMode
        );

        if (!isValidPass) {
          return NextResponse.json({ error: 'ما بتقدر تعمل باص' }, { status: 400 });
        }

        if (isCheating) {
          state = {
            ...state,
            players: state.players.map(p =>
              p.id === playerId ? { ...p, hasCheated: true } : p
            ),
          };
        }

        // انتقل للاعب التالي
        const updatedRound = {
          ...round,
          currentPlayerIndex: (round.currentPlayerIndex + 1) % 4,
        };
        const rounds = [...state.currentDeal!.rounds];
        rounds[state.currentDeal!.currentRound] = updatedRound;
        state = {
          ...state,
          currentDeal: { ...state.currentDeal!, rounds },
        };

        eventType = 'pass';
        eventData = { playerId };
        break;
      }

      // ========== سرقة كرت (غش) ==========
      case 'steal_card': {
        const player = state.players.find(p => p.id === playerId)!;
        const result = stealCard(player);

        if (!result) {
          return NextResponse.json({ error: 'ما بتقدر تسرق كرت' }, { status: 400 });
        }

        state = {
          ...state,
          players: state.players.map(p =>
            p.id === playerId ? result.player : p
          ),
        };

        // ما نرسل تفاصيل الكرت المسروق للكل - بس نخبرهم إنو صار شي
        eventType = 'cheat-steal';
        eventData = { playerId };
        break;
      }

      // ========== اتهام بالغش ==========
      case 'accuse_cheat': {
        const { accusedId } = payload as { accusedId: string };
        const accuser = state.players.find(p => p.id === playerId)!;
        const accused = state.players.find(p => p.id === accusedId)!;

        const { caught, penalty, updatedAccuser, updatedAccused } = accuseCheat(
          accuser, accused, state.currentDeal!.gameMode, state.playType
        );

        state = {
          ...state,
          players: state.players.map(p => {
            if (p.id === playerId) return updatedAccuser;
            if (p.id === accusedId) return updatedAccused;
            return p;
          }),
        };

        // بحالة الشراكة - العقوبة على الفريق
        if (caught && state.playType === 'partnership' && state.teams) {
          const teamIdx = state.teams.findIndex(t => t.players.includes(accusedId));
          if (teamIdx >= 0) {
            state.scores[state.teams[teamIdx].players[0]] =
              (state.scores[state.teams[teamIdx].players[0]] || 0) - penalty / 2;
            state.scores[state.teams[teamIdx].players[1]] =
              (state.scores[state.teams[teamIdx].players[1]] || 0) - penalty / 2;
          }
        } else if (caught) {
          state.scores[accusedId] = (state.scores[accusedId] || 0) - penalty;
        }

        // حفظ سجل الغش
        await supabase.from('cheat_log').insert({
          game_id: gameId,
          accuser_id: playerId,
          accused_id: accusedId,
          was_caught: caught,
          penalty,
          game_mode: state.currentDeal!.gameMode,
        });

        eventType = 'cheat-revealed';
        eventData = { accuserId: playerId, accusedId, caught, penalty };
        break;
      }

      default:
        return NextResponse.json({ error: 'أكشن مش معروف' }, { status: 400 });
    }

    // حفظ الحالة بالداتابيز
    await supabase
      .from('games')
      .update({ state, phase: state.phase })
      .eq('id', gameId);

    // إرسال الحدث لكل اللاعبين
    await pusher.trigger(`game-${gameId}`, eventType, eventData);

    return NextResponse.json({ success: true, state });
  } catch (error: any) {
    console.error('Game action error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
