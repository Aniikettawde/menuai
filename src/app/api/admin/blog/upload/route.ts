import { NextRequest, NextResponse } from "next/server";
import { getBlogAdminClient } from "@/lib/supabase/blog-admin-client";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// POST /api/admin/blog/upload - multipart/form-data with "file" field
// Used by both the cover-image picker and inline Tiptap image uploads.
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WEBP, GIF images are allowed" },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    const supabase = getBlogAdminClient();

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `posts/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("blog-images")
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("blog-images").getPublicUrl(path);

    return NextResponse.json({ url: publicUrl });
  } catch (err: any) {
    console.error("POST /api/admin/blog/upload error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
