// app/api/chat/route.ts
// Gemini 2.5 Flash chat endpoint
// This is the core AI brain — handles menu Q&A, upselling, recommendations
import { NextRequest, NextResponse } from 'next/server'
import type { ChatRequest, ChatResponse, QuickReply } from '@/types'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

// Build the system prompt — this controls the AI's personality and behavior
function buildSystemPrompt(restaurantName: string, ctx: ChatRequest['menu_context']): string {
  return `You are an expert AI waiter at ${restaurantName}, a warm, friendly, and knowledgeable food assistant.

## Your Role
- Help customers navigate the menu and discover dishes they'll love
- Answer questions about ingredients, preparation, spice level, allergens
- Suggest complementary items naturally (upselling) — never pushy, always helpful
- Share what's popular, what the chef recommends, and hidden gems
- Be conversational, warm, and enthusiastic about food

## Menu Context
Categories: ${ctx.categories.join(', ')}
Best Sellers: ${ctx.bestsellers.slice(0, 10).join(', ')}
Available Items: ${ctx.available_items.join(', ')}

## Response Rules
1. Keep replies SHORT — 2-4 sentences max for simple questions
2. Use **bold** for dish names to make them scannable
3. For lists, use bullet points with •
4. NEVER make up items not in the menu above
5. When suggesting pairings, say "This pairs beautifully with..." not "You should also order..."
6. If asked about price, say "I don't have pricing in front of me — check the menu card!"
7. End with 1-2 natural follow-up suggestions as JSON in this exact format at the END of your response:
   [SUGGESTIONS:{"items":[{"label":"...","action":"..."},{"label":"...","action":"..."}]}]
8. If you mention menu items, list their names at the very end as:
   [ITEMS:item1,item2,item3]
9. For upsell suggestions, list them as:
   [UPSELL:item1,item2]

## Tone
Warm, knowledgeable, conversational — like a great waiter who genuinely loves food. Indian context: comfortable with "bhaiya", local terminology, spice levels. Keep it natural.`
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json()
    const { message, history, restaurant_id, session_id, menu_context } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400 })
    }

    // Fetch restaurant name for the prompt
    // (We pass enough context in menu_context; restaurant name comes from a DB query)
    // For performance, restaurant name is passed via menu_context.restaurant_name
    const restaurantName = (menu_context as Record<string, unknown>).restaurant_name as string || 'this restaurant'

    // Build Gemini conversation
    const systemPrompt = buildSystemPrompt(restaurantName, menu_context)

    // Convert history to Gemini format (alternating user/model)
    const geminiContents = [
      // System as first user turn (Gemini 2.5 Flash supports system via systemInstruction)
      ...history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
      {
        role: 'user',
        parts: [{ text: message }],
      }
    ]

    const geminiPayload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: geminiContents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,   // Keep responses short for 3G
        topP: 0.9,
      },
    }

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error('Gemini error:', errText)
      return NextResponse.json({ error: 'AI unavailable' }, { status: 502 })
    }

    const geminiData = await geminiRes.json()
    let rawReply: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Parse structured data from AI response
    let suggestions: QuickReply[] = []
    let mentioned_items: string[] = []
    let upsell_items: string[] = []

    // Extract [SUGGESTIONS:...]
    const suggestMatch = rawReply.match(
  /\[SUGGESTIONS:([\s\S]*?)\]/
)
    if (suggestMatch) {
      try {
        const parsed = JSON.parse(suggestMatch[1])
        suggestions = parsed.items ?? []
      } catch {}
      rawReply = rawReply.replace(/\[SUGGESTIONS:.*?\]/s, '').trim()
    }

    // Extract [ITEMS:...]
    const itemsMatch = rawReply.match(/\[ITEMS:(.*?)\]/)
    if (itemsMatch) {
      mentioned_items = itemsMatch[1].split(',').map(s => s.trim()).filter(Boolean)
      rawReply = rawReply.replace(/\[ITEMS:.*?\]/, '').trim()
    }

    // Extract [UPSELL:...]
    const upsellMatch = rawReply.match(/\[UPSELL:(.*?)\]/)
    if (upsellMatch) {
      upsell_items = upsellMatch[1].split(',').map(s => s.trim()).filter(Boolean)
      rawReply = rawReply.replace(/\[UPSELL:.*?\]/, '').trim()
    }

    // Default suggestions if AI didn't provide
    if (suggestions.length === 0) {
      suggestions = [
        { label: "What's popular?", action: "What are the most popular items?" },
        { label: "Veg options", action: "Show me vegetarian options" },
      ]
    }

    const response: ChatResponse = {
      reply: rawReply,
      suggestions: suggestions.slice(0, 3),
      mentioned_items,
      upsell_items,
    }

    return NextResponse.json(response)

  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Allow streaming in future (Gemini supports it)
export const runtime = 'nodejs'
export const maxDuration = 15
