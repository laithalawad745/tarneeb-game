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

    // جلب حالة اللعبة
    const { data: game, error } = await supabase
      .from('games')
      .select('*, game_players(*, players(*))')
      .eq('id', gameId)
      .single();

    if (error || !game) {
      return NextResponse.json({ error: 'لعبة مش موجودة' }, { status: 404 });
    }

    let state: GameState = game.state;

    // التحقق إنو المضيف (لبعض الأكشنز)
    const isHost = game.host_id === playerId;

    switch (action) {
      // ========== اختيار نوع اللعب (المضيف فقط) ==========
      case 'choose_type': {
        if (!isHost) {
          return NextResponse.json({ error: 'بس المضيف يقدر يختار' }, { status: 403 });
        }

        const { playType } = payload as { playType: PlayType };
        state = { ...state, playType };

        if (playType === 'individual') {
          // يهودي: ترتيب عشوائي
          const shuffled = [...state.players].sort(() => Math.random() - 0.5);
          state.players = shuffled.map((p, i) => ({ ...p, seatIndex: i }));
          state.phase = 'choosing_mode';
        } else {
          // شراكة: ننتظر اختيار الشريك
          state.phase = 'choosing_type';
        }

        await supabase.from('games').update({ state, phase: state.phase }).eq('id', gameId);

        await pusher.trigger(`game-${gameId}`, 'type-chosen', {
          playType,
          hostId: playerId,
        });

        return NextResponse.json({ success: true, state });
      }

      // ========== طلب شراكة (المضيف يرسل طلب للشريك) ==========
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
          // الشريك رفض — أخبر المضيف يختار غيره
          const partnerPlayer = state.players.find(p => p.id === playerId);

          await pusher.trigger(`game-${gameId}`, 'partner-rejected', {
            partnerId: playerId,
            partnerName: partnerPlayer?.name || 'لاعب',
          });

          return NextResponse.json({ success: true });
        }

        // ============================================================
        // الشريك وافق — نرتب المقاعد:
        //   المضيف = مقعد 0 (الكاميرا)
        //   الشريك = مقعد 2 (قبال المضيف)
        //   الباقيين = مقعد 1 و 3 (عشوائي)
        // ============================================================

        const host = state.players.find(p => p.id === hostId);
        const partner = state.players.find(p => p.id === playerId);
        const others = state.players.filter(p => p.id !== hostId && p.id !== playerId);

        if (!host || !partner) {
          return NextResponse.json({ error: 'لاعب مش موجود' }, { status: 400 });
        }

        const shuffledOthers = others.sort(() => Math.random() - 0.5);

        const seatedPlayers = [
          { ...host, seatIndex: 0 },
          { ...shuffledOthers[0], seatIndex: 1 },
          { ...partner, seatIndex: 2 },
          { ...shuffledOthers[1], seatIndex: 3 },
        ];

        state.players = seatedPlayers;
        state.teams = [
          { players: [host.id, playerId] as [string, string], score: 0 },
          { players: [shuffledOthers[0].id, shuffledOthers[1].id] as [string, string], score: 0 },
        ];
        state.phase = 'choosing_mode';

        // تحديث المقاعد بالداتابيس
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

        let eventType = 'card-played';
        let eventData: any = { playerId, card, state };

        if (isRoundComplete(state)) {
          const round = state.currentDeal!.rounds[state.currentDeal!.currentRound];
          const winnerId = getRoundWinner(round);

          const winner = state.players.find(p => p.id === winnerId);
          if (winner) {
            winner.tricksWon.push(round.cardsPlayed.map(cp => cp.card));
          }

          if (isDealComplete(state)) {
            const scores = calculateScores(state);
            for (const [pid, score] of Object.entries(scores.playerScores)) {
              state.scores[pid] = (state.scores[pid] || 0) + score;
            }

            const currentMode = state.currentDeal!.gameMode;
            state.currentDeal = null;
            state.usedModes.push(currentMode);

            await supabase.from('games').update({ state, phase: state.phase }).eq('id', gameId);

            await pusher.trigger(`game-${gameId}`, 'card-played', eventData);
            await pusher.trigger(`game-${gameId}`, 'round-end', { winnerId, state });
            await pusher.trigger(`game-${gameId}`, 'deal-end', { scores: scores.playerScores, state });

            return NextResponse.json({ success: true, state });
          } else {
            state = startNewRound(state, state.players.findIndex(p => p.id === winnerId));

            await supabase.from('games').update({ state, phase: state.phase }).eq('id', gameId);

            await pusher.trigger(`game-${gameId}`, 'card-played', eventData);
            await pusher.trigger(`game-${gameId}`, 'round-end', { winnerId, state });

            return NextResponse.json({ success: true, state });
          }
        }

        await supabase.from('games').update({ state, phase: state.phase }).eq('id', gameId);
        await pusher.trigger(`game-${gameId}`, eventType, eventData);

        return NextResponse.json({ success: true, state });
      }

      // ========== سرقة كرت ==========
      case 'steal_card': {
        const { targetId } = payload as { targetId: string };
        state = stealCard(state, playerId, targetId);

        await supabase.from('games').update({ state }).eq('id', gameId);
        await pusher.trigger(`game-${gameId}`, 'cheat-steal', { playerId });

        return NextResponse.json({ success: true, state });
      }

      // ========== اتهام غش ==========
      case 'accuse_cheat': {
        const { accusedId } = payload as { accusedId: string };
        const result = accuseCheat(state, playerId, accusedId);
        state = result.state;

        await supabase.from('games').update({ state }).eq('id', gameId);
        await pusher.trigger(`game-${gameId}`, 'cheat-revealed', {
          accuserId: playerId, accusedId, caught: result.caught, penalty: result.penalty,
        });

        return NextResponse.json({ success: true, state });
      }

      // ========== باص ==========
      case 'pass': {
        state = handlePass(state, playerId);

        await supabase.from('games').update({ state }).eq('id', gameId);
        await pusher.trigger(`game-${gameId}`, 'pass', { playerId });

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