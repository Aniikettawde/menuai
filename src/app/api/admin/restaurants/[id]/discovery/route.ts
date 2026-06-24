import { NextResponse } from 'next/server'
import { getAdminUser, getServiceClient } from '@/lib/admin-guard'

type Params = {
  params: { id: string }
}

export async function PATCH(
  req: Request,
  { params }: Params
) {
  const user = await getAdminUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const body = await req.json().catch(() => null)

  const showInDiscovery = Boolean(
    body?.show_in_discovery
  )

  const sb = getServiceClient()

  const { data, error } = await sb
    .from('restaurants')
    .update({
      show_in_discovery: showInDiscovery,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    restaurant: data,
  })
}