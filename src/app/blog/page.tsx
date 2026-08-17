import { Metadata } from "next";
import Link from "next/link";
import { getBlogAdminClient } from "@/lib/supabase/blog-admin-client";
import { BlogPostListItem } from "@/lib/types/blog";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

export const revalidate = 60; // ISR: re-fetch at most once a minute

const ACCENT = "#8b2635";
const TEXT_DARK = "#1a1a1a";
const TEXT_MED = "#525252";
const TEXT_LIGHT = "#8a8a8a";
const BORDER = "#e5e5e5";
const SURFACE = "#fafafa";

export const metadata: Metadata = {
  title: "Blog | Dinezy",
  description:
    "Insights on restaurant tech, QR menus, customer loyalty and running a smarter restaurant in Pune.",
};

async function getPublishedPosts(): Promise<BlogPostListItem[]> {
  const supabase = getBlogAdminClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(
      "id, title, slug, excerpt, cover_image_url, tags, author_name, read_time_minutes, published_at, status"
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Error fetching blog posts:", error);
    return [];
  }
  return data as BlogPostListItem[];
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function BlogListingPage() {
  const posts = await getPublishedPosts();
  const [featured, ...rest] = posts;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-semibold mb-3 tracking-tight"
            style={{ fontFamily: "'Fraunces', Georgia, serif", color: TEXT_DARK }}
          >
            The Dinezy Blog
          </h1>
          <p
            className="max-w-xl mx-auto text-sm sm:text-base px-4"
            style={{ color: TEXT_MED }}
          >
            Stories and ideas on restaurant tech, digital menus, and building
            loyal customers — straight from Pune.
          </p>
        </div>

        {posts.length === 0 && (
          <p className="text-center py-20" style={{ color: TEXT_LIGHT }}>
            No posts published yet. Check back soon!
          </p>
        )}

        {/* Featured post */}
        {featured && (
          <Link
            href={`/blog/${featured.slug}`}
            className="group block mb-8 sm:mb-12 rounded-2xl sm:rounded-3xl overflow-hidden transition-shadow hover:shadow-xl"
            style={{ border: `1px solid ${BORDER}` }}
          >
            <div className="md:flex">
              {featured.cover_image_url && (
                <div className="md:w-1/2 h-52 sm:h-72 md:h-auto overflow-hidden">
                  <img
                    src={featured.cover_image_url}
                    alt={featured.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              )}
              <div className="p-5 sm:p-8 md:w-1/2 flex flex-col justify-center">
                {featured.tags?.[0] && (
                  <span
                    className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide mb-2"
                    style={{ color: ACCENT }}
                  >
                    {featured.tags[0]}
                  </span>
                )}
                <h2
                  className="text-xl sm:text-2xl md:text-3xl font-semibold mb-2 sm:mb-3 leading-snug"
                  style={{ fontFamily: "'Fraunces', Georgia, serif", color: TEXT_DARK }}
                >
                  {featured.title}
                </h2>
                <p
                  className="mb-4 text-sm sm:text-base line-clamp-3"
                  style={{ color: TEXT_MED }}
                >
                  {featured.excerpt}
                </p>
                <p className="text-xs sm:text-sm" style={{ color: TEXT_LIGHT }}>
                  {formatDate(featured.published_at)} · {featured.read_time_minutes} min
                  read
                </p>
              </div>
            </div>
          </Link>
        )}

        {/* Grid of remaining posts */}
        {rest.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {rest.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group rounded-2xl overflow-hidden transition-shadow hover:shadow-lg flex flex-col"
                style={{ border: `1px solid ${BORDER}` }}
              >
                <div className="h-40 sm:h-44 overflow-hidden" style={{ background: SURFACE }}>
                  {post.cover_image_url && (
                    <img
                      src={post.cover_image_url}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                </div>
                <div className="p-4 sm:p-5 flex flex-col flex-1">
                  {post.tags?.[0] && (
                    <span
                      className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
                      style={{ color: ACCENT }}
                    >
                      {post.tags[0]}
                    </span>
                  )}
                  <h3
                    className="font-semibold mb-2 leading-snug line-clamp-2 text-[15px] sm:text-base"
                    style={{ color: TEXT_DARK }}
                  >
                    {post.title}
                  </h3>
                  <p
                    className="text-sm line-clamp-2 mb-3 flex-1"
                    style={{ color: TEXT_MED }}
                  >
                    {post.excerpt}
                  </p>
                  <p className="text-xs" style={{ color: TEXT_LIGHT }}>
                    {formatDate(post.published_at)} · {post.read_time_minutes} min read
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
