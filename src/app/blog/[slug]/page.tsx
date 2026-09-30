import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getBlogAdminClient } from '@/lib/supabase/blog-admin-client'
import { BlogPost, BlogPostListItem } from '@/lib/types/blog'

export const revalidate = 60
export const dynamicParams = true

const SITE_URL = 'https://dinezy.in'

const ACCENT = '#8b2635'
const TEXT_DARK = '#1a1a1a'
const TEXT_MED = '#525252'
const TEXT_LIGHT = '#8a8a8a'
const BORDER = '#e5e5e5'
const SURFACE = '#f7f2ec'

type PageProps = {
  params: Promise<{ slug: string }>
}

type BlogPostWithMeta = BlogPost & {
  updated_at?: string | null
}

function cleanText(value: unknown, maxLength = 1000): string {
  if (typeof value !== 'string') return ''

  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function getDescription(post: BlogPost): string {
  const explicit =
    cleanText(post.seo_description, 180) ||
    cleanText(post.excerpt, 180)

  if (explicit) {
    return explicit.slice(0, 160)
  }

  return (
    cleanText(post.content_html, 160) ||
    `${cleanText(post.title, 120)} — read the latest insights from Dinezy.`
  ).slice(0, 160)
}

function getTitle(post: BlogPost): string {
  const base =
    cleanText(post.seo_title, 80) ||
    cleanText(post.title, 80)

  if (!base) return 'Dinezy Blog'

  return /dinezy/i.test(base)
    ? base
    : `${base} | Dinezy Blog`
}

function absoluteUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null

  const trimmed = value.trim()

  if (!trimmed) return null

  try {
    return new URL(
      trimmed,
      `${SITE_URL}/`,
    ).toString()
  } catch {
    return null
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''

  const date = new Date(dateStr)

  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getIsoDate(dateStr: string | null | undefined) {
  if (!dateStr) return undefined

  const date = new Date(dateStr)

  if (Number.isNaN(date.getTime())) return undefined

  return date.toISOString()
}

function wordCount(html: string | null | undefined): number {
  const text = cleanText(html ?? '', 100000)

  if (!text) return 0

  return text
    .split(/\s+/)
    .filter(Boolean)
    .length
}

async function getPost(
  slug: string,
): Promise<BlogPostWithMeta | null> {
  const supabase = getBlogAdminClient()

  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (error || !data) return null

  return data as BlogPostWithMeta
}

async function getRelatedPosts(
  post: BlogPost,
): Promise<BlogPostListItem[]> {
  const supabase = getBlogAdminClient()

  const { data, error } = await supabase
    .from('blog_posts')
    .select(
      'id, title, slug, excerpt, cover_image_url, tags, author_name, read_time_minutes, published_at, status',
    )
    .eq('status', 'published')
    .neq('id', post.id)
    .order('published_at', { ascending: false })
    .limit(18)

  if (error || !data) {
    return []
  }

  const currentTags = new Set(
    (post.tags ?? []).map((tag) =>
      tag.trim().toLowerCase(),
    ),
  )

  return (data as BlogPostListItem[])
    .map((candidate) => {
      const overlap = (candidate.tags ?? []).filter(
        (tag) =>
          currentTags.has(
            tag.trim().toLowerCase(),
          ),
      ).length

      return {
        candidate,
        overlap,
      }
    })
    .sort(
      (a, b) =>
        b.overlap - a.overlap ||
        new Date(
          b.candidate.published_at ?? 0,
        ).getTime() -
          new Date(
            a.candidate.published_at ?? 0,
          ).getTime(),
    )
    .slice(0, 3)
    .map((item) => item.candidate)
}

function buildPostJsonLd(post: BlogPost) {
  const canonicalUrl = `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`
  const image = absoluteUrl(post.cover_image_url)

  const published = getIsoDate(post.published_at)
  const modified = getIsoDate(
    post.updated_at ?? post.published_at,
  )

  const authorName =
    cleanText(post.author_name, 120) || 'Dinezy'

  const schema: Record<string, unknown> = {
    '@type': 'BlogPosting',
    '@id': `${canonicalUrl}#article`,
    url: canonicalUrl,
    headline: cleanText(post.title, 200),
    description: getDescription(post),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
    },
    isPartOf: {
      '@type': 'Blog',
      '@id': `${SITE_URL}/blog#blog`,
      url: `${SITE_URL}/blog`,
      name: 'Dinezy Blog',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Dinezy',
      url: SITE_URL,
    },
    author: {
      '@type': 'Person',
      name: authorName,
    },
  }

  if (published) {
    schema.datePublished = published
  }

  if (modified) {
    schema.dateModified = modified
  }

  if (image) {
    schema.image = [image]
  }

  const tags = (post.tags ?? [])
    .map((tag) => cleanText(tag, 80))
    .filter(Boolean)

  if (tags.length > 0) {
    schema.keywords = tags.join(', ')
    schema.articleSection = tags[0]
  }

  const count = wordCount(post.content_html)

  if (count > 0) {
    schema.wordCount = count
  }

  return schema
}

function buildBreadcrumbJsonLd(post: BlogPost) {
  const canonicalUrl = `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`

  return {
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrl}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Dinezy',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: `${SITE_URL}/blog`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: cleanText(post.title, 160),
        item: canonicalUrl,
      },
    ],
  }
}

