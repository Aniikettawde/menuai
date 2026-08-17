import { NextRequest, NextResponse } from 'next/server'
import Mux from '@mux/mux-node'

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

/**
 * Called by the Android app right before it streams a picked video to Mux.
 * No Mux credential ever reaches the device — this route is the only thing
 * that talks to Mux with the real API secret.
 *
 * `postId` is a UUID the app generates client-side and inserts as the
 * `discovery.posts.id` for that row. We pass it through as Mux's
 * `passthrough` so the webhook (see /api/mux/webhook) can match the
 * finished asset back to the right post without a separate lookup table.
 *
 * NOTE: this route has no auth check yet — anyone who finds the URL could
 * spin up empty Mux uploads on your account. Low risk while traction is
 * small, but worth gating behind your Firebase auth once that matters.
 */
export async function POST(req: NextRequest) {
  const { postId } = await req.json().catch(() => ({}))

  if (!postId || typeof postId !== 'string') {
    return NextResponse.json({ error: 'postId is required' }, { status: 400 })
  }

  const upload = await mux.video.uploads.create({
    cors_origin: '*',
    new_asset_settings: {
      playback_policy: ['public'],
      passthrough: postId,
    },
  })

  return NextResponse.json({
    uploadUrl: upload.url,
    uploadId: upload.id,
  })
}