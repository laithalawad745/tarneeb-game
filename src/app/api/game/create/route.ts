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

    // إنشاء كائن اللاعب الكامل للـ state
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

    // إنشاء غرفة بكود فريد — المضيف موجود بـ state.players من البداية
    const code = generateCode();
    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({
        code,
        host_id: player.id,
        phase: 'waiting',
        state: {
          players: [hostPlayer],
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

    // إضافة اللاعب المضيف للغرفة
    const { error: joinError } = await supabase
      .from('game_players')
      .insert({
        game_id: game.id,
        player_id: player.id,
        seat_index: 0,
      });

    if (joinError) throw joinError;

    return NextResponse.json({
      gameId: game.id,
      gameCode: code,
      playerId: player.id,
      seatIndex: 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}