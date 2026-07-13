"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SIDEBAR_BG = "#1d2327";
const SIDEBAR_TEXT = "#c3c4c7";
const SIDEBAR_TEXT_ACTIVE = "#ffffff";
const ACCENT = "#8b2635"; // Dinezy burgundy, used as WP's active-blue equivalent

export default function BlogAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isAllPosts = pathname === "/admin/blog";
  const isAddNew = pathname === "/admin/blog/new";

  const navItem = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "10px 16px",
        fontSize: "14px",
        color: active ? SIDEBAR_TEXT_ACTIVE : SIDEBAR_TEXT,
        background: active ? ACCENT : "transparent",
        borderLeft: active ? `3px solid #ffffff` : "3px solid transparent",
        textDecoration: "none",
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </Link>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f0f0f1" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: "200px",
          flexShrink: 0,
          background: SIDEBAR_BG,
          paddingTop: "12px",
        }}
      >
        <div
          style={{
            padding: "0 16px 16px",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "15px",
            letterSpacing: "0.02em",
            borderBottom: "1px solid #32373c",
            marginBottom: "8px",
            paddingBottom: "16px",
          }}
        >
          🍽️ Dinezy Admin
        </div>

        <nav>
          <div
            style={{
              color: "#8c8f94",
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "8px 16px 4px",
            }}
          >
            Blog
          </div>
          {navItem("/admin/blog", "All Posts", isAllPosts)}
          {navItem("/admin/blog/new", "+ Add New", isAddNew)}

          <div style={{ height: "1px", background: "#32373c", margin: "12px 16px" }} />

          <Link
            href="/admin"
            style={{
              display: "block",
              padding: "10px 16px",
              fontSize: "14px",
              color: SIDEBAR_TEXT,
              textDecoration: "none",
            }}
          >
            ← Back to Dashboard
          </Link>
        </nav>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );
}
