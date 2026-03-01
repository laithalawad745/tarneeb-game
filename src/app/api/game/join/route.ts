import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getPusherServer } from '@/lib/pusherServer';

export async function POST(req: NextRequest) {
  try {
    const { playerName, gameCode } = await req.json();
    console.log(`[JOIN] بداية انضمام: ${playerName} للغرفة ${gameCode}`);

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

    // إضافة اللاعب لجدول game_players
    const { error: joinError } = await supabase
      .from('game_players')
      .insert({
        game_id: game.id,
        player_id: player.id,
        seat_index: seatIndex,
      });

    if (joinError) throw joinError;

    // إعادة قراءة كل اللاعبين من الداتابيس
    const { data: allGamePlayers, error: fetchError } = await supabase
      .from('game_players')
      .select('*, players(*)')
      .eq('game_id', game.id)
      .order('seat_index', { ascending: true });

    if (fetchError) throw fetchError;

    // بناء قائمة اللاعبين الكاملة
    const fullPlayersList = (allGamePlayers || []).map((gp: any) => ({
      id: gp.player_id,
      name: gp.players?.name || 'لاعب',
      seatIndex: gp.seat_index,
      hand: [],
      tricksWon: [],
      score: 0,
      cheatAccusationsLeft: 2,
      hasCheated: false,
      stolenCard: null,
      isConnected: true,
    }));

    const updatedState = {
      ...game.state,
      players: fullPlayersList,
    };

    await supabase.from('games').update({ state: updatedState }).eq('id', game.id);

    const totalPlayers = allGamePlayers?.length || 0;
    console.log(`[JOIN] تم! المجموع: ${totalPlayers}`, fullPlayersList.map((p: any) => p.name).join(', '));

    // قائمة مختصرة للـ Pusher والكلاينت
    const allPlayersInfo = fullPlayersList.map((p: any) => ({
      playerId: p.id,
      playerName: p.name,
      seatIndex: p.seatIndex,
    }));

    // إرسال Pusher
    const pusher = getPusherServer();
    await pusher.trigger(`game-${game.id}`, 'player-joined', {
      playerId: player.id,
      playerName,
      seatIndex,
      totalPlayers,
      allPlayers: allPlayersInfo,
    });

    // ====== نرجع allPlayers بالـ response كمان — عشان اللاعب اللي لسا داخل يستخدمها فوراً ======
    return NextResponse.json({
      gameId: game.id,
      gameCode: game.code,
      playerId: player.id,
      seatIndex,
      allPlayers: allPlayersInfo,
    });
  } catch (error: any) {
    console.error('[JOIN] خطأ:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}