function buildPageJsonLd(post: BlogPost) {
  const canonicalUrl = `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: getTitle(post),
        description: getDescription(post),
        isPartOf: {
          '@type': 'WebSite',
          '@id': `${SITE_URL}/#website`,
          url: SITE_URL,
          name: 'Dinezy',
        },
        breadcrumb: {
          '@id': `${canonicalUrl}#breadcrumb`,
        },
        mainEntity: {
          '@id': `${canonicalUrl}#article`,
        },
      },
      buildPostJsonLd(post),
      buildBreadcrumbJsonLd(post),
    ],
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)

  if (!post) {
    return {
      title: 'Post not found | Dinezy Blog',
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const title = getTitle(post)
  const description = getDescription(post)
  const canonical = `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`
  const image = absoluteUrl(post.cover_image_url)

  const publishedTime =
    getIsoDate(post.published_at) ?? undefined

  const modifiedTime =
    getIsoDate(
      post.updated_at ?? post.published_at,
    ) ?? undefined

  return {
    metadataBase: new URL(SITE_URL),

    title,
    description,

    alternates: {
      canonical,
    },

    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },

    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Dinezy',
      locale: 'en_IN',
      type: 'article',

      ...(publishedTime
        ? {
            publishedTime,
          }
        : {}),

      ...(modifiedTime
        ? {
            modifiedTime,
          }
        : {}),

      ...(post.author_name
        ? {
            authors: [post.author_name],
          }
        : {}),

      ...(post.tags?.length
        ? {
            tags: post.tags,
          }
        : {}),

      ...(image
        ? {
            images: [
              {
                url: image,
                alt: post.title,
              },
            ],
          }
        : {}),
    },

    twitter: {
      card: image
        ? 'summary_large_image'
        : 'summary',

      title,
      description,

      ...(image
        ? {
            images: [image],
          }
        : {}),
    },
  }
}

