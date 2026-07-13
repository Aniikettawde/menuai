import { NextRequest, NextResponse } from "next/server";
import { getBlogAdminClient } from "@/lib/supabase/blog-admin-client";
import { BlogPostInput, slugify, estimateReadTime } from "@/lib/types/blog";

interface Params {
  params: { id: string };
}

// GET /api/admin/blog/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const supabase = getBlogAdminClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) throw error;
    return NextResponse.json({ post: data });
  } catch (err: any) {
    console.error("GET /api/admin/blog/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}

// PUT /api/admin/blog/[id] - update post (also handles publish/unpublish)
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const body = (await req.json()) as Partial<BlogPostInput>;
    const supabase = getBlogAdminClient();

    // fetch current row to know previous status (for published_at logic) and slug
    const { data: existing, error: fetchErr } = await supabase
      .from("blog_posts")
      .select("status, slug, published_at")
      .eq("id", params.id)
      .single();
    if (fetchErr) throw fetchErr;

    const updatePayload: Record<string, unknown> = {};

    if (body.title !== undefined) updatePayload.title = body.title;
    if (body.excerpt !== undefined) updatePayload.excerpt = body.excerpt;
    if (body.content !== undefined) updatePayload.content = body.content;
    if (body.content_html !== undefined) {
      updatePayload.content_html = body.content_html;
      updatePayload.read_time_minutes =
        body.read_time_minutes ?? estimateReadTime(body.content_html);
    }
    if (body.cover_image_url !== undefined)
      updatePayload.cover_image_url = body.cover_image_url;
    if (body.tags !== undefined) updatePayload.tags = body.tags;
    if (body.seo_title !== undefined) updatePayload.seo_title = body.seo_title;
    if (body.seo_description !== undefined)
      updatePayload.seo_description = body.seo_description;

    if (body.slug !== undefined && body.slug !== existing.slug) {
      updatePayload.slug = await ensureUniqueSlug(supabase, slugify(body.slug), params.id);
    }

    if (body.status !== undefined && body.status !== existing.status) {
      updatePayload.status = body.status;
      if (body.status === "published" && !existing.published_at) {
        updatePayload.published_at = new Date().toISOString();
      }
      if (body.status === "draft") {
        // keep original published_at so re-publishing doesn't lose history;
        // comment out the next line if you want to clear it on unpublish
        // updatePayload.published_at = null;
      }
    }

    const { data, error } = await supabase
      .from("blog_posts")
      .update(updatePayload)
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ post: data });
  } catch (err: any) {
    console.error("PUT /api/admin/blog/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/admin/blog/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const supabase = getBlogAdminClient();
    const { error } = await supabase.from("blog_posts").delete().eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/admin/blog/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function ensureUniqueSlug(
  supabase: ReturnType<typeof getBlogAdminClient>,
  baseSlug: string,
  excludeId: string
): Promise<string> {
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const { data } = await supabase
      .from("blog_posts")
      .select("id")
      .eq("slug", slug)
      .neq("id", excludeId)
      .maybeSingle();

    if (!data) return slug;
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
}
