"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlogPostListItem } from "@/lib/types/blog";

// All colors are explicit (inline or hard Tailwind classes) on purpose —
// this screen sits inside a legacy dark-theme app, so nothing here should
// rely on inherited text/background color.

const TEXT_DARK = "#1d2327";
const TEXT_MED = "#3c434a";
const TEXT_LIGHT = "#646970";
const BORDER = "#c3c4c7";
const ACCENT = "#8b2635";

export default function AdminBlogListPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPostListItem[]>([]);
  const [filter, setFilter] = useState<"all" | "draft" | "published">("all");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    void loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function loadPosts() {
    setLoading(true);
    const url =
      filter === "all" ? "/api/admin/blog" : `/api/admin/blog?status=${filter}`;
    const res = await fetch(url);
    const data = await res.json();
    setPosts(data.posts || []);
    setLoading(false);
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This can't be undone.`)) return;
    setDeletingId(id);
    const res = await fetch(`/api/admin/blog/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } else {
      alert("Failed to delete post");
    }
    setDeletingId(null);
  }

  const counts = {
    all: posts.length,
    published: posts.filter((p) => p.status === "published").length,
    draft: posts.filter((p) => p.status === "draft").length,
  };

  return (
    <div style={{ padding: "20px 24px", color: TEXT_MED }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "8px",
        }}
      >
        <h1 style={{ fontSize: "23px", fontWeight: 400, color: TEXT_DARK, margin: 0 }}>
          Posts
        </h1>
        <button
          onClick={() => router.push("/admin/blog/new")}
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#ffffff",
            background: ACCENT,
            border: "none",
            borderRadius: "3px",
            padding: "6px 14px",
            cursor: "pointer",
          }}
        >
          Add New
        </button>
      </div>

      {/* Status filter tabs (WP style: text links separated by |) */}
      <div style={{ fontSize: "13px", color: TEXT_LIGHT, marginBottom: "16px" }}>
        {(["all", "published", "draft"] as const).map((f, i) => (
          <span key={f}>
            {i > 0 && <span style={{ margin: "0 8px", color: "#dcdcde" }}>|</span>}
            <button
              onClick={() => setFilter(f)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontSize: "13px",
                color: filter === f ? TEXT_DARK : ACCENT,
                fontWeight: filter === f ? 600 : 400,
                textDecoration: filter === f ? "none" : "underline",
              }}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)} (
              {counts[f]})
            </button>
          </span>
        ))}
      </div>

      {/* List table */}
      {loading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: TEXT_LIGHT }}>
          Loading posts…
        </div>
      ) : posts.length === 0 ? (
        <div
          style={{
            background: "#ffffff",
            border: `1px solid ${BORDER}`,
            borderRadius: "4px",
            padding: "40px",
            textAlign: "center",
            color: TEXT_LIGHT,
          }}
        >
          No posts yet.{" "}
          <Link href="/admin/blog/new" style={{ color: ACCENT }}>
            Write your first one →
          </Link>
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              <th style={thStyle}>Title</th>
              <th style={{ ...thStyle, width: "160px" }}>Tags</th>
              <th style={{ ...thStyle, width: "110px" }}>Status</th>
              <th style={{ ...thStyle, width: "140px" }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr
                key={post.id}
                onMouseEnter={() => setHoveredId(post.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ borderBottom: `1px solid #f0f0f1` }}
              >
                <td style={{ ...tdStyle, fontWeight: 600 }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    {post.cover_image_url ? (
                      <img
                        src={post.cover_image_url}
                        alt=""
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "4px",
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "4px",
                          background: "#f0e8dd",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div>
                      <Link
                        href={`/admin/blog/${post.id}`}
                        style={{
                          color: TEXT_DARK,
                          fontSize: "14px",
                          textDecoration: "none",
                        }}
                      >
                        {post.title}
                      </Link>
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: "12px",
                          fontWeight: 400,
                          color: TEXT_LIGHT,
                        }}
                      >
                        {post.excerpt || "No excerpt"}
                      </p>

                      {/* Row actions - visible on hover, WP style */}
                      {hoveredId === post.id && (
                        <div style={{ fontSize: "12px", marginTop: "4px" }}>
                          <Link
                            href={`/admin/blog/${post.id}`}
                            style={{ color: ACCENT, textDecoration: "none" }}
                          >
                            Edit
                          </Link>
                          <span style={{ margin: "0 6px", color: "#dcdcde" }}>|</span>
                          {post.status === "published" && (
                            <>
                              <a
                                href={`/blog/${post.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: ACCENT, textDecoration: "none" }}
                              >
                                View
                              </a>
                              <span style={{ margin: "0 6px", color: "#dcdcde" }}>
                                |
                              </span>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(post.id, post.title)}
                            disabled={deletingId === post.id}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              cursor: "pointer",
                              color: "#b32d2e",
                              fontSize: "12px",
                            }}
                          >
                            {deletingId === post.id ? "Deleting…" : "Trash"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td style={tdStyle}>
                  {post.tags?.length ? (
                    <span style={{ fontSize: "12px", color: TEXT_LIGHT }}>
                      {post.tags.slice(0, 2).join(", ")}
                    </span>
                  ) : (
                    <span style={{ fontSize: "12px", color: "#c3c4c7" }}>—</span>
                  )}
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: "999px",
                      color: post.status === "published" ? "#00450c" : "#664d03",
                      background: post.status === "published" ? "#d1e7dd" : "#fff3cd",
                    }}
                  >
                    {post.status === "published" ? "Published" : "Draft"}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontSize: "13px", color: TEXT_LIGHT }}>
                  {post.published_at
                    ? new Date(post.published_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "Not published"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "12px",
  fontWeight: 600,
  color: TEXT_LIGHT,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const tdStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "14px",
  color: TEXT_MED,
  verticalAlign: "top",
};
