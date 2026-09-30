import type { Metadata } from 'next'
import Link from 'next/link'

import { getBlogAdminClient } from '@/lib/supabase/blog-admin-client'
import { BlogPostListItem } from '@/lib/types/blog'

const SITE_URL = 'https://dinezy.in'
const BLOG_PATH = '/blog'
const BLOG_URL = `${SITE_URL}${BLOG_PATH}`

const ACCENT = '#8b2635'
const TEXT_DARK = '#1a1a1a'
const TEXT_MED = '#525252'
const TEXT_LIGHT = '#8a8a8a'
const BORDER = '#e5e5e5'
const SURFACE = '#fafafa'

export const revalidate = 60

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: 'Restaurant Tech, QR Menus & Marketing Insights | Dinezy Blog',

  description:
    'Practical insights on restaurant technology, digital menus, QR menus, customer loyalty, WhatsApp marketing and smarter restaurant operations from Dinezy.',

  alternates: {
    canonical: BLOG_PATH,
  },

  openGraph: {
    title: 'Restaurant Tech, QR Menus & Marketing Insights | Dinezy Blog',
    description:
      'Practical insights on restaurant technology, digital menus, QR menus, customer loyalty, WhatsApp marketing and smarter restaurant operations from Dinezy.',
    url: BLOG_URL,
    siteName: 'Dinezy',
    type: 'website',
  },

  twitter: {
    card: 'summary',
    title: 'Dinezy Blog — Restaurant Tech & Marketing Insights',
    description:
      'Insights on digital menus, QR menus, restaurant marketing, loyalty and restaurant technology.',
  },

  robots: {
    index: true,
    follow: true,
  },
}

async function getPublishedPosts(): Promise<BlogPostListItem[]> {
  const supabase = getBlogAdminClient()

  const { data, error } = await supabase
    .from('blog_posts')
    .select(
      'id, title, slug, excerpt, cover_image_url, tags, author_name, read_time_minutes, published_at, status',
    )
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (error) {
    console.error('Error fetching blog posts:', error)
    return []
  }

  return data as BlogPostListItem[]
}

function cleanText(value: unknown, maxLength = 300): string {
  if (typeof value !== 'string') return ''

  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''

  const date = new Date(dateStr)

  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function absoluteUrl(value: string | null | undefined): string | null {
  if (!value) return null

  const trimmed = value.trim()

  if (!trimmed) return null

  try {
    return new URL(trimmed, `${SITE_URL}/`).toString()
  } catch {
    return null
  }
}

const collectionJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${BLOG_URL}#webpage`,
  url: BLOG_URL,
  name: 'Dinezy Blog',
  description:
    'Practical insights on restaurant technology, digital menus, QR menus, customer loyalty, WhatsApp marketing and smarter restaurant operations.',
  isPartOf: {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: 'Dinezy',
  },
  about: {
    '@type': 'Thing',
    name: 'Restaurant technology and marketing',
  },
}

const itemListJsonLd = (posts: BlogPostListItem[]) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  '@id': `${BLOG_URL}#itemlist`,
  itemListElement: posts.slice(0, 100).map((post, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: cleanText(post.title, 160),
    url: absoluteUrl(`/blog/${post.slug}`),
  })),
})

