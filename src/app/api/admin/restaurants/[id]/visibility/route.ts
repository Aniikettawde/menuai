// src/app/api/admin/restaurants/[id]/visibility/route.ts
import { NextResponse } from 'next/server'
import { getAdminUser, getServiceClient } from '@/lib/admin-guard'
import { syncRestaurantToDiscovery } from '@/lib/sync-to-discovery'

const ALLOWED_FIELDS = ['show_in_discovery', 'show_in_app'] as const
type AllowedField = (typeof ALLOWED_FIELDS)[number]

type Params = {
  params: Promise<{ id: string }> // Next.js 15+ params are async
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await getAdminUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const field = body?.field
  const value = body?.value

  if (!ALLOWED_FIELDS.includes(field)) {
    return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
  }
  if (typeof value !== 'boolean') {
    return NextResponse.json({ error: 'value must be boolean' }, { status: 400 })
  }

  const sb = getServiceClient()

  const { data, error } = await sb
    .from('restaurants')
    .update({ [field as AllowedField]: value })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error(`${field} update failed:`, error.message, { id, value })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Only show_in_discovery drives the discovery sync — show_in_app is a
  // separate, app-only visibility flag with no discovery-side effect.
  if (field === 'show_in_discovery') {
    try {
      await syncRestaurantToDiscovery(id)
    } catch (syncErr) {
      console.error('discovery sync failed after toggle:', syncErr)
      return NextResponse.json(
        { error: 'Restaurant updated but discovery sync failed', restaurant: data },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ ok: true, restaurant: data })
}