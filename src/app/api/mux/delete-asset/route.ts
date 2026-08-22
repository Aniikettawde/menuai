import { NextRequest, NextResponse } from 'next/server'
import Mux from '@mux/mux-node'
import { getDiscoveryServer } from '@/lib/discovery'

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

/**
 * Called by the Android/web app when a customer deletes their own video
 * post. No Mux credential ever reaches the client — same trust boundary as
 * /api/mux/create-upload.
 *
 * We look up `mux_asset_id` for `postId` from `discovery.posts` (set by the
 * webhook once video.asset.ready fires — see /api/mux/webhook) rather than
 * trusting an asset id passed in from the client, so a caller can't pass an
 * arbitrary assetId and delete someone else's Mux asset.
 *
 * If the post has no mux_asset_id yet (still "preparing", or was never a
 * video), there's nothing on Mux to delete — that's treated as success
 * rather than an error, since the end state (no Mux asset for this post)
 * is the same either way.
 *
 * NOTE: same as create-upload, this route has no auth check yet — anyone
 * who finds the URL and a valid postId could delete that post's Mux asset.
 * Worth gating behind your Firebase auth (verifying the caller actually
 * owns postId) once that matters — the Android-side deletePost already
 * scopes the `posts` row delete to customer_id, but this route doesn't
 * currently re-check that.
 */
export async function POST(req: NextRequest) {
  const { postId } = await req.json().catch(() => ({}))
  if (!postId || typeof postId !== 'string') {
    return NextResponse.json({ error: 'postId is required' }, { status: 400 })
  }

  const supabase = getDiscoveryServer()

  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('mux_asset_id')
    .eq('id', postId)
    .maybeSingle()

  if (fetchError) {
    console.error('Failed to look up post for asset deletion', postId, fetchError)
    return NextResponse.json({ error: 'Could not look up post' }, { status: 500 })
  }

  const assetId = post?.mux_asset_id as string | null | undefined
  if (!assetId) {
    // Nothing to delete on Mux (never a video, or still preparing) — not an error.
    return NextResponse.json({ deleted: false })
  }

  try {
    await mux.video.assets.delete(assetId)
  } catch (err: any) {
    // Mux returns 404 if the asset is already gone — treat that as success
    // rather than surfacing an error for a state that's already correct.
    if (err?.status !== 404) {
      console.error('Failed to delete Mux asset', assetId, 'for post', postId, err)
      return NextResponse.json({ error: 'Could not delete video' }, { status: 500 })
    }
  }

  return NextResponse.json({ deleted: true })
}