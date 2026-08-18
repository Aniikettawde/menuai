import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role client: bypasses RLS so we can read image_url + name across
// every restaurant. Never expose this key to the browser — this file only
// runs on the server.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET() {
  try {
    const [{ data: menuItems, error: itemsError }, { data: menuCats, error: catsError }] = await Promise.all([
      supabaseAdmin
        .from('menu_items')
        .select('image_url, name')
        .not('image_url', 'is', null)
        .neq('image_url', '')
        .order('created_at', { ascending: false })
        .limit(500),
      supabaseAdmin
        .from('menu_categories')
        .select('image_url, name')
        .not('image_url', 'is', null)
        .neq('image_url', '')
        .order('created_at', { ascending: false })
        .limit(200),
    ])

    if (itemsError) throw itemsError
    if (catsError) throw catsError

    const seen = new Set<string>()
    const images: { url: string; label: string }[] = []

    for (const row of menuItems ?? []) {
      if (row.image_url && !seen.has(row.image_url)) {
        seen.add(row.image_url)
        images.push({ url: row.image_url, label: row.name })
      }
    }
    for (const row of menuCats ?? []) {
      if (row.image_url && !seen.has(row.image_url)) {
        seen.add(row.image_url)
        images.push({ url: row.image_url, label: `${row.name} (category)` })
      }
    }

    return NextResponse.json({ images })
  } catch (err) {
    console.error('Image library fetch error:', err)
    return NextResponse.json({ error: 'Failed to load image library' }, { status: 500 })
  }
}