import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

const MAX_INLINE_BYTES = 15 * 1024 * 1024
const MAX_RETRIES = 2

// ─── Prompt ───────────────────────────────────────────────────────────────────
// Compact prompt = fewer output tokens wasted on formatting explanation
const GEMINI_PROMPT = `You are a menu digitization expert for Indian restaurants.

Extract EVERY item from this menu. Output ONLY raw JSON — no markdown, no backticks, no explanation.

JSON structure (strict):
{"categories":[{"name":"Category Name","items":[{"name":"Item Name","description":"","price":0,"is_veg":true,"tags":[]}]}]}

Rules:
- name: Title Case (e.g. "Paneer Butter Masala")
- price: integer only (226.00 → 226). No price → 0. "SEASONAL" → 0
- is_veg: true for all veg items. false ONLY if clearly non-veg (meat/chicken/fish/egg)
- tags: [] unless menu explicitly marks spicy/bestseller/chef-special/jain
- description: "" unless menu shows a description. For sizzlers/thalis with descriptions, include it briefly
- Extract ALL items from ALL columns on ALL pages
- Do NOT skip any category or item
- Do NOT add commentary before or after JSON
- Multi-word items broken across lines should be joined (e.g. "CHEESE MYSORE SADA\nDOSA" → "Cheese Mysore Sada Dosa")
- Items with "(ONLY FRI, SAT & SUN)" → keep item, add tag "weekend-special"
- Items marked with spicy symbol (🌶 or J) → add tag "spicy"
- Items marked with Jain symbol → add tag "jain"
- Items marked with Chef special (T or 🍴) → add tag "chef-special"
- Price variants like "160/110" or "F/H" → use the first/full price only
- "SEASONAL" price → 0`

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportBody = {
  base64Data?: string
  mimeType?: string
  fileName?: string
}

type GeminiUploadFile = {
  file?: {
    uri?: string
    mimeType?: string
    state?: string
    displayName?: string
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeMimeType(mimeType: string): string {
  const m = mimeType.trim().toLowerCase()
  if (m === 'image/jpg') return 'image/jpeg'
  if (m === 'image/heic' || m === 'image/heif') return 'image/jpeg'
  return m
}

function isSupportedMimeType(mimeType: string): boolean {
  const supported = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'image/gif', 'image/heic', 'image/heif', 'application/pdf',
  ]
  return supported.includes(mimeType.trim().toLowerCase())
}

function stripDataUrlPrefix(input: string): string {
  return input.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '')
}

function estimateBytesFromBase64(base64: string): number {
  return Buffer.byteLength(base64, 'base64')
}

function safeDisplayName(fileName?: string, mimeType?: string): string {
  if (fileName && fileName.trim()) return fileName.trim()
  if (mimeType?.includes('pdf')) return 'menu.pdf'
  return 'menu-image.jpg'
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  if (!text) return `${res.status} ${res.statusText}`
  try {
    const json = JSON.parse(text)
    return json?.error?.message ?? json?.message ?? text.slice(0, 2000)
  } catch {
    return text.slice(0, 2000)
  }
}

// ─── Image processing ─────────────────────────────────────────────────────────

async function processImage(
  base64: string,
  mimeType: string,
  byteSize: number,
): Promise<{ base64: string; mimeType: string }> {
  const isHeic = mimeType === 'image/heic' || mimeType === 'image/heif'
  const isTooBig = byteSize > 4 * 1024 * 1024
  if (!isHeic && !isTooBig) return { base64, mimeType }
  try {
    const sharp = (await import('sharp')).default
    const buffer = Buffer.from(base64, 'base64')
    const compressed = await sharp(buffer)
      .rotate()
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
    console.log('[menu-import] sharp processed:', Math.round(compressed.length / 1024), 'KB')
    return { base64: compressed.toString('base64'), mimeType: 'image/jpeg' }
  } catch (e) {
    console.warn('[menu-import] sharp unavailable:', e)
    return { base64, mimeType }
  }
}

// ─── Gemini Files API upload ──────────────────────────────────────────────────

