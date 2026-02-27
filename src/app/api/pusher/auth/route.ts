import { NextRequest, NextResponse } from 'next/server';
import { getPusherServer } from '@/lib/pusherServer';

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const socketId = data.get('socket_id') as string;
    const channel = data.get('channel_name') as string;

    const pusher = getPusherServer();
    const authResponse = pusher.authorizeChannel(socketId, channel);

    return NextResponse.json(authResponse);
  } catch (error) {
    return NextResponse.json({ error: 'Auth failed' }, { status: 403 });
  }
}
