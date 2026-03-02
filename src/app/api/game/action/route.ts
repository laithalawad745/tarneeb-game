import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getPusherServer } from '@/lib/pusherServer';
import {
  playCard, startNewDeal, startNewRound, isRoundComplete,
  isDealComplete, getRoundWinner, calculateScores, stealCard,
  accuseCheat, handlePass, getAvailableModes,
} from '@/lib/gameLogic';
import { GameState, GameMode, PlayType, Card } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { gameId, playerId, action, payload } = await req.json();
    const pusher = getPusherServer();

    // جلب حالة اللعبة + game_players
    const { data: game, error } = await supabase
      .from('games')
      .select('*, game_players(*, players(*))')
      .eq('id', gameId)
      .single();

    if (error || !game) {
      return NextResponse.json({ error: 'لعبة مش موجودة' }, { status: 404 });
    }

    let state: GameState = game.state;

    // ============================================================
    // ← الحل النهائي: نحدد المضيف من seat_index = 0 في game_players
    // هذا لا يعتمد على localStorage ولا على host_id بل على DB مباشرة
    // ============================================================
    const hostRow = game.game_players.find((gp: any) => gp.seat_index === 0);
    const hostPlayerIdFromDb = hostRow?.player_id;

    // ← التحقق: المرسل هو المضيف إذا كان player_id بمقعد 0 يطابقه
    //    أو إذا كان host_id بالـ game يطابقه (fallback)
    const isHost = hostPlayerIdFromDb === playerId || game.host_id === playerId;

    console.log(`[ACTION] ${action} | seat0_player: ${hostPlayerIdFromDb} | game.host_id: ${game.host_id} | playerId: ${playerId} | isHost: ${isHost}`);

    switch (action) {

      // ========== اختيار نوع اللعب (المضيف فقط) ==========
      case 'choose_type': {
        if (!isHost) {
          return NextResponse.json({ error: 'بس المضيف يقدر يختار' }, { status: 403 });
        }

        const { playType } = payload as { playType: PlayType };
        state = { ...state, playType };

        if (playType === 'individual') {
          const shuffled = [...state.players].sort(() => Math.random() - 0.5);
          state.players = shuffled.map((p, i) => ({ ...p, seatIndex: i }));
          state.phase = 'choosing_mode';
        } else {
          state.phase = 'choosing_type';
        }

        await supabase.from('games').update({ state, phase: state.phase }).eq('id', gameId);
        await pusher.trigger(`game-${gameId}`, 'type-chosen', { playType, hostId: playerId });

        return NextResponse.json({ success: true, state });
      }

      // ========== طلب شراكة (المضيف فقط) ==========
      case 'request_partner': {
        if (!isHost) {
          return NextResponse.json({ error: 'بس المضيف يقدر يختار شريك' }, { status: 403 });
        }

        const { partnerId } = payload as { partnerId: string };
        const hostPlayer = state.players.find(p => p.id === playerId);

        await pusher.trigger(`game-${gameId}`, 'partner-request', {
          hostId: playerId,
          hostName: hostPlayer?.name || 'المضيف',
          partnerId,
        });

        return NextResponse.json({ success: true });
      }

      // ========== رد الشريك (قبول/رفض) ==========
      case 'respond_partner': {
        const { hostId, accepted } = payload as { hostId: string; accepted: boolean };

        if (!accepted) {
          const partnerPlayer = state.players.find(p => p.id === playerId);
          await pusher.trigger(`game-${gameId}`, 'partner-rejected', {
            partnerId: playerId,
            partnerName: partnerPlayer?.name || 'لاعب',
          });
          return NextResponse.json({ success: true });
        }

        const host    = state.players.find(p => p.id === hostId);
        const partner = state.players.find(p => p.id === playerId);
        const others  = state.players.filter(p => p.id !== hostId && p.id !== playerId);

        if (!host || !partner) {
          return NextResponse.json({ error: 'لاعب مش موجود' }, { status: 400 });
        }

        const shuffledOthers = others.sort(() => Math.random() - 0.5);
        const seatedPlayers = [
          { ...host,               seatIndex: 0 },
          { ...shuffledOthers[0],  seatIndex: 1 },
          { ...partner,            seatIndex: 2 },
          { ...shuffledOthers[1],  seatIndex: 3 },
        ];

        state.players = seatedPlayers;
        state.teams = [
          { players: [host.id, playerId]                           as [string, string], score: 0 },
          { players: [shuffledOthers[0].id, shuffledOthers[1].id] as [string, string], score: 0 },
        ];
        state.phase = 'choosing_mode';

        for (const p of seatedPlayers) {
          await supabase
            .from('game_players')
            .update({ seat_index: p.seatIndex })
            .eq('game_id', gameId)
            .eq('player_id', p.id);
        }

        await supabase.from('games').update({ state, phase: state.phase }).eq('id', gameId);
        await pusher.trigger(`game-${gameId}`, 'partner-accepted', {
          hostId,
          partnerId: playerId,
          seating: seatedPlayers.map(p => ({
            playerId: p.id,
            playerName: p.name,
            seatIndex: p.seatIndex,
          })),
        });

        return NextResponse.json({ success: true, state });
      }

      // ========== اختيار التسمية (المضيف فقط) ==========
      case 'choose_mode': {
        if (!isHost) {
          return NextResponse.json({ error: 'بس المضيف يقدر يختار التسمية' }, { status: 403 });
        }

        const { mode } = payload as { mode: GameMode };
        const available = getAvailableModes(state);

        if (!available.includes(mode)) {
          return NextResponse.json({ error: 'هالتسمية اتلعبت' }, { status: 400 });
        }

        state = startNewDeal(state, mode);
        state = startNewRound(state, state.chooserIndex);

        await supabase.from('games').update({ state, phase: state.phase }).eq('id', gameId);
        await pusher.trigger(`game-${gameId}`, 'mode-chosen', { mode, state });

        return NextResponse.json({ success: true, state });
      }

      // ========== لعب كرت ==========
      case 'play_card': {
        const { card } = payload as { card: Card };
        state = playCard(state, playerId, card);

        const eventData: any = { playerId, card, state };

        if (isRoundComplete(state)) {
          const round    = state.currentDeal!.rounds[state.currentDeal!.currentRound];
          const winnerId = getRoundWinner(round);

          state = {
            ...state,
            players: state.players.map(p =>
              p.id === winnerId
                ? { ...p, tricksWon: [...p.tricksWon, round.cardsPlayed.map(cp => cp.card)] }
                : p
            ),
          };

          if (isDealComplete(state)) {
            const scores = calculateScores(
              state.players,
              state.currentDeal!.gameMode,
              state.playType,
              state.teams as any,
            );

            for (const [pid, score] of Object.entries(scores.playerScores)) {
              state.scores[pid] = (state.scores[pid] || 0) + score;
            }

            const currentMode  = state.currentDeal!.gameMode;
            state.currentDeal  = null;
            state.usedModes    = [...state.usedModes, currentMode];

            const winnerIdx    = state.players.findIndex(p => p.id === winnerId);
            state.chooserIndex = winnerIdx >= 0 ? winnerIdx : (state.chooserIndex + 1) % 4;
            state.phase        = 'choosing_mode';

            await supabase.from('games').update({ state, phase: state.phase }).eq('id', gameId);
            await pusher.trigger(`game-${gameId}`, 'card-played', eventData);
            await pusher.trigger(`game-${gameId}`, 'round-end', { winnerId, state });
            await pusher.trigger(`game-${gameId}`, 'deal-end', { scores: scores.playerScores, state });

            return NextResponse.json({ success: true, state });
          }

          const winnerIdx = state.players.findIndex(p => p.id === winnerId);
          state = startNewRound(state, winnerIdx);

          await supabase.from('games').update({ state, phase: state.phase }).eq('id', gameId);
          await pusher.trigger(`game-${gameId}`, 'card-played', eventData);
          await pusher.trigger(`game-${gameId}`, 'round-end', { winnerId, state });

          return NextResponse.json({ success: true, state });
        }

        await supabase.from('games').update({ state, phase: state.phase }).eq('id', gameId);
        await pusher.trigger(`game-${gameId}`, 'card-played', eventData);

        return NextResponse.json({ success: true, state });
      }

      // ========== سرقة كرت ==========
      case 'steal_card': {
        const player = state.players.find(p => p.id === playerId);
        if (!player) {
          return NextResponse.json({ error: 'لاعب مش موجود' }, { status: 400 });
        }

        const result = stealCard(player);
        if (!result) {
          return NextResponse.json({ error: 'ما تقدر تسرق الحين' }, { status: 400 });
        }

        state = {
          ...state,
          players: state.players.map(p => p.id === playerId ? result.player : p),
        };

        await supabase.from('games').update({ state }).eq('id', gameId);
        await pusher.trigger(`game-${gameId}`, 'cheat-steal', { playerId });

        return NextResponse.json({ success: true, state });
      }

      // ========== اتهام غش ==========
      case 'accuse_cheat': {
        const { accusedId } = payload as { accusedId: string };

        const accuser = state.players.find(p => p.id === playerId);
        const accused = state.players.find(p => p.id === accusedId);

        if (!accuser || !accused) {
          return NextResponse.json({ error: 'لاعب مش موجود' }, { status: 400 });
        }

        const result = accuseCheat(
          accuser,
          accused,
          state.currentDeal!.gameMode,
          state.playType,
        );

        state = {
          ...state,
          players: state.players.map(p => {
            if (p.id === playerId)  return result.updatedAccuser;
            if (p.id === accusedId) return result.updatedAccused;
            return p;
          }),
        };

        await supabase.from('games').update({ state }).eq('id', gameId);
        await pusher.trigger(`game-${gameId}`, 'cheat-revealed', {
          accuserId: playerId, accusedId, caught: result.caught, penalty: result.penalty,
        });

        return NextResponse.json({ success: true, state });
      }

      // ========== باص ==========
      case 'pass': {
        const currentDeal = state.currentDeal;
        if (!currentDeal) {
          return NextResponse.json({ error: 'ما في برتية حالية' }, { status: 400 });
        }

        const currentRound = currentDeal.rounds[currentDeal.currentRound];
        const player       = state.players.find(p => p.id === playerId);

        if (!player || !currentRound) {
          return NextResponse.json({ error: 'لاعب أو جولة مش موجودة' }, { status: 400 });
        }

        const { isValidPass, isCheating } = handlePass(
          player,
          currentRound.leadSuit,
          currentDeal.gameMode,
        );

        if (!isValidPass) {
          return NextResponse.json({ error: 'باص مش مسموح بهالتسمية' }, { status: 400 });
        }

        if (isCheating) {
          state = {
            ...state,
            players: state.players.map(p =>
              p.id === playerId ? { ...p, hasCheated: true } : p
            ),
          };
        }

        const updatedRound  = { ...currentRound, currentPlayerIndex: (currentRound.currentPlayerIndex + 1) % 4 };
        const updatedRounds = [...currentDeal.rounds];
        updatedRounds[currentDeal.currentRound] = updatedRound;

        state = { ...state, currentDeal: { ...currentDeal, rounds: updatedRounds } };

        await supabase.from('games').update({ state }).eq('id', gameId);
        await pusher.trigger(`game-${gameId}`, 'pass', { playerId, isCheating });

        return NextResponse.json({ success: true, state });
      }

      default:
        return NextResponse.json({ error: 'أكشن مش معروف' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Action error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}