export type BlogPostStatus = "draft" | "published";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: Record<string, unknown>; // Tiptap JSON
  content_html: string | null;
  cover_image_url: string | null;
  status: BlogPostStatus;
  tags: string[];
  author_name: string;
  seo_title: string | null;
  seo_description: string | null;
  read_time_minutes: number;
  view_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPostListItem
  extends Pick<
    BlogPost,
    | "id"
    | "title"
    | "slug"
    | "excerpt"
    | "cover_image_url"
    | "tags"
    | "author_name"
    | "read_time_minutes"
    | "published_at"
    | "status"
  > {}

export interface BlogPostInput {
  title: string;
  slug: string;
  excerpt?: string;
  content: Record<string, unknown>;
  content_html: string;
  cover_image_url?: string;
  status: BlogPostStatus;
  tags: string[];
  author_name?: string;
  seo_title?: string;
  seo_description?: string;
  read_time_minutes?: number;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function estimateReadTime(html: string): number {
  const words = html.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}
