import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = 'gemini-2.5-flash'

type Body = {
  name?: string
  currentDescription?: string
  categoryName?: string
  isVeg?: boolean
  isBestseller?: boolean
  isSpecial?: boolean
  tags?: string[]
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  if (!text) return `${res.status} ${res.statusText}`
  try {
    const json = JSON.parse(text)
    return json?.error?.message ?? json?.message ?? text.slice(0, 1000)
  } catch {
    return text.slice(0, 1000)
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY missing' }, { status: 500 })
    }

    const body = (await req.json().catch(() => null)) as Body | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const name = cleanText(body.name)
    if (!name) {
      return NextResponse.json({ error: 'Dish name is required' }, { status: 400 })
    }

    const currentDescription = cleanText(body.currentDescription)
    const categoryName = cleanText(body.categoryName)
    const tags = Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean) : []
    const hasExisting = currentDescription.length > 0

    // Plain-text prompt — no JSON instruction needed since responseMimeType forces JSON output
    const prompt = `You are a menu copywriter for Indian restaurants.

Write one appetizing dish description for the dish below.

Dish: ${name}
Category: ${categoryName || 'General'}
Type: ${body.isVeg ? 'Vegetarian' : 'Non-vegetarian'}
${body.isBestseller ? 'This is a bestseller.' : ''}
${body.isSpecial ? "This is today's special." : ''}
${tags.length ? `Tags: ${tags.join(', ')}` : ''}
${hasExisting ? `Improve this existing description: "${currentDescription}"` : ''}

Requirements:
- Between 20 and 35 words
- Appetizing, warm, and compelling
- No price, no emojis
- Natural and believable tone

Return a JSON object with a single key "description" containing the text.`

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
  temperature: 0.8,
  maxOutputTokens: 500,
  responseMimeType: 'application/json',
  responseSchema: {
    type: 'OBJECT',
    properties: {
      description: { type: 'STRING' },
    },
    required: ['description'],
  },
  thinkingConfig: {
    thinkingBudget: 0,
  },
},
    }

    const response = await fetch(
      `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      },
    )

    if (!response.ok) {
      const errMsg = await readErrorMessage(response)
      console.error('Gemini API error:', errMsg)
      return NextResponse.json({ error: `Gemini error: ${errMsg}` }, { status: 502 })
    }

    const data = await response.json()
    console.log('Gemini raw response:', JSON.stringify(data).slice(0, 800))

    const finishReason = data?.candidates?.[0]?.finishReason ?? 'unknown'

    // With responseMimeType: application/json, Gemini returns clean JSON text directly.
    // Thinking tokens are kept internal and never appear in the output text.
    const parts: Array<{ text?: string; thought?: boolean }> =
      data?.candidates?.[0]?.content?.parts ?? []

    const rawText = parts
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('')
      .trim()

    if (!rawText) {
      console.error('Empty response. finishReason:', finishReason, JSON.stringify(data).slice(0, 800))
      return NextResponse.json(
        { error: `Empty response from Gemini (reason: ${finishReason})` },
        { status: 500 },
      )
    }

    // Parse — should be clean JSON thanks to responseMimeType
    let description = ''
    try {
      const parsed = JSON.parse(rawText) as Record<string, unknown>
      description = cleanText(parsed.description)
    } catch {
      // Last resort: if Gemini somehow returns plain text despite the mime type,
      // use it directly if it looks like a reasonable description
      console.warn('JSON parse failed, attempting plain-text fallback. rawText:', rawText.slice(0, 300))
      const plain = rawText.replace(/^["']|["']$/g, '').trim()
      const wordCount = plain.split(/\s+/).length
      if (wordCount >= 10 && wordCount <= 80) {
        description = plain
      }
    }

    if (!description) {
      console.error('Empty description after parse. rawText:', rawText.slice(0, 300))
      return NextResponse.json({ error: 'AI returned an empty description' }, { status: 500 })
    }

    return NextResponse.json({ description })
  } catch (error) {
    console.error('menu-generate-description error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate description' },
      { status: 500 },
    )
  }
}