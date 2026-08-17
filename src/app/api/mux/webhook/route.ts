import { NextRequest, NextResponse } from 'next/server'
import Mux from '@mux/mux-node'
import { getDiscoveryServer } from '@/lib/discovery'

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
  webhookSecret: process.env.MUX_WEBHOOK_SECRET!,
})

/**
 * Mux calls this once a direct-uploaded video finishes transcoding (or
 * fails). We match the event back to a `discovery.posts` row via the
 * `passthrough` field, which is the post's own id (set when the upload was
 * created — see /api/mux/create-upload).
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  let event
  try {
    event = await mux.webhooks.unwrap(rawBody, req.headers)
  } catch (err) {
    console.error('Mux webhook signature verification failed', err)
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  const supabase = getDiscoveryServer()

  switch (event.type) {
    case 'video.asset.ready': {
  const asset = event.data as any
  const postId = asset.passthrough as string | undefined
  const playbackId = asset.playback_ids?.[0]?.id as string | undefined
  if (!postId || !playbackId) break
  const { data, error } = await supabase
    .from('posts')
    .update({
      mux_asset_id: asset.id,
      mux_playback_id: playbackId,
      video_status: 'ready',
    })
    .eq('id', postId)
    .select('id')          // <-- makes Supabase return which rows were actually updated
  if (error) {
    console.error('Failed to mark post ready', postId, error)
  } else if (!data || data.length === 0) {
    console.error('Webhook fired but no matching post row found for', postId)  // <-- this is the case that was silent before
  }
  break
}

    case 'video.asset.errored': {
      const asset = event.data as any
      const postId = asset.passthrough as string | undefined
      if (!postId) break

      const { error } = await supabase
        .from('posts')
        .update({ video_status: 'errored' })
        .eq('id', postId)

      if (error) console.error('Failed to mark post errored', postId, error)
      break
    }

    default:
      // Ignore video.upload.* and everything else.
      break
  }

  return NextResponse.json({ received: true })
}