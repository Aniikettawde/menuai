import BlogPostForm from "@/components/admin/blog/BlogPostForm";

export default function NewBlogPostPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--pr-ivory, #fbf7f0)" }}>
      <BlogPostForm mode="create" />
    </div>
  );
}
