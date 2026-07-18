// src/app/api/whatsapp/create-template/route.ts
import { NextRequest, NextResponse } from 'next/server'

const GRAPH_VERSION = 'v21.0'

export async function POST(req: NextRequest) {
  try {
    const { name, category, language, bodyText, wabaId: bodyWabaId } = await req.json()

    if (!name || !category || !bodyText) {
      return NextResponse.json(
        { error: 'name, category, and bodyText are required' },
        { status: 400 }
      )
    }

    // Prefer the connected restaurant's own WABA ID (passed from the page); fall back to
    // the env var for standalone testing without going through the Connect flow.
    const wabaId = bodyWabaId || process.env.WHATSAPP_WABA_ID
    const token = process.env.WHATSAPP_ACCESS_TOKEN

    if (!wabaId || !token) {
      return NextResponse.json(
        { error: 'Missing wabaId (connect a WhatsApp account first) or WHATSAPP_ACCESS_TOKEN in server env' },
        { status: 500 }
      )
    }

    // Template names must be lowercase, alphanumeric + underscores only
    const safeName = String(name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 512)

    const payload = {
      name: safeName,
      category, // MARKETING | UTILITY | AUTHENTICATION
      language: language || 'en_US',
      components: [
        {
          type: 'BODY',
          text: bodyText,
        },
      ],
    }

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    )

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'Meta API error', details: data },
        { status: res.status }
      )
    }

    // data typically: { id: "...", status: "PENDING", category: "..." }
    return NextResponse.json({ success: true, template: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Optional: list existing templates so the page can show status (PENDING/APPROVED/REJECTED)
export async function GET(req: NextRequest) {
  try {
    const wabaId = req.nextUrl.searchParams.get('wabaId') || process.env.WHATSAPP_WABA_ID
    const token = process.env.WHATSAPP_ACCESS_TOKEN

    if (!wabaId || !token) {
      return NextResponse.json(
        { error: 'Missing wabaId (connect a WhatsApp account first) or WHATSAPP_ACCESS_TOKEN in server env' },
        { status: 500 }
      )
    }

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates?fields=name,status,category,language&limit=25`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    )

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'Meta API error', details: data },
        { status: res.status }
      )
    }

    return NextResponse.json({ templates: data?.data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}