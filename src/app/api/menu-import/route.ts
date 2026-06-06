import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

const MAX_INLINE_BYTES = 15 * 1024 * 1024

const GEMINI_PROMPT = `You are a menu digitization expert for Indian restaurants.

Analyze this menu image or document carefully and extract ALL items.

Indian menus typically look like:
- Category name as a header (e.g. "appetizers", "main course", "roti", "rice", "dal", "papad")
- Items listed below as "item name : price" or "item name - price" or just "item name  price"
- Multiple columns on the same page
- Prices are in INR (₹), often shown as "226.00" or "226" — return just the number without decimals (e.g. 226)
- Some items may have variants in brackets like "(malai/achari/hariyali)" — treat the main name as one item
- Some items may have no price listed — return price as 0
- All items on an Indian veg restaurant menu are vegetarian unless clearly labeled otherwise

Return ONLY a valid JSON object with NO markdown fences, NO backticks, NO explanation. Just raw JSON.

Use this exact structure:
{
  "categories": [
    {
      "name": "Category Name",
      "items": [
        {
          "name": "Item Name",
          "description": "",
          "price": 226,
          "is_veg": true,
          "tags": []
        }
      ]
    }
  ]
}

Rules:
- "name": title-case the item name (e.g. "Paneer Butter Masala")
- "price": integer only, no decimals. If price is "226.00" return 226. If no price, return 0
- "is_veg": true unless the item clearly contains meat/chicken/fish/egg/non-veg
- "tags": array of strings like ["spicy", "bestseller", "new", "chef-special", "must-try"] — only add if explicitly marked on the menu, otherwise empty array []
- "description": empty string "" unless a description is visible on the menu
- Extract ALL items visible, even partially visible ones
- Do NOT skip any category or item
- If multiple columns exist, process all columns
- Group items under the correct category name exactly as shown`

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

// Normalize mobile mime types to what Gemini accepts
function normalizeMimeType(mimeType: string): string {
  const m = mimeType.trim().toLowerCase()
  if (m === 'image/jpg') return 'image/jpeg'
  // HEIC/HEIF (iPhone default format) — Gemini doesn't support it,
  // but we re-encode to JPEG via sharp before sending
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
    return json?.error?.message ?? json?.message ?? text.slice(0, 1000)
  } catch {
    return text.slice(0, 1000)
  }
}

// Compress + auto-rotate image using sharp (handles HEIC, large mobile photos, EXIF rotation)
async function processImage(base64: string, mimeType: string, byteSize: number): Promise<{ base64: string; mimeType: string }> {
  const isHeic = mimeType === 'image/heic' || mimeType === 'image/heif'
  const isTooBig = byteSize > 4 * 1024 * 1024

  // Only process if HEIC (must re-encode) or oversized (should compress)
  if (!isHeic && !isTooBig) return { base64, mimeType }

  try {
    const sharp = (await import('sharp')).default
    const buffer = Buffer.from(base64, 'base64')
    const compressed = await sharp(buffer)
      .rotate()                                                    // auto-fix EXIF rotation (mobile camera)
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
    console.log('[menu-import] sharp processed:', Math.round(compressed.length / 1024), 'KB')
    return { base64: compressed.toString('base64'), mimeType: 'image/jpeg' }
  } catch (e) {
    // sharp not installed — fall through and let Gemini handle it
    console.warn('[menu-import] sharp unavailable, sending original:', e)
    return { base64, mimeType }
  }
}

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

  const uploadUrl = startRes.headers.get('x-goog-upload-url') || startRes.headers.get('X-Goog-Upload-URL')
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

async function callGeminiGenerateContent(part: Record<string, unknown>) {
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
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  )
  if (!response.ok) throw new Error(await readErrorMessage(response))
  return response.json()
}

export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY missing' }, { status: 500 })
    }

    let body: ImportBody | null = null
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'Could not parse request. The image may be too large — try a smaller photo.' },
        { status: 400 }
      )
    }

    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

    const { base64Data, mimeType, fileName } = body
    if (!base64Data || !mimeType) {
      return NextResponse.json({ error: 'Missing base64Data or mimeType' }, { status: 400 })
    }

    console.log('[menu-import] received mimeType:', mimeType, '| fileName:', fileName ?? 'none')

    if (!isSupportedMimeType(mimeType)) {
      return NextResponse.json(
        { error: `Unsupported file type "${mimeType}". Please use JPG, PNG, WEBP, or PDF.` },
        { status: 400 }
      )
    }

    const normalizedMime = normalizeMimeType(mimeType)
    const cleanBase64 = stripDataUrlPrefix(base64Data)
    const byteSize = estimateBytesFromBase64(cleanBase64)
    console.log('[menu-import] size:', Math.round(byteSize / 1024), 'KB | mime:', normalizedMime)

    // Process image: HEIC re-encode + resize/rotate for mobile photos
    let finalBase64 = cleanBase64
    let finalMime = normalizedMime
    if (normalizedMime.startsWith('image/')) {
      const processed = await processImage(cleanBase64, normalizedMime, byteSize)
      finalBase64 = processed.base64
      finalMime = processed.mimeType
    }

    const finalByteSize = estimateBytesFromBase64(finalBase64)
    let dataPart: Record<string, unknown>

    if (finalByteSize <= MAX_INLINE_BYTES) {
      dataPart = { inline_data: { mime_type: finalMime, data: finalBase64 } }
    } else {
      const uploaded = await uploadToGeminiFilesApi({ base64: finalBase64, mimeType: finalMime, fileName })
      dataPart = { file_data: { mime_type: uploaded.mimeType, file_uri: uploaded.uri } }
    }

    const data = await callGeminiGenerateContent(dataPart)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[menu-import] error:', error)
    const message = error instanceof Error ? error.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}