async function uploadToGeminiFilesApi(params: {
  base64: string
  mimeType: string
  fileName?: string
}): Promise<{ uri: string; mimeType: string }> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing')
  const { base64, mimeType, fileName } = params
  const displayName = safeDisplayName(fileName, mimeType)
  const arrayBuffer = Buffer.from(base64, 'base64').buffer as ArrayBuffer
  const byteLength = arrayBuffer.byteLength

  const startRes = await fetch(`${GEMINI_BASE_URL}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': GEMINI_API_KEY,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(byteLength),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  })
  if (!startRes.ok) throw new Error(`Upload start failed: ${await readErrorMessage(startRes)}`)

  const uploadUrl =
    startRes.headers.get('x-goog-upload-url') ||
    startRes.headers.get('X-Goog-Upload-URL')
  if (!uploadUrl) throw new Error('Upload failed: missing upload URL from Gemini')

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(byteLength),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: arrayBuffer,
  })
  if (!uploadRes.ok) throw new Error(`Upload finalize failed: ${await readErrorMessage(uploadRes)}`)

  const uploaded = (await uploadRes.json()) as GeminiUploadFile
  const uri = uploaded?.file?.uri
  if (!uri) throw new Error('Upload succeeded but Gemini did not return a file URI')
  return { uri, mimeType: uploaded.file?.mimeType || mimeType }
}

// ─── JSON extraction ──────────────────────────────────────────────────────────
// Handles truncated JSON by trying to salvage complete categories

function extractAndRepairJson(rawText: string): string {
  // Strip markdown fences if any
  let clean = rawText
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/m, '')
    .trim()

  // Find JSON boundaries
  const start = clean.indexOf('{')
  if (start === -1) throw new Error('No JSON object found in Gemini response')
  clean = clean.slice(start)

  // Try parsing as-is first (happy path)
  try {
    JSON.parse(clean)
    return clean
  } catch {
    // Response is truncated — try to repair
  }

  // Strategy 1: find last complete category block
  // Walk backwards to find the last complete "}]}" pattern
  const repairAttempts = [
    // Close open item array + category + categories array
    clean + ']}]}',
    // Close open item + item array + category + categories
    clean + '"}]}]}',
    // Close open string + item + arrays
    clean + '","is_veg":true,"tags":[]}]}]}',
  ]

  for (const attempt of repairAttempts) {
    try {
      JSON.parse(attempt)
      console.log('[menu-import] JSON repaired successfully')
      return attempt
    } catch {
      // try next
    }
  }

  // Strategy 2: find last complete category and truncate there
  // Look for last occurrence of complete category: }] pattern followed by }, or }]}
  const categoryEndPattern = /\}\s*\]\s*\}/g
  let lastValidEnd = -1
  let match
  while ((match = categoryEndPattern.exec(clean)) !== null) {
    lastValidEnd = match.index + match[0].length
  }

  if (lastValidEnd > 0) {
    const truncated = clean.slice(0, lastValidEnd) + ']}'
    try {
      JSON.parse(truncated)
      console.log('[menu-import] JSON truncated to last valid category')
      return truncated
    } catch {
      // fall through
    }
  }

  throw new Error(
    'Could not parse Gemini response as JSON. Menu may be too large — try uploading 3-4 pages at a time.',
  )
}

// ─── Gemini generate content with retry ──────────────────────────────────────

async function callGeminiGenerateContent(
  part: Record<string, unknown>,
  attempt = 0,
): Promise<unknown> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing')

  const response = await fetch(
    `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [part, { text: GEMINI_PROMPT }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 65536,  // Flash supports up to 65k — needed for large menus
          responseMimeType: 'application/json', // Force JSON mode — reduces formatting tokens
          thinkingConfig: { thinkingBudget: 0 }, // No thinking needed for extraction
        },
      }),
    },
  )

  // Retry on 429 / 503 / 500
  if (!response.ok) {
    const errMsg = await readErrorMessage(response)
    const isRetryable = response.status === 429 || response.status === 503 || response.status === 500
    if (isRetryable && attempt < MAX_RETRIES) {
      const delay = (attempt + 1) * 3000
      console.log(`[menu-import] Retrying after ${delay}ms (attempt ${attempt + 1})`)
      await new Promise((r) => setTimeout(r, delay))
      return callGeminiGenerateContent(part, attempt + 1)
    }
    throw new Error(`Gemini API error: ${errMsg}`)
  }

  return response.json()
}

// ─── Validate + normalize parsed menu ────────────────────────────────────────

type RawItem = {
  name?: unknown
  description?: unknown
  price?: unknown
  is_veg?: unknown
  tags?: unknown
}

type RawCategory = {
  name?: unknown
  items?: unknown
}

type RawMenu = {
  categories?: unknown
}

