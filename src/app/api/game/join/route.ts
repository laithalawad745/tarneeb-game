import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getPusherServer } from '@/lib/pusherServer';

export async function POST(req: NextRequest) {
  try {
    const { playerName, gameCode } = await req.json();

    // البحث عن الغرفة
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*, game_players(*)')
      .eq('code', gameCode.toUpperCase())
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: 'الغرفة مش موجودة' }, { status: 404 });
    }

    if (game.phase !== 'waiting') {
      return NextResponse.json({ error: 'اللعبة بلشت' }, { status: 400 });
    }

    if (game.game_players.length >= 4) {
      return NextResponse.json({ error: 'الغرفة ممتلئة' }, { status: 400 });
    }

    // إنشاء لاعب
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({ name: playerName })
      .select()
      .single();

    if (playerError) throw playerError;

    // إيجاد أول مقعد فاضي
    const takenSeats = game.game_players.map((gp: any) => gp.seat_index);
    const seatIndex = [0, 1, 2, 3].find(s => !takenSeats.includes(s))!;

    // إضافة اللاعب
    const { error: joinError } = await supabase
      .from('game_players')
      .insert({
        game_id: game.id,
        player_id: player.id,
        seat_index: seatIndex,
      });

    if (joinError) throw joinError;

    // إرسال حدث عبر Pusher
    const pusher = getPusherServer();
    await pusher.trigger(`game-${game.id}`, 'player-joined', {
      playerId: player.id,
      playerName,
      seatIndex,
      totalPlayers: game.game_players.length + 1,
    });

    return NextResponse.json({
      gameId: game.id,
      gameCode: game.code,
      playerId: player.id,
      seatIndex,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
