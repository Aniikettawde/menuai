// src/app/api/whatsapp/send-message/route.ts
import { NextRequest, NextResponse } from 'next/server'

const GRAPH_VERSION = 'v21.0'

export async function POST(req: NextRequest) {
  try {
    const { to, templateName, languageCode, variables, phoneNumberId: bodyPhoneNumberId } = await req.json()

    if (!to || !templateName) {
      return NextResponse.json(
        { error: 'to and templateName are required' },
        { status: 400 }
      )
    }

    // Prefer the connected restaurant's own phone number ID (passed from the page); fall back
    // to the env var for standalone testing without going through the Connect flow.
    const phoneNumberId = bodyPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID
    const token = process.env.WHATSAPP_ACCESS_TOKEN

    if (!phoneNumberId || !token) {
      return NextResponse.json(
        { error: 'Missing phoneNumberId (connect a WhatsApp account first) or WHATSAPP_ACCESS_TOKEN in server env' },
        { status: 500 }
      )
    }

    // Normalize recipient to digits only, Meta expects no + or spaces
    const cleanTo = String(to).replace(/[^\d]/g, '')

    const components =
      Array.isArray(variables) && variables.length > 0
        ? [
            {
              type: 'body',
              parameters: variables.map((v: string) => ({ type: 'text', text: v })),
            },
          ]
        : undefined

    const payload = {
      messaging_product: 'whatsapp',
      to: cleanTo,
      type: 'template',
      template: {
        name: templateName, // e.g. "hello_world" for the pre-approved default template
        language: { code: languageCode || 'en_US' },
        ...(components ? { components } : {}),
      },
    }

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
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

    // data typically: { messaging_product, contacts: [...], messages: [{ id: "wamid...." }] }
    return NextResponse.json({ success: true, result: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}