function normalizeMenu(raw: RawMenu) {
  if (!raw?.categories || !Array.isArray(raw.categories)) {
    throw new Error('Invalid menu structure: missing categories array')
  }

  const categories = (raw.categories as RawCategory[])
    .map((cat) => {
      const name = typeof cat.name === 'string' ? cat.name.trim() : 'Uncategorized'
      const items = Array.isArray(cat.items)
        ? (cat.items as RawItem[])
            .filter((item) => typeof item.name === 'string' && item.name.trim())
            .map((item) => ({
              name: String(item.name).trim(),
              description: typeof item.description === 'string' ? item.description.trim() : '',
              price: typeof item.price === 'number' ? Math.round(item.price) : 0,
              is_veg: item.is_veg !== false, // default true
              tags: Array.isArray(item.tags)
                ? item.tags.map((t) => String(t).trim()).filter(Boolean)
                : [],
            }))
        : []
      return { name, items }
    })
    .filter((cat) => cat.items.length > 0)

  if (categories.length === 0) {
    throw new Error('No menu items detected. Try a higher-resolution image or a clearer photo.')
  }

  return { categories }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    // Parse body
    let body: ImportBody | null = null
    try {
      body = (await req.json()) as ImportBody
    } catch {
      return NextResponse.json(
        { error: 'Could not parse request. The file may be too large — try a smaller photo.' },
        { status: 400 },
      )
    }

    const { base64Data, mimeType, fileName } = body ?? {}
    if (!base64Data || !mimeType) {
      return NextResponse.json({ error: 'Missing base64Data or mimeType' }, { status: 400 })
    }

    if (!isSupportedMimeType(mimeType)) {
      return NextResponse.json(
        { error: `Unsupported file type "${mimeType}". Please use JPG, PNG, WEBP, or PDF.` },
        { status: 400 },
      )
    }

    const normalizedMime = normalizeMimeType(mimeType)
    const cleanBase64 = stripDataUrlPrefix(base64Data)
    const byteSize = estimateBytesFromBase64(cleanBase64)
    console.log('[menu-import] size:', Math.round(byteSize / 1024), 'KB | mime:', normalizedMime)

    // Process image (HEIC re-encode + resize)
    let finalBase64 = cleanBase64
    let finalMime = normalizedMime
    if (normalizedMime.startsWith('image/')) {
      const processed = await processImage(cleanBase64, normalizedMime, byteSize)
      finalBase64 = processed.base64
      finalMime = processed.mimeType
    }

    // Build Gemini part
    const finalByteSize = estimateBytesFromBase64(finalBase64)
    let dataPart: Record<string, unknown>

    if (finalByteSize <= MAX_INLINE_BYTES) {
      dataPart = { inline_data: { mime_type: finalMime, data: finalBase64 } }
    } else {
      console.log('[menu-import] File too large for inline, uploading to Files API…')
      const uploaded = await uploadToGeminiFilesApi({
        base64: finalBase64,
        mimeType: finalMime,
        fileName,
      })
      dataPart = { file_data: { mime_type: uploaded.mimeType, file_uri: uploaded.uri } }
    }

    // Call Gemini
    const geminiResponse = await callGeminiGenerateContent(dataPart)

    // Extract text from response
    const data = geminiResponse as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
        finishReason?: string
      }>
      error?: { message?: string }
    }

    if (data?.error?.message) {
      throw new Error(`Gemini error: ${data.error.message}`)
    }

    const candidate = data?.candidates?.[0]
    if (!candidate) throw new Error('Gemini returned no candidates')

    // Log finish reason — useful for debugging truncation
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      console.warn('[menu-import] Gemini finishReason:', candidate.finishReason)
    }

    const rawText = candidate?.content?.parts?.[0]?.text ?? ''
    if (!rawText.trim()) {
      throw new Error('Gemini returned an empty response. Try a clearer image.')
    }

    // Parse + repair JSON
    const repairedJson = extractAndRepairJson(rawText)
    const parsed = JSON.parse(repairedJson) as RawMenu

    // Normalize + validate
    const normalized = normalizeMenu(parsed)

    const totalItems = normalized.categories.reduce((sum, c) => sum + c.items.length, 0)
    console.log(
      `[menu-import] Success: ${normalized.categories.length} categories, ${totalItems} items`,
      candidate.finishReason !== 'STOP' ? `(repaired, finishReason: ${candidate.finishReason})` : '',
    )

    // Return in same shape as before so client code needs no changes
    return NextResponse.json({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(normalized) }],
          },
          finishReason: candidate.finishReason ?? 'STOP',
        },
      ],
    })
  } catch (error) {
    console.error('[menu-import] error:', error)
    const message = error instanceof Error ? error.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}