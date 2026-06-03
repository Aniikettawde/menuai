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

function normalizeMimeType(mimeType: string): string {
  const m = mimeType.trim().toLowerCase()
  if (m === 'image/jpg') return 'image/jpeg'
  return m
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
  if (mimeType?.startsWith('image/')) return 'menu-image'
  return 'menu-upload'
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

async function uploadToGeminiFilesApi(params: {
  base64: string
  mimeType: string
  fileName?: string
}): Promise<{ uri: string; mimeType: string }> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing')

  const { base64, mimeType, fileName } = params
  const displayName = safeDisplayName(fileName, mimeType)
  // Convert to ArrayBuffer — accepted by fetch as BodyInit in all environments
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

  if (!startRes.ok) {
    throw new Error(`File upload start failed: ${await readErrorMessage(startRes)}`)
  }

  const uploadUrl =
    startRes.headers.get('x-goog-upload-url') ||
    startRes.headers.get('X-Goog-Upload-URL')

  if (!uploadUrl) throw new Error('File upload failed: missing upload URL from Gemini')

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(byteLength),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    // ArrayBuffer is valid BodyInit — no Buffer, no Uint8Array
    body: arrayBuffer,
  })

  if (!uploadRes.ok) {
    throw new Error(`File upload finalize failed: ${await readErrorMessage(uploadRes)}`)
  }

  const uploaded = (await uploadRes.json()) as GeminiUploadFile
  const uri = uploaded?.file?.uri

  if (!uri) throw new Error('File upload succeeded but Gemini did not return a file URI')

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
        contents: [
          {
            role: 'user',
            parts: [part, { text: GEMINI_PROMPT }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
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

    const body = (await req.json().catch(() => null)) as ImportBody | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { base64Data, mimeType, fileName } = body

    if (!base64Data || !mimeType) {
      return NextResponse.json({ error: 'Missing base64Data or mimeType' }, { status: 400 })
    }

    const cleanMimeType = normalizeMimeType(mimeType)
    const cleanBase64 = stripDataUrlPrefix(base64Data)
    const byteSize = estimateBytesFromBase64(cleanBase64)
    const isPdf = cleanMimeType === 'application/pdf'
    const isImage = cleanMimeType.startsWith('image/')

    if (!isPdf && !isImage) {
      return NextResponse.json(
        { error: `Unsupported mimeType: ${cleanMimeType}. Use an image/* or application/pdf file.` },
        { status: 400 }
      )
    }

    let dataPart: Record<string, unknown>

    if (byteSize <= MAX_INLINE_BYTES) {
      dataPart = {
        inline_data: {
          mime_type: cleanMimeType,
          data: cleanBase64,
        },
      }
    } else {
      const uploaded = await uploadToGeminiFilesApi({
        base64: cleanBase64,
        mimeType: cleanMimeType,
        fileName,
      })

      dataPart = {
        file_data: {
          mime_type: uploaded.mimeType,
          file_uri: uploaded.uri,
        },
      }
    }

    const data = await callGeminiGenerateContent(dataPart)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Menu import route error:', error)
    const message = error instanceof Error ? error.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}