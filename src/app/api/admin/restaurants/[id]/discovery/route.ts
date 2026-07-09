import { NextResponse } from 'next/server'
import { getAdminUser, getServiceClient } from '@/lib/admin-guard'
import { syncRestaurantToDiscovery } from '@/lib/sync-to-discovery'

type Params = {
  params: Promise<{ id: string }>  // Next.js 15+ params are async
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
  const showInDiscovery = Boolean(body?.show_in_discovery)

  const sb = getServiceClient()
  const { data, error } = await sb
    .from('restaurants')
    .update({ show_in_discovery: showInDiscovery })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('show_in_discovery update failed:', error.message, { id, showInDiscovery })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  try {
    await syncRestaurantToDiscovery(id)
  } catch (syncErr) {
    console.error('discovery sync failed after toggle:', syncErr)
    return NextResponse.json(
      { error: 'Restaurant updated but discovery sync failed', restaurant: data },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, restaurant: data })
}