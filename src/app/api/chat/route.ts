// app/api/chat/route.ts
// Gemini-powered AI waiter response, plain text only

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ChatRequest, ChatResponse, QuickReply } from '@/types'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getSupabaseAdminClient() {
  if (!SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing')
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing')
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function sanitizeReply(text: string) {
  return text
    .replace(/\[SUGGESTIONS:[\s\S]*?\]/g, '')
    .replace(/\[ITEMS:[\s\S]*?\]/g, '')
    .replace(/\[UPSELL:[\s\S]*?\]/g, '')
    .replace(/\[PSYCH:[\s\S]*?\]/g, '')
    .replace(/\[STAGE:[\s\S]*?\]/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function buildSystemPrompt(restaurantName: string, ctx: ChatRequest['menu_context']): string {
  const categories = ctx?.categories ?? []
  const bestsellers = ctx?.bestsellers ?? []
  const availableItems = ctx?.available_items ?? []

  return `You are an expert AI waiter for ${restaurantName}.

Rules:
- Reply in plain text only.
- Do NOT use markdown, bullets, numbering, emojis, tags, or hidden markers.
- Do NOT suggest follow-up prompts.
- Do NOT end with a question unless the user clearly asked something ambiguous.
- Keep answers short, natural, and helpful.
- If the user asks for a complete meal, give one concise complete meal recommendation.
- If the user asks about a dish, answer directly and clearly.
- If the user asks about price/ingredients/allergens, answer only that.
- Never invent menu items.
- Use only the menu context below when referring to menu items.

Menu Context:
Categories: ${categories.join(', ') || 'none'}
Best Sellers: ${bestsellers.join(', ') || 'none'}
Available Items: ${availableItems.join(', ') || 'none'}`
}

function buildFallbackSuggestions(): QuickReply[] {
  return []
}

function detectConvoStage(history: ChatRequest['history'] | undefined, message: string) {
  const userMessages = (history ?? []).filter(m => m.role === 'user').length
  const msg = message.toLowerCase()

  if (/add|order|cart|place|confirm|want|get me|i'll have|i'll take/i.test(msg)) return 'ready_to_order'
  if (/price|cost|how much|₹|options|varieties|difference/i.test(msg)) return 'deciding'
  if (userMessages >= 3) return 'browsing'
  return 'early'
}

async function logChatEvents(params: {
  restaurant_id?: string
  session_id?: string
  query: string
  stage: string
}) {
  const { restaurant_id, session_id, query, stage } = params
  if (!restaurant_id || !session_id) return

  const supabase = getSupabaseAdminClient()
  const now = new Date()

  const { error } = await supabase.from('analytics_events').insert([
    {
      restaurant_id,
      session_id,
      event_type: 'ai_chat',
      item_name: null,
      metadata: { query, stage },
      timestamp: now.toISOString(),
      hour_of_day: now.getHours(),
      day_of_week: now.getDay(),
    },
  ])

  if (error) throw error
}

export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 500 })
    }

    const body = (await req.json()) as ChatRequest
    const message = body.message?.trim() ?? ''
    const history = body.history ?? []
    const menu_context = body.menu_context ?? {
      categories: [],
      bestsellers: [],
      available_items: [],
    }

    if (!message) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400 })
    }

    const restaurantName =
      (menu_context as Record<string, unknown>)?.restaurant_name &&
      typeof (menu_context as Record<string, unknown>).restaurant_name === 'string'
        ? ((menu_context as Record<string, unknown>).restaurant_name as string)
        : 'this restaurant'

    const stage = detectConvoStage(history, message)
    const systemPrompt = buildSystemPrompt(restaurantName, menu_context)

    const geminiContents = [
      ...history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(msg.content ?? '') }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ]

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: geminiContents,
       generationConfig: {
  temperature: 0.55,
  maxOutputTokens: 900,
  topP: 0.9,
},
      }),
    })

    if (!geminiRes.ok) {
      console.error('Gemini error:', await geminiRes.text())
      return NextResponse.json({ error: 'AI unavailable' }, { status: 502 })
    }

    const geminiData = await geminiRes.json()
    const rawReply: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    const reply = sanitizeReply(rawReply) || 'Sorry, I could not generate a response right now.'

    const response: ChatResponse & {
      psych_trigger?: string
      convo_stage?: string
    } = {
      reply,
      suggestions: buildFallbackSuggestions(),
      mentioned_items: [],
      upsell_items: [],
      psych_trigger: 'none',
      convo_stage: stage,
    }

    void logChatEvents({
      restaurant_id: body.restaurant_id,
      session_id: body.session_id,
      query: message,
      stage,
    }).catch(err => console.error('Analytics logging error:', err))

    return NextResponse.json(response)
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 15