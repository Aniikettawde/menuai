import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
// "Nano Banana" — Gemini's image-output model. Same generateContent endpoint
// as menu-import, just with responseModalities including IMAGE.
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image'
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

type RequestBody = {
  categoryName?: string
  cuisineType?: string
  isBar?: boolean
}

function buildPrompt(categoryName: string, cuisineType: string, isBar: boolean): string {
  const subject = isBar
    ? `an appetizing overhead/45-degree shot of drinks representative of the menu category "${categoryName}"`
    : `an appetizing overhead/45-degree shot of food representative of the menu category "${categoryName}"${cuisineType ? ` (${cuisineType} cuisine)` : ''}`
  return `Professional restaurant food photography. Generate ${subject}. Square 1:1 composition, natural warm lighting, shallow depth of field, clean plating, no people, no hands, no text or watermark anywhere in the image, photorealistic, high resolution.`
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  if (!text) return `${res.status} ${res.statusText}`
  try {
    const json = JSON.parse(text)
    return json?.error?.message ?? text.slice(0, 500)
  } catch {
    return text.slice(0, 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    let body: RequestBody | null = null
    try {
      body = (await req.json()) as RequestBody
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const categoryName = (body?.categoryName ?? '').trim()
    if (!categoryName) {
      return NextResponse.json({ error: 'categoryName is required' }, { status: 400 })
    }
    const cuisineType = (body?.cuisineType ?? '').trim()
    const isBar = Boolean(body?.isBar)

    const prompt = buildPrompt(categoryName, cuisineType, isBar)

    const response = await fetch(
      `${GEMINI_BASE_URL}/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      },
    )

    if (!response.ok) {
      const message = await readErrorMessage(response)
      return NextResponse.json({ error: `Gemini API error: ${message}` }, { status: 502 })
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; inlineData?: { data?: string; mimeType?: string } }> } }>
      error?: { message?: string }
    }

    if (data?.error?.message) {
      return NextResponse.json({ error: `Gemini error: ${data.error.message}` }, { status: 502 })
    }

    const parts = data?.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((p) => p.inlineData?.data)
    if (!imagePart?.inlineData?.data) {
      return NextResponse.json({ error: 'Gemini did not return an image. Try again or rename the category.' }, { status: 502 })
    }

    return NextResponse.json({
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
    })
  } catch (error) {
    console.error('[category-image] error:', error)
    const message = error instanceof Error ? error.message : 'Image generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}