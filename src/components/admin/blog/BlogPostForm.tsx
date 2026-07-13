"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BlogEditor from "./BlogEditor";
import { BlogPost, slugify } from "@/lib/types/blog";

// Explicit color tokens (this form lives inside a legacy dark-theme app,
// so nothing here should depend on inherited text/background color)
const TEXT_DARK = "#1d2327";
const TEXT_MED = "#3c434a";
const TEXT_LIGHT = "#646970";
const BORDER = "#c3c4c7";
const ACCENT = "#8b2635";
const BOX_BG = "#ffffff";
const PAGE_BG = "#f0f0f1";

interface BlogPostFormProps {
  mode: "create" | "edit";
  initialPost?: BlogPost;
}

export default function BlogPostForm({ mode, initialPost }: BlogPostFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [slug, setSlug] = useState(initialPost?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt ?? "");
  const [tagsInput, setTagsInput] = useState(initialPost?.tags?.join(", ") ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(initialPost?.cover_image_url ?? "");
  const [seoTitle, setSeoTitle] = useState(initialPost?.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(initialPost?.seo_description ?? "");
  const [contentJson, setContentJson] = useState<Record<string, unknown>>(
    initialPost?.content ?? {}
  );
  const [contentHtml, setContentHtml] = useState(initialPost?.content_html ?? "");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState<"draft" | "published" | null>(null);
  const [error, setError] = useState("");
  const [currentStatus, setCurrentStatus] = useState(initialPost?.status ?? "draft");

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleCoverUpload(file: File) {
    setUploadingCover(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/blog/upload", { method: "POST", body: formData });
    const data = await res.json();
    setUploadingCover(false);
    if (!res.ok) {
      alert(data.error || "Upload failed");
      return;
    }
    setCoverImageUrl(data.url);
  }

  async function handleSave(status: "draft" | "published") {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!contentHtml || contentHtml === "<p></p>") {
      setError("Post content can't be empty");
      return;
    }
    setError("");
    setSaving(status);

    const payload = {
      title: title.trim(),
      slug: slug.trim() || undefined,
      excerpt: excerpt.trim() || undefined,
      content: contentJson,
      content_html: contentHtml,
      cover_image_url: coverImageUrl || undefined,
      status,
      tags: tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      seo_title: seoTitle.trim() || undefined,
      seo_description: seoDescription.trim() || undefined,
    };

    try {
      const url =
        mode === "create" ? "/api/admin/blog" : `/api/admin/blog/${initialPost!.id}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      router.push("/admin/blog");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setSaving(null);
    }
  }

  return (
    <div style={{ padding: "20px 24px", background: PAGE_BG, minHeight: "100vh" }}>
      <h1 style={{ fontSize: "23px", fontWeight: 400, color: TEXT_DARK, margin: "0 0 16px" }}>
        {mode === "create" ? "Add New Post" : "Edit Post"}
      </h1>

      {error && (
        <div
          style={{
            background: "#fcf0f1",
            border: "1px solid #e0a5a8",
            color: "#8b2635",
            padding: "10px 14px",
            borderRadius: "4px",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
        {/* Main column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Add title"
            style={{
              width: "100%",
              fontSize: "22px",
              fontWeight: 500,
              color: TEXT_DARK,
              background: BOX_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: "4px",
              padding: "10px 14px",
              marginBottom: "6px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          {/* Permalink */}
          <div style={{ fontSize: "13px", color: TEXT_LIGHT, marginBottom: "16px" }}>
            Permalink: dinezy.in/blog/
            <input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              style={{
                fontSize: "13px",
                color: ACCENT,
                border: "none",
                borderBottom: `1px dashed ${BORDER}`,
                background: "transparent",
                outline: "none",
                width: "260px",
                fontFamily: "monospace",
              }}
            />
          </div>

          {/* Editor */}
          <div style={{ marginBottom: "20px" }}>
            <BlogEditor
              initialContent={initialPost?.content}
              onChange={(json, html) => {
                setContentJson(json);
                setContentHtml(html);
              }}
            />
          </div>

          {/* Excerpt box */}
          <Box title="Excerpt">
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              placeholder="Short summary shown on the blog listing page…"
              style={inputStyle}
            />
          </Box>

          {/* SEO box */}
          <Box title="SEO (optional)">
            <label style={labelStyle}>SEO Title</label>
            <input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder={title || "Same as post title"}
              style={{ ...inputStyle, marginBottom: "12px" }}
            />
            <label style={labelStyle}>Meta Description</label>
            <textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              rows={2}
              placeholder={excerpt || "Same as excerpt"}
              style={inputStyle}
            />
          </Box>
        </div>

        {/* Sidebar column */}
        <div style={{ width: "280px", flexShrink: 0 }}>
          {/* Publish box */}
          <Box title="Publish">
            <div
              style={{
                fontSize: "13px",
                color: TEXT_MED,
                marginBottom: "12px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>Status:</span>
              <strong style={{ color: TEXT_DARK }}>
                {currentStatus === "published" ? "Published" : "Draft"}
              </strong>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => handleSave("draft")}
                disabled={saving !== null}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: TEXT_MED,
                  background: "#f6f7f7",
                  border: `1px solid ${BORDER}`,
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
              >
                {saving === "draft" ? "Saving…" : "Save Draft"}
              </button>
              <button
                onClick={() => handleSave("published")}
                disabled={saving !== null}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#ffffff",
                  background: ACCENT,
                  border: "none",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
              >
                {saving === "published" ? "Publishing…" : "Publish"}
              </button>
            </div>
          </Box>

          {/* Featured image box */}
          <Box title="Featured Image">
            {coverImageUrl && (
              <img
                src={coverImageUrl}
                alt="cover"
                style={{
                  width: "100%",
                  height: "140px",
                  objectFit: "cover",
                  borderRadius: "4px",
                  marginBottom: "10px",
                }}
              />
            )}
            <input
              type="file"
              accept="image/*"
              disabled={uploadingCover}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleCoverUpload(file);
              }}
              style={{ fontSize: "12px", color: TEXT_MED }}
            />
            {uploadingCover && (
              <p style={{ fontSize: "12px", color: TEXT_LIGHT, marginTop: "6px" }}>
                Uploading…
              </p>
            )}
          </Box>

          {/* Tags box */}
          <Box title="Tags">
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="restaurant tech, pune, qr menu"
              style={inputStyle}
            />
            <p style={{ fontSize: "11px", color: TEXT_LIGHT, marginTop: "6px" }}>
              Separate tags with commas
            </p>
          </Box>
        </div>
      </div>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: BOX_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: "4px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: `1px solid ${BORDER}`,
          fontSize: "14px",
          fontWeight: 600,
          color: TEXT_DARK,
        }}
      >
        {title}
      </div>
      <div style={{ padding: "14px" }}>{children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: "13px",
  color: TEXT_DARK,
  background: "#ffffff",
  border: `1px solid ${BORDER}`,
  borderRadius: "3px",
  padding: "8px 10px",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: TEXT_MED,
  marginBottom: "6px",
};
