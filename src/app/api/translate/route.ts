import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-only client — uses the service role key so it can write to the
// translation cache table regardless of RLS. NEVER expose this key client-side.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const LANG_NAMES: Record<string, string> = {
  hi: 'Hindi',
  mr: 'Marathi',
  zh: 'Chinese (Simplified)',
  es: 'Spanish',
  ja: 'Japanese',
}

interface TranslateItem {
  id: string // menu item or category id
  type: 'item' | 'category'
  field: 'name' | 'description'
  text: string
}

function cacheKey(it: { id: string; field: string }) {
  return `${it.id}:${it.field}`
}

export async function POST(req: NextRequest) {
  try {
    const { restaurantId, targetLang, items } = (await req.json()) as {
      restaurantId: string
      targetLang: string
      items: TranslateItem[]
    }

    if (!restaurantId || !targetLang || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Missing restaurantId, targetLang, or items' }, { status: 400 })
    }

    // English is the source language — nothing to translate.
    if (targetLang === 'en') {
      const result: Record<string, string> = {}
      for (const it of items) result[cacheKey(it)] = it.text
      return NextResponse.json({ translations: result })
    }

    if (!LANG_NAMES[targetLang]) {
      return NextResponse.json({ error: `Unsupported language: ${targetLang}` }, { status: 400 })
    }

    // De-dupe (same item/field can appear once — cheap safety net)
    const dedup = new Map<string, TranslateItem>()
    for (const it of items) {
      if (it.text && it.text.trim()) dedup.set(cacheKey(it), it)
    }
    const uniqueItems = [...dedup.values()]
    if (uniqueItems.length === 0) return NextResponse.json({ translations: {} })

    const ids = uniqueItems.map((i) => i.id)

    // 1. Check the cache table for anything we've already translated before.
    const { data: cached, error: cacheErr } = await supabase
      .from('menu_translations')
      .select('entity_id, field, translated_text')
      .eq('lang', targetLang)
      .in('entity_id', ids)

    if (cacheErr) console.error('Translation cache lookup failed:', cacheErr)

    const result: Record<string, string> = {}
    const cachedKeys = new Set<string>()
    for (const row of cached ?? []) {
      const match = uniqueItems.find((i) => i.id === row.entity_id && i.field === row.field)
      if (match) {
        const key = cacheKey(match)
        result[key] = row.translated_text
        cachedKeys.add(key)
      }
    }

    // 2. Translate whatever wasn't cached.
    const missing = uniqueItems.filter((i) => !cachedKeys.has(cacheKey(i)))
    if (missing.length > 0) {
      const translated = await translateBatch(
        missing.map((m) => m.text),
        LANG_NAMES[targetLang],
      )

      const rowsToInsert: {
        restaurant_id: string
        entity_type: 'item' | 'category'
        entity_id: string
        field: 'name' | 'description'
        lang: string
        translated_text: string
      }[] = []

      missing.forEach((m, idx) => {
        const value = translated[idx]
        // value is null when the Gemini call failed for this batch — show
        // the original text for now, but do NOT cache it as if it were a
        // real translation, so the next request retries instead of being
        // stuck serving English forever.
        result[cacheKey(m)] = value ?? m.text
        if (value) {
          rowsToInsert.push({
            restaurant_id: restaurantId,
            entity_type: m.type,
            entity_id: m.id,
            field: m.field,
            lang: targetLang,
            translated_text: value,
          })
        }
      })

      if (rowsToInsert.length > 0) {
        // Don't block the response on the cache write.
        void supabase
          .from('menu_translations')
          .upsert(rowsToInsert, { onConflict: 'entity_id,field,lang' })
          .then(({ error }) => {
            if (error) console.error('Failed to cache translations:', error)
          })
      }
    }

    return NextResponse.json({ translations: result })
  } catch (err) {
    console.error('Translate route error:', err)
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 })
  }
}

/**
 * Batch-translates an array of short menu strings via the Gemini API.
 * Returns `null` in place of any string it couldn't translate — the caller
 * shows the original English for those, but (importantly) does not cache
 * a null as if it were a real translation.
 */
async function translateBatch(texts: string[], targetLanguageName: string): Promise<(string | null)[]> {
  const model = 'gemini-2.5-flash'
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set — check .env.local and restart the dev server.')
    return texts.map(() => null)
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                `You translate restaurant menu text into ${targetLanguageName}. ` +
                `Keep translations natural and appetizing, the way a native-speaking menu would actually read — not a stiff literal translation. ` +
                `Leave proper nouns and dish names that are conventionally left untranslated as-is (e.g. "Paneer Tikka", "Margherita", "Cappuccino").`,
            },
          ],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: JSON.stringify(texts) }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
        },
      }),
    },
  )

  if (!res.ok) {
    console.error('Gemini translate call failed:', res.status, await res.text())
    return texts.map(() => null)
  }

  const data = await res.json()
  const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!raw) {
    console.error('Gemini returned no text. Full response:', JSON.stringify(data))
    return texts.map(() => null)
  }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length === texts.length) return parsed
    console.error('Gemini response shape mismatch:', raw)
    return texts.map(() => null)
  } catch (err) {
    console.error('Failed to parse Gemini response as JSON:', raw)
    return texts.map(() => null)
  }
}