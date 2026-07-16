// src/app/api/whatsapp/webhook/route.ts

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(req: Request) {
  const body = await req.json();
  console.log('Incoming WhatsApp webhook:', JSON.stringify(body));
  // handle delivery status / inbound messages here later
  return new Response('OK', { status: 200 });
}