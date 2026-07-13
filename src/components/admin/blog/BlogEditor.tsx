"use client";

import { useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";

const TEXT_DARK = "#1d2327";
const TEXT_MED = "#3c434a";
const BORDER = "#c3c4c7";
const ACCENT = "#8b2635";
const TOOLBAR_BG = "#f6f7f7";

interface BlogEditorProps {
  initialContent?: Record<string, unknown>;
  onChange: (json: Record<string, unknown>, html: string) => void;
}

export default function BlogEditor({ initialContent, onChange }: BlogEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: "Start writing your blog post..." }),
    ],
    content: initialContent && Object.keys(initialContent).length ? initialContent : "",
    editorProps: {
      attributes: {
        class: "blog-editor-prose",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON(), editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && initialContent && Object.keys(initialContent).length) {
      const current = JSON.stringify(editor.getJSON());
      const incoming = JSON.stringify(initialContent);
      if (current !== incoming) editor.commands.setContent(initialContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent, editor]);

  const uploadImage = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/blog/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Image upload failed");
      return null;
    }
    return data.url as string;
  }, []);

  const handleInsertImage = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !editor) return;
      const url = await uploadImage(file);
      if (url) editor.chain().focus().setImage({ src: url }).run();
    };
    input.click();
  }, [editor, uploadImage]);

  const handleSetLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 10px",
    borderRadius: "3px",
    fontSize: "13px",
    fontWeight: 600,
    color: active ? "#ffffff" : TEXT_MED,
    background: active ? ACCENT : "transparent",
    border: "none",
    cursor: "pointer",
    lineHeight: 1,
  });

  const divider = <div style={{ width: "1px", height: "20px", background: BORDER, margin: "0 4px" }} />;

  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: "4px", overflow: "hidden", background: "#ffffff" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "2px",
          alignItems: "center",
          padding: "8px",
          background: TOOLBAR_BG,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <button type="button" style={btnStyle(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
        <button type="button" style={{ ...btnStyle(editor.isActive("italic")), fontStyle: "italic" }} onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
        <button type="button" style={{ ...btnStyle(editor.isActive("underline")), textDecoration: "underline" }} onClick={() => editor.chain().focus().toggleUnderline().run()}>U</button>
        <button type="button" style={{ ...btnStyle(editor.isActive("strike")), textDecoration: "line-through" }} onClick={() => editor.chain().focus().toggleStrike().run()}>S</button>
        {divider}
        <button type="button" style={btnStyle(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" style={btnStyle(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <button type="button" style={btnStyle(editor.isActive("paragraph"))} onClick={() => editor.chain().focus().setParagraph().run()}>P</button>
        {divider}
        <button type="button" style={btnStyle(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
        <button type="button" style={btnStyle(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
        <button type="button" style={btnStyle(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>&ldquo; Quote</button>
        <button type="button" style={btnStyle(editor.isActive("codeBlock"))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{"</>"}</button>
        {divider}
        <button type="button" style={btnStyle(editor.isActive("link"))} onClick={handleSetLink}>🔗 Link</button>
        <button type="button" style={btnStyle(false)} onClick={handleInsertImage}>🖼 Image</button>
        {divider}
        <button type="button" style={btnStyle(false)} onClick={() => editor.chain().focus().undo().run()}>↺</button>
        <button type="button" style={btnStyle(false)} onClick={() => editor.chain().focus().redo().run()}>↻</button>
      </div>

      <EditorContent editor={editor} />

      <style jsx global>{`
        .blog-editor-prose {
          min-height: 400px;
          max-width: none;
          padding: 16px 20px;
          outline: none;
          color: ${TEXT_DARK} !important;
          background: #ffffff;
          font-size: 15px;
        }
        .blog-editor-prose * {
          color: inherit;
        }
        .blog-editor-prose h2 {
          font-family: var(--pr-font-heading, "Fraunces", serif);
          font-size: 1.5rem;
          font-weight: 600;
          margin: 1.25rem 0 0.5rem;
          color: ${ACCENT} !important;
        }
        .blog-editor-prose h3 {
          font-family: var(--pr-font-heading, "Fraunces", serif);
          font-size: 1.25rem;
          font-weight: 600;
          margin: 1rem 0 0.5rem;
          color: ${TEXT_DARK} !important;
        }
        .blog-editor-prose p {
          margin: 0.5rem 0;
          line-height: 1.7;
          color: ${TEXT_DARK} !important;
        }
        .blog-editor-prose img {
          max-width: 100%;
          border-radius: 0.5rem;
          margin: 1rem 0;
        }
        .blog-editor-prose blockquote {
          border-left: 3px solid ${ACCENT};
          padding-left: 1rem;
          font-style: italic;
          color: ${TEXT_MED} !important;
          margin: 1rem 0;
        }
        .blog-editor-prose ul, .blog-editor-prose ol {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
          color: ${TEXT_DARK} !important;
        }
        .blog-editor-prose code {
          background: #f0e8dd;
          color: ${TEXT_DARK} !important;
          padding: 0.15rem 0.4rem;
          border-radius: 0.25rem;
          font-size: 0.9em;
        }
        .blog-editor-prose pre {
          background: #2a1f1a;
          color: #f5efe6 !important;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
        }
        .blog-editor-prose pre code {
          background: transparent;
          color: inherit !important;
        }
        .blog-editor-prose a {
          color: ${ACCENT} !important;
          text-decoration: underline;
        }
        .blog-editor-prose p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #8c8f94 !important;
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  );
}