export default async function BlogPostPage({
  params,
}: PageProps) {
  const { slug } = await params
  const post = await getPost(slug)

  if (!post) {
    notFound()
  }

  // Preserve the existing non-critical view counter behaviour.
  void incrementViewCount(post.id)

  const relatedPosts = await getRelatedPosts(post)

  const canonicalUrl =
    `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`

  const publishedDate =
    formatDate(post.published_at)

  const modifiedDate =
    post.updated_at &&
    post.updated_at !== post.published_at
      ? formatDate(post.updated_at)
      : ''

  const jsonLd = buildPageJsonLd(post)

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />

      {/* -------------------------------------------------------------- */}
      {/* Article header                                                  */}
      {/* -------------------------------------------------------------- */}
      <header className="relative overflow-hidden border-b border-gray-100 bg-[#fcfaf7]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-[#8b2635]/[0.06] blur-3xl"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-[#d9a77d]/[0.10] blur-3xl"
        />

        <div className="relative mx-auto max-w-4xl px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-16">
          <div className="animate-blog-fade-up">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-3.5 py-2 text-xs font-medium text-gray-600 shadow-sm backdrop-blur transition hover:-translate-x-0.5 hover:text-[#8b2635] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b2635]"
            >
              <span aria-hidden="true">←</span>
              Dinezy Blog
            </Link>

            {post.tags?.length > 0 && (
              <div className="mt-7 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[#8b2635]/10 bg-[#8b2635]/[0.05] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b2635]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <h1
              className="mt-5 text-3xl font-semibold leading-[1.08] tracking-tight sm:text-4xl md:text-5xl"
              style={{
                fontFamily: "'Fraunces', Georgia, serif",
                color: TEXT_DARK,
              }}
            >
              {post.title}
            </h1>

            {(post.excerpt || getDescription(post)) && (
              <p
                className="mt-5 max-w-3xl text-base leading-7 sm:text-lg"
                style={{ color: TEXT_MED }}
              >
                {post.excerpt || getDescription(post)}
              </p>
            )}

            <div
              className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs sm:text-sm"
              style={{ color: TEXT_LIGHT }}
            >
              {post.author_name && (
                <>
                  <span className="font-medium text-gray-700">
                    {post.author_name}
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              )}

              {publishedDate && (
                <>
                  <time dateTime={post.published_at ?? undefined}>
                    {publishedDate}
                  </time>
                  <span aria-hidden="true">·</span>
                </>
              )}

              {post.read_time_minutes && (
                <span>
                  {post.read_time_minutes} min read
                </span>
              )}

              {modifiedDate && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Updated {modifiedDate}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------- */}
      {/* Article                                                         */}
      {/* -------------------------------------------------------------- */}
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <article
          className="mx-auto max-w-3xl animate-blog-fade-up"
          itemScope
          itemType="https://schema.org/BlogPosting"
        >
          {post.cover_image_url && (
            <figure className="mb-10 overflow-hidden rounded-[1.5rem] border border-gray-100 bg-[#f7f2ec] shadow-[0_24px_70px_rgba(20,15,10,0.08)] sm:mb-12 sm:rounded-[2rem]">
              <img
                src={post.cover_image_url}
                alt={post.title}
                className="block max-h-[560px] w-full object-cover"
                loading="eager"
                fetchPriority="high"
                itemProp="image"
              />
            </figure>
          )}

          <meta itemProp="headline" content={post.title} />
          <meta
            itemProp="description"
            content={getDescription(post)}
          />

          {post.published_at && (
            <meta
              itemProp="datePublished"
              content={post.published_at}
            />
          )}

          {(post.updated_at || post.published_at) && (
            <meta
              itemProp="dateModified"
              content={
                post.updated_at ??
                post.published_at ??
                ''
              }
            />
          )}

          <div
            className="blog-post-content"
            dangerouslySetInnerHTML={{
              __html: post.content_html || '',
            }}
            itemProp="articleBody"
          />

          <footer className="mt-12 border-t border-gray-200 pt-7 sm:mt-16 sm:pt-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link
                href="/blog"
                className="group inline-flex items-center gap-2 text-sm font-semibold text-[#8b2635] transition hover:gap-3"
              >
                <span aria-hidden="true">←</span>
                More articles
              </Link>

              <Link
                href="/"
                className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
              >
                Visit Dinezy
              </Link>
            </div>
          </footer>
        </article>

        {/* ------------------------------------------------------------ */}
        {/* Related articles                                              */}
        {/* ------------------------------------------------------------ */}
        {relatedPosts.length > 0 && (
          <section
            aria-labelledby="related-posts-heading"
            className="mx-auto mt-16 max-w-5xl border-t border-gray-100 pt-12 sm:mt-20 sm:pt-16"
          >
            <div className="mb-7">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8b2635]">
                Keep reading
              </p>

              <h2
                id="related-posts-heading"
                className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl"
                style={{
                  fontFamily: "'Fraunces', Georgia, serif",
                  color: TEXT_DARK,
                }}
              >
                Related articles
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {relatedPosts.map((relatedPost, index) => (
                <Link
                  key={relatedPost.id}
                  href={`/blog/${relatedPost.slug}`}
                  className="group animate-blog-card flex h-full flex-col overflow-hidden rounded-[1.35rem] border bg-white transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(20,15,10,0.10)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b2635] focus-visible:ring-offset-4"
                  style={{
                    borderColor: BORDER,
                    animationDelay: `${index * 90}ms`,
                  }}
                >
                  <div className="h-44 overflow-hidden bg-[#f4eee7]">
                    {relatedPost.cover_image_url ? (
                      <img
                        src={relatedPost.cover_image_url}
                        alt={relatedPost.title}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-end bg-[linear-gradient(135deg,#faf6f1,#eee4da)] p-5">
                        <span className="font-serif text-lg text-[#8b2635]/70">
                          {relatedPost.title}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    {relatedPost.tags?.[0] && (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b2635]">
                        {relatedPost.tags[0]}
                      </span>
                    )}

                    <h3
                      className="mt-2 line-clamp-3 text-lg font-semibold leading-snug"
                      style={{
                        fontFamily: "'Fraunces', Georgia, serif",
                        color: TEXT_DARK,
                      }}
                    >
                      {relatedPost.title}
                    </h3>

                    {relatedPost.excerpt && (
                      <p
                        className="mt-2 line-clamp-2 text-sm leading-6"
                        style={{ color: TEXT_MED }}
                      >
                        {relatedPost.excerpt}
                      </p>
                    )}

                    <span className="mt-auto pt-5 text-sm font-semibold text-[#8b2635]">
                      Read article →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <style>{`
        .blog-post-content {
          color: ${TEXT_DARK};
          font-size: 17px;
        }

        .blog-post-content > *:first-child {
          margin-top: 0;
        }

        .blog-post-content h2 {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 1.55rem;
          line-height: 1.2;
          font-weight: 600;
          margin: 2.25rem 0 0.85rem;
          color: ${ACCENT};
          scroll-margin-top: 6rem;
        }

        @media (min-width: 640px) {
          .blog-post-content h2 {
            font-size: 1.85rem;
            margin: 2.75rem 0 1rem;
          }
        }

        .blog-post-content h3 {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 1.2rem;
          line-height: 1.3;
          font-weight: 600;
          margin: 1.75rem 0 0.65rem;
          color: ${TEXT_DARK};
          scroll-margin-top: 6rem;
        }

        .blog-post-content h4 {
          font-size: 1rem;
          font-weight: 700;
          margin: 1.5rem 0 0.5rem;
          color: ${TEXT_DARK};
        }

        .blog-post-content p {
          line-height: 1.85;
          margin: 1rem 0;
          color: ${TEXT_DARK};
        }

        .blog-post-content strong {
          font-weight: 700;
          color: ${TEXT_DARK};
        }

        .blog-post-content em {
          font-style: italic;
        }

        .blog-post-content ul,
        .blog-post-content ol {
          padding-left: 1.45rem;
          margin: 1rem 0 1.25rem;
          color: ${TEXT_DARK};
        }

        .blog-post-content ul {
          list-style: disc;
        }

        .blog-post-content ol {
          list-style: decimal;
        }

        .blog-post-content li {
          margin: 0.45rem 0;
          line-height: 1.75;
        }

        .blog-post-content blockquote {
          border-left: 3px solid ${ACCENT};
          padding: 0.25rem 0 0.25rem 1.1rem;
          margin: 1.75rem 0;
          font-style: italic;
          color: #555;
          background: ${SURFACE};
          border-radius: 0 0.75rem 0.75rem 0;
        }

        .blog-post-content hr {
          margin: 2.5rem 0;
          border: 0;
          border-top: 1px solid ${BORDER};
        }

        .blog-post-content a {
          color: ${ACCENT};
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 3px;
          word-break: break-word;
        }

        .blog-post-content a:hover {
          text-decoration-thickness: 2px;
        }

        .blog-post-content img {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 1rem;
          margin: 1.75rem auto;
        }

        .blog-post-content figure {
          margin: 1.75rem 0;
        }

        .blog-post-content figcaption {
          margin-top: 0.65rem;
          color: ${TEXT_LIGHT};
          font-size: 0.82rem;
          line-height: 1.5;
          text-align: center;
        }

        .blog-post-content table {
          display: block;
          width: 100%;
          overflow-x: auto;
          margin: 1.75rem 0;
          border-collapse: collapse;
        }

        .blog-post-content th,
        .blog-post-content td {
          border: 1px solid ${BORDER};
          padding: 0.7rem 0.8rem;
          text-align: left;
          vertical-align: top;
          white-space: nowrap;
        }

        .blog-post-content th {
          background: ${SURFACE};
          font-weight: 700;
        }

        .blog-post-content code {
          background: ${SURFACE};
          color: ${TEXT_DARK};
          padding: 0.15rem 0.4rem;
          border-radius: 0.3rem;
          font-size: 0.9em;
          word-break: break-word;
        }

        .blog-post-content pre {
          background: #1e1e1e;
          color: #f5f5f5;
          padding: 1rem;
          border-radius: 0.75rem;
          overflow-x: auto;
          margin: 1.5rem 0;
          font-size: 0.85rem;
          line-height: 1.65;
        }

        .blog-post-content pre code {
          background: transparent;
          padding: 0;
          color: inherit;
        }

        @keyframes blog-fade-up {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes blog-card {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-blog-fade-up {
          animation: blog-fade-up 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .animate-blog-card {
          animation: blog-card 650ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-blog-fade-up,
          .animate-blog-card {
            animation: none !important;
          }

          .blog-post-content a,
          .group,
          .group img,
          .group span {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  )
}

async function incrementViewCount(postId: string) {
  try {
    const supabase = getBlogAdminClient()

    await supabase.rpc(
      'increment_blog_view_count',
      {
        post_id: postId,
      },
    )
  } catch {
    // Non-critical, ignore failures silently.
  }
}
