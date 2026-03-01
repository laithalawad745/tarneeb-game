import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// ====== هذا السطر هو الحل الأساسي — يمنع Next.js من عمل cache ======
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id;
    console.log(`[GET GAME] جلب بيانات اللعبة: ${gameId}`);

    const { data: game, error } = await supabase
      .from('games')
      .select('*, game_players(*, players(*))')
      .eq('id', gameId)
      .single();

    if (error || !game) {
      console.log('[GET GAME] لعبة مش موجودة:', error?.message);
      return NextResponse.json({ error: 'لعبة مش موجودة' }, { status: 404 });
    }

    // بناء قائمة اللاعبين من game_players (المصدر الموثوق)
    const dbPlayers = game.game_players
      .sort((a: any, b: any) => a.seat_index - b.seat_index)
      .map((gp: any) => ({
        playerId: gp.player_id,
        playerName: gp.players?.name || 'لاعب',
        seatIndex: gp.seat_index,
      }));

    console.log(`[GET GAME] اللاعبين بالداتابيس: ${dbPlayers.length}`,
      dbPlayers.map((p: any) => `${p.playerName}(seat:${p.seatIndex})`).join(', '));

    // مزامنة state.players مع الداتابيس
    const state = { ...game.state };
    const statePlayerIds = (state.players || []).map((p: any) => p.id);
    const dbPlayerIds = dbPlayers.map((p: any) => p.playerId);

    const needsSync = dbPlayerIds.some((id: string) => !statePlayerIds.includes(id)) ||
                      statePlayerIds.length !== dbPlayerIds.length;

    if (needsSync) {
      console.log('[GET GAME] مزامنة مطلوبة!');
      state.players = dbPlayers.map((dbP: any) => {
        const existing = (game.state.players || []).find((p: any) => p.id === dbP.playerId);
        if (existing) {
          return { ...existing, name: dbP.playerName, seatIndex: dbP.seatIndex };
        }
        return {
          id: dbP.playerId,
          name: dbP.playerName,
          seatIndex: dbP.seatIndex,
          hand: [],
          tricksWon: [],
          score: 0,
          cheatAccusationsLeft: 2,
          hasCheated: false,
          stolenCard: null,
          isConnected: true,
        };
      });

      await supabase.from('games').update({ state }).eq('id', gameId);
    }

    return NextResponse.json({
      gameId: game.id,
      code: game.code,
      phase: game.phase,
      hostId: game.host_id,
      state,
      players: dbPlayers,
    });
  } catch (error: any) {
    console.error('[GET GAME] خطأ:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}