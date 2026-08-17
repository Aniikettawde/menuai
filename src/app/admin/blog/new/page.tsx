import BlogPostForm from "@/components/admin/blog/BlogPostForm";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

export default function NewBlogPostPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--pr-ivory, #fbf7f0)" }}>
      <BlogPostForm mode="create" />
    </div>
  );
}
