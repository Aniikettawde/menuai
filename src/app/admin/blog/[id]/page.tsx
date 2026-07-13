import { notFound } from "next/navigation";
import { getBlogAdminClient } from "@/lib/supabase/blog-admin-client";
import BlogPostForm from "@/components/admin/blog/BlogPostForm";
import { BlogPost } from "@/lib/types/blog";

export const dynamic = "force-dynamic";

async function getPost(id: string): Promise<BlogPost | null> {
  const supabase = getBlogAdminClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as BlogPost;
}

export default async function EditBlogPostPage({
  params,
}: {
  params: { id: string };
}) {
  const post = await getPost(params.id);
  if (!post) notFound();

  return (
    <div className="min-h-screen" style={{ background: "var(--pr-ivory, #fbf7f0)" }}>
      <BlogPostForm mode="edit" initialPost={post} />
    </div>
  );
}
