import { NextRequest, NextResponse } from "next/server";
import { getBlogAdminClient } from "@/lib/supabase/blog-admin-client";
import { BlogPostInput, slugify, estimateReadTime } from "@/lib/types/blog";

// GET /api/admin/blog - list all posts (draft + published) for admin panel
export async function GET(req: NextRequest) {
  try {
    const supabase = getBlogAdminClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // optional filter

    let query = supabase
      .from("blog_posts")
      .select(
        "id, title, slug, excerpt, cover_image_url, tags, author_name, read_time_minutes, published_at, status, created_at, updated_at"
      )
      .order("updated_at", { ascending: false });

    if (status === "draft" || status === "published") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ posts: data });
  } catch (err: any) {
    console.error("GET /api/admin/blog error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/admin/blog - create a new post
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<BlogPostInput> & { title: string };

    if (!body.title || !body.content_html) {
      return NextResponse.json(
        { error: "title and content are required" },
        { status: 400 }
      );
    }

    const supabase = getBlogAdminClient();

    const baseSlug = body.slug?.trim() ? slugify(body.slug) : slugify(body.title);
    const slug = await ensureUniqueSlug(supabase, baseSlug);

    const readTime = body.read_time_minutes ?? estimateReadTime(body.content_html);

    const insertPayload = {
      title: body.title,
      slug,
      excerpt: body.excerpt ?? null,
      content: body.content ?? {},
      content_html: body.content_html,
      cover_image_url: body.cover_image_url ?? null,
      status: body.status ?? "draft",
      tags: body.tags ?? [],
      author_name: body.author_name ?? "Dinezy Team",
      seo_title: body.seo_title ?? body.title,
      seo_description: body.seo_description ?? body.excerpt ?? null,
      read_time_minutes: readTime,
      published_at: body.status === "published" ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from("blog_posts")
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ post: data }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/admin/blog error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function ensureUniqueSlug(
  supabase: ReturnType<typeof getBlogAdminClient>,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const { data } = await supabase
      .from("blog_posts")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!data) return slug;
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
}
