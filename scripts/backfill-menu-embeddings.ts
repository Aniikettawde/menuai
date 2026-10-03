import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2'

const PAGE_SIZE = 100
const CONCURRENCY = 4

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY before running this script.')
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type MenuRow = {
  id: string
  name: string
  description: string | null
  category_id: string | null
  is_veg: boolean | null
  tags: string[] | null
  allergens: string[] | null
}

type EmbeddingResponse = {
  embedding?: { values?: unknown }
}

async function embed(text: string): Promise<number[]> {
  const response = await fetch(`${GEMINI_BASE_URL}/models/${GEMINI_EMBEDDING_MODEL}:embedContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY!,
    },
    body: JSON.stringify({
      content: {
        parts: [
          {
            text: `task: search result | document: ${text.slice(0, 3000)}`,
          },
        ],
      },
      output_dimensionality: 768,
    }),
  })

  if (!response.ok) {
    throw new Error(`Gemini embedding failed: ${response.status} ${await response.text()}`)
  }

  const data = (await response.json()) as EmbeddingResponse
  const values = data.embedding?.values
  if (!Array.isArray(values)) throw new Error('Gemini returned no embedding.')

  const vector = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (vector.length !== 768) throw new Error(`Expected 768 dimensions, received ${vector.length}.`)
  return vector
}

function buildDocument(row: MenuRow, categoryName: string): string {
  return [
    `name: ${row.name}`,
    `description: ${row.description || ''}`,
    `category: ${categoryName}`,
    `diet: ${row.is_veg === true ? 'vegetarian' : row.is_veg === false ? 'non-vegetarian' : ''}`,
    `tags: ${(row.tags ?? []).join(', ')}`,
    `allergens: ${(row.allergens ?? []).join(', ')}`,
  ].join('\n')
}

async function main() {
  const categoryMap = new Map<string, string>()
  const { data: categories, error: categoryError } = await supabase
    .from('menu_categories')
    .select('id,name')

  if (categoryError) throw categoryError
  for (const row of categories ?? []) {
    if (row.id && row.name) categoryMap.set(String(row.id), String(row.name))
  }

  let offset = 0
  let processed = 0
  let succeeded = 0

  while (true) {
    const { data, error } = await supabase
      .from('menu_items')
      .select('id,name,description,category_id,is_veg,tags,allergens')
      .is('embedding', null)
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) throw error
    const rows = (data ?? []) as MenuRow[]
    if (!rows.length) break

    for (let start = 0; start < rows.length; start += CONCURRENCY) {
      const batch = rows.slice(start, start + CONCURRENCY)
      await Promise.all(
        batch.map(async (row) => {
          processed += 1
          try {
            const vector = await embed(buildDocument(row, categoryMap.get(row.category_id || '') || ''))
            const { error: updateError } = await supabase
              .from('menu_items')
              .update({ embedding: vector })
              .eq('id', row.id)

            if (updateError) throw updateError
            succeeded += 1
            process.stdout.write(`\rEmbedded ${succeeded}/${processed}`)
          } catch (error) {
            console.error(`\nFailed ${row.id}:`, error)
          }
        }),
      )
    }

    if (rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  process.stdout.write(`\nDone. Successfully embedded ${succeeded} of ${processed}.\n`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
