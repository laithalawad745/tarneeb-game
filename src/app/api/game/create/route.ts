import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(req: NextRequest) {
  try {
    const { playerName } = await req.json();

    // إنشاء لاعب
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({ name: playerName })
      .select()
      .single();

    if (playerError) throw playerError;

    const hostPlayer = {
      id: player.id,
      name: playerName,
      seatIndex: 0,
      hand: [],
      tricksWon: [],
      score: 0,
      cheatAccusationsLeft: 2,
      hasCheated: false,
      stolenCard: null,
      isConnected: true,
    };

    // إنشاء غرفة بكود فريد
    let code = generateCode();
    let attempts = 0;

    // ← تأكد إن الكود فريد (يمنع التعارض)
    while (attempts < 5) {
      const { data: existing } = await supabase
        .from('games')
        .select('id')
        .eq('code', code)
        .single();
      if (!existing) break;
      code = generateCode();
      attempts++;
    }

    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({
        code,
        host_id: player.id,
        phase: 'waiting',
        state: {
          players: [hostPlayer],
          hostPlayerId: player.id,   // ← مهم: نحفظه هون كـ fallback
          playType: 'individual',
          dealNumber: 0,
          usedModes: [],
          chooserIndex: 0,
          scores: {},
        },
      })
      .select()
      .single();

    if (gameError) throw gameError;

    // إضافة المضيف لجدول game_players
    const { error: joinError } = await supabase
      .from('game_players')
      .insert({
        game_id: game.id,
        player_id: player.id,
        seat_index: 0,
      });

    if (joinError) throw joinError;

    console.log(`[CREATE] غرفة جديدة: ${code} | host: ${player.id} | game: ${game.id}`);

    return NextResponse.json({
      gameId: game.id,
      gameCode: code,
      playerId: player.id,
      hostId: player.id,   // ← نرجعه للكلاينت عشان يخزنه
      seatIndex: 0,
    });
  } catch (error: any) {
    console.error('[CREATE] خطأ:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}