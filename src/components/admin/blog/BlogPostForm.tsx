"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import BlogEditor from "./BlogEditor";
import {
  BlogPost,
  slugify,
} from "@/lib/types/blog";

const SITE_URL = "https://dinezy.in";

const TEXT_DARK = "#1d2327";
const TEXT_MED = "#3c434a";
const TEXT_LIGHT = "#646970";
const BORDER = "#c3c4c7";
const ACCENT = "#8b2635";
const BOX_BG = "#ffffff";
const PAGE_BG = "#f0f0f1";
const SOFT_BG = "#fbf7f0";
const SUCCESS = "#146c43";

interface BlogPostFormProps {
  mode: "create" | "edit";
  initialPost?: BlogPost;
}

function cleanText(
  value: string,
  maxLength = 100000,
): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function wordCount(value: string): number {
  const text = cleanText(value);

  if (!text) return 0;

  return text
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function countMatches(
  html: string,
  pattern: RegExp,
): number {
  return (html.match(pattern) ?? []).length;
}

function hasInternalLink(html: string): boolean {
  return /href\s*=\s*["']\/(?!\/)/i.test(
    html,
  );
}

function countImagesWithoutAlt(
  html: string,
): number {
  const images = [
    ...html.matchAll(
      /<img\b[^>]*>/gi,
    ),
  ];

  return images.filter((img) => {
    const tag = img[0];

    const match = tag.match(
      /\balt\s*=\s*["']([^"']*)["']/i,
    );

    return (
      !match ||
      !match[1].trim()
    );
  }).length;
}

function createAutoSeoTitle(
  title: string,
): string {
  const cleanTitle = cleanText(
    title,
    90,
  );

  if (!cleanTitle) return "";

  const suffix = " | Dinezy Blog";

  if (
    cleanTitle
      .toLowerCase()
      .includes("dinezy")
  ) {
    return cleanTitle.slice(0, 70);
  }

  const room = 70 - suffix.length;

  return `${cleanTitle.slice(
    0,
    Math.max(room, 1),
  )}${suffix}`;
}

function createAutoDescription(
  title: string,
  excerpt: string,
  html: string,
): string {
  const titleText = cleanText(
    title,
    120,
  );

  const excerptText = cleanText(
    excerpt,
    220,
  );

  const articleText = cleanText(
    html,
    260,
  );

  const source =
    excerptText ||
    articleText;

  if (!source && titleText) {
    return `Read ${titleText} with practical insights, examples, and useful takeaways from Dinezy.`;
  }

  if (!source) return "";

  if (
    source
      .toLowerCase()
      .startsWith(
        titleText.toLowerCase(),
      )
  ) {
    return source.slice(0, 160);
  }

  const combined = titleText
    ? `${titleText}: ${source}`
    : source;

  return combined
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function createAutoExcerpt(
  html: string,
): string {
  const text = cleanText(
    html,
    240,
  );

  return text.slice(0, 220);
}

function normalizeTags(
  input: string,
): string[] {
  const seen = new Set<string>();

  return input
    .split(",")
    .map((tag) =>
      tag
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .filter((tag) => {
      const key =
        tag.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function seoTitleLengthLabel(
  length: number,
): {
  label: string;
  color: string;
} {
  if (length === 0) {
    return {
      label: "Missing",
      color: "#b32d2e",
    };
  }

  if (length >= 30 && length <= 65) {
    return {
      label: "Good",
      color: SUCCESS,
    };
  }

  if (length <= 70) {
    return {
      label: "Review",
      color: "#996800",
    };
  }

  return {
    label: "Long",
    color: "#b32d2e",
  };
}

function metaDescriptionLabel(
  length: number,
): {
  label: string;
  color: string;
} {
  if (length === 0) {
    return {
      label: "Missing",
      color: "#b32d2e",
    };
  }

  if (
    length >= 100 &&
    length <= 160
  ) {
    return {
      label: "Good",
      color: SUCCESS,
    };
  }

  return {
    label: "Review",
    color: "#996800",
  };
}

export default function BlogPostForm({
  mode,
  initialPost,
}: BlogPostFormProps) {
  const router = useRouter();

  const initialTitle =
    initialPost?.title ?? "";

  const initialExcerpt =
    initialPost?.excerpt ?? "";

  const initialSeoTitle =
    initialPost?.seo_title ?? "";

  const initialSeoDescription =
    initialPost?.seo_description ?? "";

  const [title, setTitle] =
    useState(initialTitle);

  const [slug, setSlug] =
    useState(
      initialPost?.slug ??
        (initialTitle
          ? slugify(initialTitle)
          : ""),
    );

  const [
    slugTouched,
    setSlugTouched,
  ] = useState(
    mode === "edit" &&
      Boolean(initialPost?.slug),
  );

  const [excerpt, setExcerpt] =
    useState(
      initialExcerpt ||
        "",
    );

  const [
    excerptTouched,
    setExcerptTouched,
  ] = useState(
    Boolean(initialExcerpt),
  );

  const [
    tagsInput,
    setTagsInput,
  ] = useState(
    initialPost?.tags?.join(
      ", ",
    ) ?? "",
  );

  const [
    coverImageUrl,
    setCoverImageUrl,
  ] = useState(
    initialPost?.cover_image_url ??
      "",
  );

  const [
    seoTitle,
    setSeoTitle,
  ] = useState(
    initialSeoTitle ||
      createAutoSeoTitle(
        initialTitle,
      ),
  );

  const [
    seoTitleTouched,
    setSeoTitleTouched,
  ] = useState(
    Boolean(initialSeoTitle),
  );

  const [
    seoDescription,
    setSeoDescription,
  ] = useState(
    initialSeoDescription ||
      createAutoDescription(
        initialTitle,
        initialExcerpt,
        initialPost?.content_html ??
          "",
      ),
  );

  const [
    seoDescriptionTouched,
    setSeoDescriptionTouched,
  ] = useState(
    Boolean(
      initialSeoDescription,
    ),
  );

  const [
    contentJson,
    setContentJson,
  ] = useState<
    Record<string, unknown>
  >(
    initialPost?.content ??
      {},
  );

  const [
    contentHtml,
    setContentHtml,
  ] = useState(
    initialPost?.content_html ??
      "",
  );

  const [
    uploadingCover,
    setUploadingCover,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState<
    "draft" | "published" | null
  >(null);

  const [
    error,
    setError,
  ] = useState("");

  const [
    currentStatus,
    setCurrentStatus,
  ] = useState(
    initialPost?.status ??
      "draft",
  );

  const [
    justSaved,
    setJustSaved,
  ] = useState(false);

  function handleTitleChange(
    value: string,
  ) {
    setTitle(value);

    if (!slugTouched) {
      setSlug(
        slugify(value),
      );
    }

    if (!seoTitleTouched) {
      setSeoTitle(
        createAutoSeoTitle(
          value,
        ),
      );
    }

    if (
      !seoDescriptionTouched
    ) {
      setSeoDescription(
        createAutoDescription(
          value,
          excerpt,
          contentHtml,
        ),
      );
    }
  }

  function handleExcerptChange(
    value: string,
  ) {
    setExcerpt(value);
    setExcerptTouched(true);

    if (
      !seoDescriptionTouched
    ) {
      setSeoDescription(
        createAutoDescription(
          title,
          value,
          contentHtml,
        ),
      );
    }
  }

  function handleContentChange(
    json: Record<
      string,
      unknown
    >,
    html: string,
  ) {
    setContentJson(json);
    setContentHtml(html);

    if (!excerptTouched) {
      setExcerpt(
        createAutoExcerpt(
          html,
        ),
      );
    }

    if (
      !seoDescriptionTouched
    ) {
      setSeoDescription(
        createAutoDescription(
          title,
          excerptTouched
            ? excerpt
            : createAutoExcerpt(
                html,
              ),
          html,
        ),
      );
    }
  }

  async function handleCoverUpload(
    file: File,
  ) {
    setUploadingCover(true);
    setError("");

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        file,
      );

      const res =
        await fetch(
          "/api/admin/blog/upload",
          {
            method: "POST",
            body: formData,
          },
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Upload failed",
        );
      }

      setCoverImageUrl(
        data.url,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Upload failed",
      );
    } finally {
      setUploadingCover(false);
    }
  }

  const analysis = useMemo(() => {
    const finalSlug =
      slugify(
        slug ||
          title,
      );

    const finalSeoTitle =
      seoTitle.trim() ||
      createAutoSeoTitle(
        title,
      );

    const finalSeoDescription =
      seoDescription.trim() ||
      createAutoDescription(
        title,
        excerpt,
        contentHtml,
      );

    const words =
      wordCount(
        contentHtml,
      );

    const h2Count =
      countMatches(
        contentHtml,
        /<h2\b/gi,
      );

    const h3Count =
      countMatches(
        contentHtml,
        /<h3\b/gi,
      );

    const imageCount =
      countMatches(
        contentHtml,
        /<img\b/gi,
      );

    const imagesWithoutAlt =
      countImagesWithoutAlt(
        contentHtml,
      );

    const internalLinks =
      hasInternalLink(
        contentHtml,
      );

    const openingText =
      cleanText(
        contentHtml,
        500,
      );

    const titleStatus =
      seoTitleLengthLabel(
        finalSeoTitle.length,
      );

    const descriptionStatus =
      metaDescriptionLabel(
        finalSeoDescription.length,
      );

    return {
      finalSlug,
      finalSeoTitle,
      finalSeoDescription,
      words,
      h2Count,
      h3Count,
      imageCount,
      imagesWithoutAlt,
      internalLinks,
      openingText,
      titleStatus,
      descriptionStatus,
      tagCount:
        normalizeTags(
          tagsInput,
        ).length,
    };
  }, [
    slug,
    title,
    seoTitle,
    seoDescription,
    excerpt,
    contentHtml,
    tagsInput,
  ]);

  const checklist = [
    {
      label: "Clear article title",
      ok: title.trim().length > 0,
    },
    {
      label: "Clean canonical slug",
      ok:
        analysis.finalSlug.length >=
          3 &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
          analysis.finalSlug,
        ),
    },
    {
      label: "SEO title is filled",
      ok:
        analysis.finalSeoTitle.length >
        0,
    },
    {
      label:
        "Meta description is filled",
      ok:
        analysis.finalSeoDescription.length >
        0,
    },
    {
      label:
        "Article has a meaningful opening",
      ok:
        analysis.openingText.length >=
        80,
    },
    {
      label:
        "Article uses at least one H2",
      ok:
        analysis.h2Count >= 1,
    },
    {
      label:
        "Article has crawlable internal links",
      ok:
        analysis.internalLinks,
    },
    {
      label:
        "Images have descriptive alt text",
      ok:
        analysis.imagesWithoutAlt === 0,
    },
  ];

  const completedCount =
    checklist.filter(
      (item) => item.ok,
    ).length;

  const progressPercent =
    Math.round(
      (completedCount /
        checklist.length) *
        100,
    );

  const wordGuidance =
    analysis.words >= 1
      ? `This article contains ${analysis.words.toLocaleString()} words. Judge completeness by whether the article fully answers its intended topic; Google does not prescribe a preferred word count.`
      : "Add the article content first.";

  async function handleSave(
    status:
      | "draft"
      | "published",
  ) {
    setError("");
    setJustSaved(false);

    if (!title.trim()) {
      setError(
        "Title is required",
      );
      return;
    }

    if (
      !contentHtml ||
      cleanText(contentHtml)
        .length < 20
    ) {
      setError(
        "Post content can't be empty.",
      );
      return;
    }

    const normalizedSlug =
      analysis.finalSlug;

    if (
      !normalizedSlug ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
        normalizedSlug,
      )
    ) {
      setError(
        "Slug must contain lowercase letters, numbers, and hyphens only.",
      );
      return;
    }

    setSaving(status);

    const finalSeoTitle =
      seoTitle.trim() ||
      createAutoSeoTitle(
        title,
      );

    const finalSeoDescription =
      seoDescription.trim() ||
      createAutoDescription(
        title,
        excerpt,
        contentHtml,
      );

    const finalExcerpt =
      excerpt.trim() ||
      createAutoExcerpt(
        contentHtml,
      );

    const payload = {
      title: title.trim(),
      slug: normalizedSlug,
      excerpt:
        finalExcerpt ||
        undefined,
      content: contentJson,
      content_html: contentHtml,
      cover_image_url:
        coverImageUrl ||
        undefined,
      status,
      tags:
        normalizeTags(
          tagsInput,
        ),
      seo_title:
        finalSeoTitle ||
        undefined,
      seo_description:
        finalSeoDescription ||
        undefined,
    };

    try {
      const url =
        mode === "create"
          ? "/api/admin/blog"
          : `/api/admin/blog/${initialPost!.id}`;

      const method =
        mode === "create"
          ? "POST"
          : "PUT";

      const res =
        await fetch(url, {
          method,
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            payload,
          ),
        });

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Save failed",
        );
      }

      setCurrentStatus(
        status,
      );
      setSaving(null);
      setJustSaved(true);

      window.setTimeout(
        () => {
          router.push(
            "/admin/blog",
          );
          router.refresh();
        },
        350,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Save failed",
      );
      setSaving(null);
    }
  }

  useEffect(() => {
    if (!justSaved) return;

    const timer =
      window.setTimeout(
        () =>
          setJustSaved(
            false,
          ),
        2500,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [justSaved]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: PAGE_BG,
        color: TEXT_MED,
      }}
    >
      {/* --------------------------------------------------------------- */}
      {/* Top bar                                                         */}
      {/* --------------------------------------------------------------- */}
      <div
        style={{
          position:
            "sticky",
          top: 0,
          zIndex: 20,
          borderBottom: `1px solid ${BORDER}`,
          background:
            "rgba(255,255,255,0.94)",
          backdropFilter:
            "blur(14px)",
        }}
      >
        <div
          style={{
            maxWidth:
              "1440px",
            margin:
              "0 auto",
            padding:
              "12px 24px",
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "space-between",
            gap: "14px",
          }}
        >
          <div>
            <div
              style={{
                fontSize:
                  "11px",
                fontWeight:
                  700,
                color: ACCENT,
                textTransform:
                  "uppercase",
                letterSpacing:
                  "0.14em",
              }}
            >
              Dinezy Blog
            </div>

            <h1
              style={{
                margin:
                  "2px 0 0",
                fontSize:
                  "20px",
                lineHeight:
                  1.2,
                fontWeight:
                  650,
                color:
                  TEXT_DARK,
              }}
            >
              {mode ===
              "create"
                ? "Create an article"
                : "Edit article"}
            </h1>
          </div>

          <div
            style={{
              display:
                "flex",
              alignItems:
                "center",
              gap: "9px",
            }}
          >
            {justSaved && (
              <span
                style={{
                  fontSize:
                    "12px",
                  fontWeight:
                    600,
                  color:
                    SUCCESS,
                }}
              >
                Saved
              </span>
            )}

            <button
              type="button"
              onClick={() =>
                handleSave(
                  "draft",
                )
              }
              disabled={
                saving !== null
              }
              style={{
                padding:
                  "9px 13px",
                border:
                  `1px solid ${BORDER}`,
                borderRadius:
                  "9px",
                background:
                  "#ffffff",
                color:
                  TEXT_DARK,
                fontSize:
                  "12px",
                fontWeight:
                  650,
                cursor:
                  saving
                    ? "default"
                    : "pointer",
                opacity:
                  saving
                    ? 0.55
                    : 1,
              }}
            >
              {saving ===
              "draft"
                ? "Saving…"
                : "Save draft"}
            </button>

            <button
              type="button"
              onClick={() =>
                handleSave(
                  "published",
                )
              }
              disabled={
                saving !== null
              }
              style={{
                padding:
                  "9px 14px",
                border:
                  "none",
                borderRadius:
                  "9px",
                background:
                  ACCENT,
                color:
                  "#ffffff",
                fontSize:
                  "12px",
                fontWeight:
                  700,
                cursor:
                  saving
                    ? "default"
                    : "pointer",
                opacity:
                  saving
                    ? 0.55
                    : 1,
              }}
            >
              {saving ===
              "published"
                ? "Publishing…"
                : "Publish"}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth:
            "1440px",
          margin:
            "0 auto",
          padding:
            "20px 24px 48px",
        }}
      >
        {error && (
          <div
            role="alert"
            style={{
              marginBottom:
                "16px",
              background:
                "#fcf0f1",
              border:
                "1px solid #e0a5a8",
              color:
                "#8b2635",
              padding:
                "12px 14px",
              borderRadius:
                "10px",
              fontSize:
                "13px",
              lineHeight:
                1.5,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "minmax(0, 1fr) 330px",
            gap: "20px",
            alignItems:
              "start",
          }}
        >
          {/* =========================================================== */}
          {/* Main column                                                 */}
          {/* =========================================================== */}
          <div
            style={{
              minWidth: 0,
            }}
          >
            <section
              style={{
                background:
                  BOX_BG,
                border:
                  `1px solid ${BORDER}`,
                borderRadius:
                  "14px",
                padding:
                  "18px",
                marginBottom:
                  "16px",
              }}
            >
              <label
                style={{
                  display:
                    "block",
                  marginBottom:
                    "7px",
                  fontSize:
                    "11px",
                  fontWeight:
                    700,
                  color:
                    TEXT_LIGHT,
                  textTransform:
                    "uppercase",
                  letterSpacing:
                    "0.1em",
                }}
              >
                Article title
              </label>

              <input
                value={title}
                onChange={(e) =>
                  handleTitleChange(
                    e.target.value,
                  )
                }
                placeholder="e.g. Top 10 Pizza Places in Pune"
                style={{
                  width:
                    "100%",
                  border:
                    "none",
                  outline:
                    "none",
                  color:
                    TEXT_DARK,
                  background:
                    "transparent",
                  fontSize:
                    "clamp(26px,4vw,42px)",
                  lineHeight:
                    1.1,
                  fontWeight:
                    650,
                  letterSpacing:
                    "-0.025em",
                  boxSizing:
                    "border-box",
                }}
              />

              <div
                style={{
                  marginTop:
                    "14px",
                  paddingTop:
                    "11px",
                  borderTop:
                    `1px solid #f0f0f1`,
                  display:
                    "flex",
                  flexWrap:
                    "wrap",
                  alignItems:
                    "center",
                  gap:
                    "7px",
                  fontSize:
                    "12px",
                  color:
                    TEXT_LIGHT,
                }}
              >
                <span>
                  Canonical URL
                </span>

                <span
                  style={{
                    color:
                      TEXT_MED,
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                >
                  {SITE_URL}/blog/
                  <input
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(
                        true,
                      );
                      setSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(
                            /[^a-z0-9-]+/g,
                            "-",
                          )
                          .replace(
                            /-+/g,
                            "-",
                          )
                          .replace(
                            /^-|-$/g,
                            "",
                          ),
                      );
                    }}
                    aria-label="Blog post slug"
                    style={{
                      width:
                        "min(430px, 50vw)",
                      minWidth:
                        "180px",
                      fontSize:
                        "12px",
                      color:
                        ACCENT,
                      border:
                        "none",
                      borderBottom:
                        `1px dashed ${BORDER}`,
                      background:
                        "transparent",
                      outline:
                        "none",
                      fontFamily:
                        "inherit",
                      fontWeight:
                        600,
                    }}
                  />
                </span>
              </div>

              <div
                style={{
                  marginTop:
                    "9px",
                  fontSize:
                    "11px",
                  color:
                    TEXT_LIGHT,
                }}
              >
                Preview:{" "}
                <span
                  style={{
                    color:
                      ACCENT,
                  }}
                >
                  {SITE_URL}/blog/
                  {analysis.finalSlug ||
                    "your-post"}
                </span>
              </div>
            </section>

            <section
              style={{
                marginBottom:
                  "16px",
              }}
            >
              <BlogEditor
                initialContent={
                  initialPost?.content
                }
                onChange={
                  handleContentChange
                }
              />
            </section>

            {/* Excerpt */}
            <Box
              title="Search & listing excerpt"
              subtitle="Used on the blog index and as a fallback for search snippets."
            >
              <textarea
                value={excerpt}
                onChange={(e) =>
                  handleExcerptChange(
                    e.target.value,
                  )
                }
                rows={4}
                placeholder="A concise summary that tells a reader what they will learn..."
                style={{
                  ...inputStyle,
                  resize:
                    "vertical",
                  lineHeight:
                    1.6,
                }}
              />

              <FieldHint>
                {excerpt.length} characters
                {excerptTouched
                  ? ""
                  : " · auto-generated until you edit it"}
              </FieldHint>
            </Box>

            {/* SEO */}
            <Box
              title="SEO controls"
              subtitle="These values are saved with the post and consumed automatically by the public article page."
            >
              <label
                style={
                  labelStyle
                }
              >
                SEO title
              </label>

              <input
                value={seoTitle}
                onChange={(e) => {
                  setSeoTitleTouched(
                    true,
                  );
                  setSeoTitle(
                    e.target.value,
                  );
                }}
                placeholder={createAutoSeoTitle(
                  title,
                )}
                maxLength={90}
                style={{
                  ...inputStyle,
                  marginBottom:
                    "7px",
                }}
              />

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  gap: "12px",
                  marginBottom:
                    "16px",
                  fontSize:
                    "11px",
                }}
              >
                <span
                  style={{
                    color:
                      analysis
                        .titleStatus
                        .color,
                    fontWeight:
                      650,
                  }}
                >
                  {analysis.titleStatus.label}
                </span>
                <span
                  style={{
                    color:
                      TEXT_LIGHT,
                  }}
                >
                  {seoTitle.length}/70
                </span>
              </div>

              <label
                style={
                  labelStyle
                }
              >
                Meta description
              </label>

              <textarea
                value={
                  seoDescription
                }
                onChange={(e) => {
                  setSeoDescriptionTouched(
                    true,
                  );
                  setSeoDescription(
                    e.target.value,
                  );
                }}
                rows={4}
                maxLength={180}
                placeholder={createAutoDescription(
                  title,
                  excerpt,
                  contentHtml,
                )}
                style={{
                  ...inputStyle,
                  resize:
                    "vertical",
                  lineHeight:
                    1.55,
                }}
              />

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  gap: "12px",
                  marginTop:
                    "7px",
                  fontSize:
                    "11px",
                }}
              >
                <span
                  style={{
                    color:
                      analysis
                        .descriptionStatus
                        .color,
                    fontWeight:
                      650,
                  }}
                >
                  {
                    analysis
                      .descriptionStatus
                      .label
                  }
                </span>

                <span
                  style={{
                    color:
                      TEXT_LIGHT,
                  }}
                >
                  {
                    seoDescription.length
                  }
                  /160
                </span>
              </div>

              <div
                style={{
                  marginTop:
                    "14px",
                  padding:
                    "11px 12px",
                  borderRadius:
                    "10px",
                  background:
                    SOFT_BG,
                  color:
                    TEXT_MED,
                  fontSize:
                    "12px",
                  lineHeight:
                    1.55,
                }}
              >
                <strong
                  style={{
                    color:
                      TEXT_DARK,
                  }}
                >
                  Google-style preview
                </strong>

                <div
                  style={{
                    marginTop:
                      "7px",
                    color:
                      "#1a0dab",
                    fontSize:
                      "15px",
                    fontWeight:
                      500,
                  }}
                >
                  {analysis.finalSeoTitle ||
                    "Your article title"}
                </div>

                <div
                  style={{
                    marginTop:
                      "2px",
                    color:
                      "#0b57d0",
                    fontSize:
                      "11px",
                    wordBreak:
                      "break-word",
                  }}
                >
                  {SITE_URL}
                  /blog/
                  {analysis.finalSlug ||
                    "your-post"}
                </div>

                <div
                  style={{
                    marginTop:
                      "3px",
                    color:
                      "#4d5156",
                    fontSize:
                      "12px",
                    lineHeight:
                      1.5,
                  }}
                >
                  {analysis.finalSeoDescription ||
                    "Your article description will appear here."}
                </div>
              </div>
            </Box>

            {/* Writing quality / AI visibility */}
            <Box
              title="People-first & AI-search checklist"
              subtitle="AI search uses the same core SEO foundations: accessible content, clear structure, internal links, useful supporting media, and genuinely valuable information."
            >
              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(2,minmax(0,1fr))",
                  gap:
                    "9px",
                }}
              >
                {checklist.map(
                  (item) => (
                    <div
                      key={
                        item.label
                      }
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "flex-start",
                        gap:
                          "8px",
                        padding:
                          "9px 10px",
                        borderRadius:
                          "9px",
                        background:
                          item.ok
                            ? "#eff8f3"
                            : "#f7f7f7",
                        color:
                          item.ok
                            ? SUCCESS
                            : TEXT_MED,
                        fontSize:
                          "12px",
                        lineHeight:
                          1.4,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width:
                            "18px",
                          height:
                            "18px",
                          flexShrink:
                            0,
                          borderRadius:
                            "50%",
                          display:
                            "inline-flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          background:
                            item.ok
                              ? SUCCESS
                              : "#e5e5e5",
                          color:
                            "#ffffff",
                          fontSize:
                            "10px",
                          fontWeight:
                            800,
                        }}
                      >
                        {item.ok
                          ? "✓"
                          : "•"}
                      </span>

                      <span>
                        {item.label}
                      </span>
                    </div>
                  ),
                )}
              </div>

              <div
                style={{
                  marginTop:
                    "12px",
                  height:
                    "7px",
                  borderRadius:
                    "999px",
                  background:
                    "#eceff0",
                  overflow:
                    "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height:
                      "100%",
                    background:
                      `linear-gradient(90deg,${ACCENT},#b14b5a)`,
                    transition:
                      "width 300ms ease",
                  }}
                />
              </div>

              <div
                style={{
                  marginTop:
                    "8px",
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  gap:
                    "12px",
                  fontSize:
                    "11px",
                  color:
                    TEXT_LIGHT,
                }}
              >
                <span>
                  {completedCount}/
                  {checklist.length} publishing checks
                  complete
                </span>

                <span>
                  {progressPercent}%
                </span>
              </div>

              <div
                style={{
                  marginTop:
                    "12px",
                  padding:
                    "11px 12px",
                  border:
                    `1px solid #eee5dc`,
                  borderRadius:
                    "10px",
                  background:
                    "#fffaf5",
                  color:
                    TEXT_MED,
                  fontSize:
                    "12px",
                  lineHeight:
                    1.55,
                }}
              >
                <strong
                  style={{
                    color:
                      TEXT_DARK,
                  }}
                >
                  Originality matters:
                </strong>{" "}
                add first-hand experience,
                concrete examples, original analysis,
                useful local details, or evidence that a
                generic article would not have. Avoid
                publishing large numbers of AI-generated
                articles whose main purpose is to attract
                search traffic.
              </div>

              <p
                style={{
                  margin:
                    "10px 0 0",
                  fontSize:
                    "11px",
                  lineHeight:
                    1.5,
                  color:
                    TEXT_LIGHT,
                }}
              >
                {wordGuidance}
              </p>
            </Box>
          </div>

          {/* =========================================================== */}
          {/* Sidebar                                                      */}
          {/* =========================================================== */}
          <aside
            style={{
              position:
                "sticky",
              top:
                "77px",
            }}
          >
            <Box title="Publishing">
              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  marginBottom:
                    "12px",
                  fontSize:
                    "12px",
                }}
              >
                <span
                  style={{
                    color:
                      TEXT_LIGHT,
                  }}
                >
                  Status
                </span>

                <span
                  style={{
                    padding:
                      "4px 9px",
                    borderRadius:
                      "999px",
                    background:
                      currentStatus ===
                      "published"
                        ? "#dff3e8"
                        : "#fff1cf",
                    color:
                      currentStatus ===
                      "published"
                        ? SUCCESS
                        : "#7a5800",
                    fontWeight:
                      700,
                  }}
                >
                  {currentStatus ===
                  "published"
                    ? "Published"
                    : "Draft"}
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  handleSave(
                    "published",
                  )
                }
                disabled={
                  saving !== null
                }
                style={{
                  width:
                    "100%",
                  padding:
                    "11px 14px",
                  border:
                    "none",
                  borderRadius:
                    "9px",
                  background:
                    ACCENT,
                  color:
                    "#ffffff",
                  fontSize:
                    "13px",
                  fontWeight:
                    700,
                  cursor:
                    saving
                      ? "default"
                      : "pointer",
                  opacity:
                    saving
                      ? 0.6
                      : 1,
                  marginBottom:
                    "8px",
                }}
              >
                {saving ===
                "published"
                  ? "Publishing…"
                  : "Publish article"}
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSave(
                    "draft",
                  )
                }
                disabled={
                  saving !== null
                }
                style={{
                  width:
                    "100%",
                  padding:
                    "10px 14px",
                  border:
                    `1px solid ${BORDER}`,
                  borderRadius:
                    "9px",
                  background:
                    "#ffffff",
                  color:
                    TEXT_DARK,
                  fontSize:
                    "12px",
                  fontWeight:
                    650,
                  cursor:
                    saving
                      ? "default"
                      : "pointer",
                  opacity:
                    saving
                      ? 0.6
                      : 1,
                }}
              >
                {saving ===
                "draft"
                  ? "Saving…"
                  : "Save as draft"}
              </button>
            </Box>

            <Box title="Featured image">
              {coverImageUrl ? (
                <div
                  style={{
                    marginBottom:
                      "10px",
                    overflow:
                      "hidden",
                    borderRadius:
                      "10px",
                    background:
                      SOFT_BG,
                    border:
                      `1px solid ${BORDER}`,
                  }}
                >
                  <img
                    src={
                      coverImageUrl
                    }
                    alt="Featured image preview"
                    style={{
                      width:
                        "100%",
                      height:
                        "170px",
                      objectFit:
                        "cover",
                      display:
                        "block",
                    }}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setCoverImageUrl(
                        "",
                      )
                    }
                    style={{
                      width:
                        "100%",
                      border:
                        "none",
                      borderTop:
                        `1px solid ${BORDER}`,
                      background:
                        "#ffffff",
                      color:
                        ACCENT,
                      padding:
                        "8px",
                      fontSize:
                        "11px",
                      fontWeight:
                        650,
                      cursor:
                        "pointer",
                    }}
                  >
                    Remove image
                  </button>
                </div>
              ) : null}

              <input
                type="file"
                accept="image/*"
                disabled={
                  uploadingCover
                }
                onChange={(e) => {
                  const file =
                    e.target
                      .files?.[0];

                  if (file) {
                    void handleCoverUpload(
                      file,
                    );
                  }
                }}
                style={{
                  width:
                    "100%",
                  fontSize:
                    "11px",
                  color:
                    TEXT_MED,
                }}
              />

              <FieldHint>
                Use a relevant, representative
                featured image. The public article uses the
                article title as its fallback alt text.
              </FieldHint>

              {uploadingCover && (
                <p
                  style={{
                    fontSize:
                      "11px",
                    color:
                      ACCENT,
                    margin:
                      "7px 0 0",
                  }}
                >
                  Uploading…
                </p>
              )}
            </Box>

            <Box
              title="Tags"
              subtitle="Use a few accurate topics, not a long keyword list."
            >
              <input
                value={tagsInput}
                onChange={(e) =>
                  setTagsInput(
                    e.target.value,
                  )
                }
                placeholder="restaurant tech, Pune, QR menu"
                style={
                  inputStyle
                }
              />

              <div
                style={{
                  marginTop:
                    "8px",
                  fontSize:
                    "11px",
                  color:
                    TEXT_LIGHT,
                }}
              >
                {
                  analysis.tagCount
                }{" "}
                topic
                {analysis.tagCount ===
                1
                  ? ""
                  : "s"}
              </div>
            </Box>

            <Box title="Content signals">
              <SignalRow
                label="Words"
                value={analysis.words.toLocaleString()}
              />

              <SignalRow
                label="H2 headings"
                value={String(
                  analysis.h2Count,
                )}
              />

              <SignalRow
                label="H3 headings"
                value={String(
                  analysis.h3Count,
                )}
              />

              <SignalRow
                label="Images"
                value={String(
                  analysis.imageCount,
                )}
              />

              <SignalRow
                label="Internal links"
                value={
                  analysis.internalLinks
                    ? "Found"
                    : "Add one"
                }
              />

              <SignalRow
                label="Image alt text"
                value={
                  analysis.imagesWithoutAlt ===
                  0
                    ? "OK"
                    : `${analysis.imagesWithoutAlt} missing`
                }
              />
            </Box>

            <Box
              title="Suggested Dinezy links"
              subtitle="Use these naturally when they genuinely help the reader."
            >
              <div
                style={{
                  display:
                    "flex",
                  flexDirection:
                    "column",
                  gap:
                    "8px",
                }}
              >
                {[
                  [
                    "/restaurant-digital-menu",
                    "Restaurant digital menu",
                  ],
                  [
                    "/restaurant-qr-menu",
                    "Restaurant QR menu",
                  ],
                  [
                    "/restaurant-marketing",
                    "Restaurant marketing",
                  ],
                  [
                    "/restaurant-whatsapp-marketing",
                    "Restaurant WhatsApp marketing",
                  ],
                  [
                    "/restaurant-loyalty-program",
                    "Restaurant loyalty program",
                  ],
                  [
                    "/qr-generator",
                    "Free QR code generator",
                  ],
                ].map(
                  ([href, label]) => (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color:
                          ACCENT,
                        fontSize:
                          "11px",
                        lineHeight:
                          1.4,
                        textDecoration:
                          "none",
                      }}
                    >
                      {label} ↗
                    </a>
                  ),
                )}
              </div>
            </Box>

            <div
              style={{
                padding:
                  "11px 12px",
                borderRadius:
                  "10px",
                background:
                  "#f6f7f7",
                color:
                  TEXT_LIGHT,
                fontSize:
                  "11px",
                lineHeight:
                  1.55,
              }}
            >
              <strong
                style={{
                  color:
                    TEXT_DARK,
                }}
              >
                Canonical:
              </strong>{" "}
              {SITE_URL}/blog/
              {analysis.finalSlug ||
                "your-post"}
            </div>
          </aside>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 980px) {
          .blog-post-form-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 900px) {
          .blog-post-form-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 760px) {
          aside {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}

function Box({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background:
          BOX_BG,
        border:
          `1px solid ${BORDER}`,
        borderRadius:
          "12px",
        marginBottom:
          "16px",
        overflow:
          "hidden",
      }}
    >
      <div
        style={{
          padding:
            "12px 14px",
          borderBottom:
            `1px solid ${BORDER}`,
          background:
            "linear-gradient(180deg,#ffffff,#fbfbfb)",
        }}
      >
        <div
          style={{
            fontSize:
              "13px",
            fontWeight:
              700,
            color:
              TEXT_DARK,
          }}
        >
          {title}
        </div>

        {subtitle && (
          <div
            style={{
              marginTop:
                "3px",
              fontSize:
                "11px",
              lineHeight:
                1.45,
              color:
                TEXT_LIGHT,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      <div
        style={{
          padding:
            "14px",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function SignalRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display:
          "flex",
        alignItems:
          "center",
        justifyContent:
          "space-between",
        gap:
          "12px",
        padding:
          "7px 0",
        borderBottom:
          `1px solid #f0f0f1`,
        fontSize:
          "11px",
      }}
    >
      <span
        style={{
          color:
            TEXT_LIGHT,
        }}
      >
        {label}
      </span>

      <span
        style={{
          color:
            TEXT_DARK,
          fontWeight:
            650,
          textAlign:
            "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function FieldHint({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p
      style={{
        margin:
          "7px 0 0",
        fontSize:
          "11px",
        lineHeight:
          1.5,
        color:
          TEXT_LIGHT,
      }}
    >
      {children}
    </p>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: "13px",
  color: TEXT_DARK,
  background: "#ffffff",
  border: `1px solid ${BORDER}`,
  borderRadius: "8px",
  padding: "10px 11px",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 700,
  color: TEXT_MED,
  marginBottom: "7px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};
