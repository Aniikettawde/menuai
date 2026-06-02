// src/app/api/menu-import/route.ts
import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

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

export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY missing' }, { status: 500 })
    }

    const { base64Data, mimeType } = await req.json()

    if (!base64Data || !mimeType) {
      return NextResponse.json({ error: 'Missing base64Data or mimeType' }, { status: 400 })
    }

    // For PDFs use document type, for images use inlineData
    const isPdf = mimeType === 'application/pdf'

    const part = isPdf
      ? {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Data,
          },
        }
      : {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
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

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      console.error('Gemini API error:', err)
      return NextResponse.json(
        { error: err?.error?.message ?? `Gemini error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Menu import route error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}