import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogAdminClient } from "@/lib/supabase/blog-admin-client";
import { BlogPost } from "@/lib/types/blog";

export const revalidate = 60;

const ACCENT = "#8b2635";
const TEXT_DARK = "#1a1a1a";
const TEXT_LIGHT = "#8a8a8a";
const SURFACE = "#f7f2ec";

async function getPost(slug: string): Promise<BlogPost | null> {
  const supabase = getBlogAdminClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !data) return null;
  return data as BlogPost;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return { title: "Post not found | Dinezy Blog" };

  return {
    title: `${post.seo_title || post.title} | Dinezy Blog`,
    description: post.seo_description || post.excerpt || undefined,
    openGraph: {
      title: post.seo_title || post.title,
      description: post.seo_description || post.excerpt || undefined,
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
      type: "article",
    },
  };
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  void incrementViewCount(post.id);

  return (
    <div className="min-h-screen bg-white">
      <article className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <Link
          href="/blog"
          className="text-sm font-medium mb-6 sm:mb-8 inline-flex items-center gap-1"
          style={{ color: ACCENT }}
        >
          ← Back to Blog
        </Link>

        {post.tags?.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full"
                style={{ background: SURFACE, color: ACCENT }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <h1
          className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-4 leading-tight"
          style={{ fontFamily: "'Fraunces', Georgia, serif", color: TEXT_DARK }}
        >
          {post.title}
        </h1>

        <p
          className="text-xs sm:text-sm mb-6 sm:mb-8 flex flex-wrap gap-x-2 gap-y-1"
          style={{ color: TEXT_LIGHT }}
        >
          <span>{post.author_name}</span>
          <span>·</span>
          <span>{formatDate(post.published_at)}</span>
          <span>·</span>
          <span>{post.read_time_minutes} min read</span>
        </p>

        {post.cover_image_url && (
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="w-full rounded-xl sm:rounded-2xl mb-8 object-cover max-h-64 sm:max-h-96"
          />
        )}

        <div
          className="blog-post-content"
          dangerouslySetInnerHTML={{ __html: post.content_html || "" }}
        />

        <div
          className="mt-12 pt-6 flex items-center justify-between flex-wrap gap-3"
          style={{ borderTop: "1px solid #e5e5e5" }}
        >
          <Link
            href="/blog"
            className="text-sm font-medium"
            style={{ color: ACCENT }}
          >
            ← More posts
          </Link>
        </div>

        <style>{`
          .blog-post-content {
            color: ${TEXT_DARK};
            font-size: 16px;
          }
          .blog-post-content h2 {
            font-family: 'Fraunces', Georgia, serif;
            font-size: 1.4rem;
            font-weight: 600;
            margin: 1.75rem 0 0.75rem;
            color: ${ACCENT};
          }
          @media (min-width: 640px) {
            .blog-post-content h2 { font-size: 1.6rem; margin: 2rem 0 0.75rem; }
          }
          .blog-post-content h3 {
            font-family: 'Fraunces', Georgia, serif;
            font-size: 1.15rem;
            font-weight: 600;
            margin: 1.5rem 0 0.5rem;
            color: ${TEXT_DARK};
          }
          .blog-post-content p {
            line-height: 1.75;
            margin: 0.9rem 0;
            color: ${TEXT_DARK};
          }
          .blog-post-content img {
            max-width: 100%;
            height: auto;
            border-radius: 0.75rem;
            margin: 1.5rem 0;
          }
          .blog-post-content blockquote {
            border-left: 3px solid ${ACCENT};
            padding-left: 1.1rem;
            font-style: italic;
            color: #555;
            margin: 1.5rem 0;
          }
          .blog-post-content ul, .blog-post-content ol {
            padding-left: 1.4rem;
            margin: 0.9rem 0;
            color: ${TEXT_DARK};
          }
          .blog-post-content li {
            margin: 0.35rem 0;
            line-height: 1.7;
          }
          .blog-post-content a {
            color: ${ACCENT};
            text-decoration: underline;
            word-break: break-word;
          }
          .blog-post-content code {
            background: ${SURFACE};
            color: ${TEXT_DARK};
            padding: 0.15rem 0.4rem;
            border-radius: 0.25rem;
            font-size: 0.9em;
            word-break: break-word;
          }
          .blog-post-content pre {
            background: #1e1e1e;
            color: #f5f5f5;
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-x: auto;
            font-size: 0.85rem;
          }
          .blog-post-content pre code {
            background: transparent;
            padding: 0;
          }
        `}</style>
      </article>
    </div>
  );
}

async function incrementViewCount(postId: string) {
  try {
    const supabase = getBlogAdminClient();
    await supabase.rpc("increment_blog_view_count", { post_id: postId });
  } catch {
    // non-critical, ignore failures silently
  }
}