export default async function BlogListingPage() {
  const posts = await getPublishedPosts()
  const [featured, ...rest] = posts

  const jsonLdGraph = {
    '@context': 'https://schema.org',
    '@graph': [
      collectionJsonLd,
      ...(posts.length > 0 ? [itemListJsonLd(posts)] : []),
    ],
  }

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLdGraph),
        }}
      />

      <main>
        {/* ---------------------------------------------------------------- */}
        {/* Hero                                                            */}
        {/* ---------------------------------------------------------------- */}
        <section className="relative overflow-hidden border-b border-gray-100 bg-[#fcfaf7]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-[#8b2635]/[0.07] blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-[#d9a77d]/[0.12] blur-3xl"
          />

          <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-14 sm:px-6 sm:pb-16 sm:pt-20 lg:px-8">
            <div className="mx-auto max-w-3xl text-center animate-blog-fade-up">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#8b2635]/10 bg-white/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b2635] shadow-sm backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8b2635]" />
                Dinezy Blog
              </div>

              <h1
                className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl"
                style={{
                  fontFamily: "'Fraunces', Georgia, serif",
                  color: TEXT_DARK,
                }}
              >
                Ideas for building a smarter restaurant
              </h1>

              <p
                className="mx-auto mt-5 max-w-2xl text-sm leading-7 sm:text-base"
                style={{ color: TEXT_MED }}
              >
                Practical stories and ideas on restaurant technology, digital
                menus, QR menus, customer loyalty, marketing, and the systems
                that shape better dining experiences.
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
                {[
                  'Restaurant Tech',
                  'QR Menus',
                  'Marketing',
                  'Loyalty',
                ].map((topic, index) => (
                  <span
                    key={topic}
                    className="animate-blog-chip rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600"
                    style={{
                      animationDelay: `${100 + index * 70}ms`,
                    }}
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Content                                                          */}
        {/* ---------------------------------------------------------------- */}
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          {posts.length === 0 ? (
            <div className="mx-auto max-w-xl py-20 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#8b2635]/[0.08] text-2xl">
                ✦
              </div>

              <h2
                className="mt-5 text-2xl font-semibold"
                style={{
                  fontFamily: "'Fraunces', Georgia, serif",
                  color: TEXT_DARK,
                }}
              >
                New ideas are on the way
              </h2>

              <p className="mt-2 text-sm leading-6" style={{ color: TEXT_LIGHT }}>
                No posts are published yet. Check back soon for restaurant
                technology and marketing insights.
              </p>
            </div>
          ) : (
            <>
              {/* Featured post */}
              {featured && (
                <section
                  aria-labelledby="featured-post-heading"
                  className="animate-blog-fade-up"
                >
                  <div className="mb-5 flex items-end justify-between gap-4">
                    <div>
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8b2635]">
                        Featured
                      </p>

                      <h2
                        id="featured-post-heading"
                        className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl"
                        style={{
                          fontFamily: "'Fraunces', Georgia, serif",
                          color: TEXT_DARK,
                        }}
                      >
                        Latest thinking
                      </h2>
                    </div>

                    <span
                      className="hidden text-xs sm:block"
                      style={{ color: TEXT_LIGHT }}
                    >
                      {posts.length} {posts.length === 1 ? 'article' : 'articles'}
                    </span>
                  </div>

                  <Link
                    href={`/blog/${featured.slug}`}
                    className="group relative block overflow-hidden rounded-[1.75rem] border bg-white transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(20,15,10,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b2635] focus-visible:ring-offset-4"
                    style={{ borderColor: BORDER }}
                  >
                    <div className="grid md:grid-cols-[1.08fr_0.92fr]">
                      <div className="relative min-h-[260px] overflow-hidden bg-[#f4eee7] sm:min-h-[340px] md:min-h-[440px]">
                        {featured.cover_image_url ? (
                          <img
                            src={featured.cover_image_url}
                            alt={featured.title}
                            className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
                            loading="eager"
                            fetchPriority="high"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-end bg-[radial-gradient(circle_at_25%_20%,rgba(139,38,53,0.16),transparent_40%),linear-gradient(135deg,#f6efe7,#eadcd0)] p-7">
                            <span className="max-w-xs font-serif text-3xl text-[#8b2635]/75">
                              {featured.title}
                            </span>
                          </div>
                        )}

                        <div
                          aria-hidden="true"
                          className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-70"
                        />
                      </div>

                      <div className="flex flex-col justify-center p-6 sm:p-8 md:p-10 lg:p-12">
                        {featured.tags?.[0] && (
                          <span
                            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                            style={{ color: ACCENT }}
                          >
                            {featured.tags[0]}
                          </span>
                        )}

                        <h3
                          className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl"
                          style={{
                            fontFamily: "'Fraunces', Georgia, serif",
                            color: TEXT_DARK,
                          }}
                        >
                          {featured.title}
                        </h3>

                        {featured.excerpt && (
                          <p
                            className="mt-4 line-clamp-4 text-sm leading-7 sm:text-base"
                            style={{ color: TEXT_MED }}
                          >
                            {featured.excerpt}
                          </p>
                        )}

                        <div
                          className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs"
                          style={{ color: TEXT_LIGHT }}
                        >
                          {featured.author_name && (
                            <>
                              <span>{featured.author_name}</span>
                              <span aria-hidden="true">·</span>
                            </>
                          )}

                          <time
                            dateTime={featured.published_at ?? undefined}
                          >
                            {formatDate(featured.published_at)}
                          </time>

                          {featured.read_time_minutes && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>
                                {featured.read_time_minutes} min read
                              </span>
                            </>
                          )}
                        </div>

                        <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#8b2635]">
                          Read the article
                          <span
                            aria-hidden="true"
                            className="transition-transform duration-300 group-hover:translate-x-1"
                          >
                            →
                          </span>
                        </span>
                      </div>
                    </div>
                  </Link>
                </section>
              )}

              {/* Remaining posts */}
              {rest.length > 0 && (
                <section
                  aria-labelledby="more-posts-heading"
                  className="mt-14 sm:mt-20"
                >
                  <div className="mb-6 flex items-end justify-between">
                    <div>
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8b2635]">
                        Explore
                      </p>

                      <h2
                        id="more-posts-heading"
                        className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl"
                        style={{
                          fontFamily: "'Fraunces', Georgia, serif",
                          color: TEXT_DARK,
                        }}
                      >
                        More from the journal
                      </h2>
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {rest.map((post, index) => (
                      <Link
                        key={post.id}
                        href={`/blog/${post.slug}`}
                        className="group animate-blog-card flex h-full flex-col overflow-hidden rounded-[1.4rem] border bg-white transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(20,15,10,0.10)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b2635] focus-visible:ring-offset-4"
                        style={{
                          borderColor: BORDER,
                          animationDelay: `${index * 70}ms`,
                        }}
                      >
                        <div
                          className="relative h-48 overflow-hidden sm:h-52"
                          style={{ background: SURFACE }}
                        >
                          {post.cover_image_url ? (
                            <img
                              src={post.cover_image_url}
                              alt={post.title}
                              className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.05]"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full items-end bg-[radial-gradient(circle_at_20%_20%,rgba(139,38,53,0.12),transparent_45%),linear-gradient(135deg,#faf6f1,#eee4da)] p-5">
                              <span className="font-serif text-xl text-[#8b2635]/70">
                                {post.title}
                              </span>
                            </div>
                          )}

                          <div
                            aria-hidden="true"
                            className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent"
                          />
                        </div>

                        <div className="flex flex-1 flex-col p-5 sm:p-6">
                          {post.tags?.[0] && (
                            <span
                              className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                              style={{ color: ACCENT }}
                            >
                              {post.tags[0]}
                            </span>
                          )}

                          <h3
                            className="mt-2 line-clamp-2 text-lg font-semibold leading-snug"
                            style={{
                              fontFamily: "'Fraunces', Georgia, serif",
                              color: TEXT_DARK,
                            }}
                          >
                            {post.title}
                          </h3>

                          {post.excerpt && (
                            <p
                              className="mt-2 line-clamp-3 text-sm leading-6"
                              style={{ color: TEXT_MED }}
                            >
                              {post.excerpt}
                            </p>
                          )}

                          <div
                            className="mt-auto pt-5 text-xs"
                            style={{ color: TEXT_LIGHT }}
                          >
                            <time dateTime={post.published_at ?? undefined}>
                              {formatDate(post.published_at)}
                            </time>

                            {post.read_time_minutes && (
                              <>
                                <span aria-hidden="true"> · </span>
                                <span>
                                  {post.read_time_minutes} min read
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      </main>

      <style>{`
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

        @keyframes blog-chip {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-blog-fade-up {
          animation: blog-fade-up 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .animate-blog-card {
          animation: blog-card 650ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .animate-blog-chip {
          animation: blog-chip 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-blog-fade-up,
          .animate-blog-card,
          .animate-blog-chip {
            animation: none !important;
          }

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
