"use client";

import { useCallback, useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
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

export default function BlogEditor({
  initialContent,
  onChange,
}: BlogEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,

    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3, 4],
        },
      }),

      Underline,

      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
        },
      }),

      Image.configure({
        inline: false,
        allowBase64: false,
      }),

      Placeholder.configure({
        placeholder:
          "Start with a clear answer or introduction, then use H2 and H3 sections to explain the topic...",
      }),
    ],

    content:
      initialContent &&
      Object.keys(initialContent).length
        ? initialContent
        : "",

    editorProps: {
      attributes: {
        class: "blog-editor-prose",
        spellcheck: "true",
        "aria-label": "Blog post content",
      },
    },

    onUpdate: ({ editor: currentEditor }) => {
      onChange(
        currentEditor.getJSON(),
        currentEditor.getHTML(),
      );
    },
  });

  useEffect(() => {
    if (
      editor &&
      initialContent &&
      Object.keys(initialContent).length
    ) {
      const current = JSON.stringify(
        editor.getJSON(),
      );
      const incoming = JSON.stringify(
        initialContent,
      );

      if (current !== incoming) {
        editor.commands.setContent(
          initialContent,
          {
            emitUpdate: false,
          },
        );
      }
    }
  }, [initialContent, editor]);

  const uploadImage = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        "/api/admin/blog/upload",
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await res.json();

      if (!res.ok) {
        alert(
          data.error ||
            "Image upload failed",
        );
        return null;
      }

      return data.url as string;
    },
    [],
  );

  const handleInsertImage = useCallback(
    async () => {
      const input =
        document.createElement("input");

      input.type = "file";
      input.accept = "image/*";

      input.onchange = async () => {
        const file = input.files?.[0];

        if (!file || !editor) return;

        const url = await uploadImage(file);

        if (!url) return;

        const alt =
          window.prompt(
            "Image alt text (describe what the image shows)",
            "",
          ) ?? "";

        editor
          .chain()
          .focus()
          .setImage({
            src: url,
            alt:
              alt.trim() ||
              "Blog article image",
          })
          .run();
      };

      input.click();
    },
    [editor, uploadImage],
  );

  const handleSetLink = useCallback(() => {
    if (!editor) return;

    const previousUrl =
      editor.getAttributes("link").href;

    const url = window.prompt(
      "Enter URL",
      previousUrl || "https://",
    );

    if (url === null) return;

    if (url.trim() === "") {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .unsetLink()
        .run();

      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({
        href: url.trim(),
      })
      .run();
  }, [editor]);

  if (!editor) return null;

  const btnStyle = (
    active: boolean,
  ): React.CSSProperties => ({
    minHeight: "32px",
    padding: "7px 10px",
    borderRadius: "7px",
    fontSize: "12px",
    fontWeight: 600,
    color: active
      ? "#ffffff"
      : TEXT_MED,
    background: active
      ? ACCENT
      : "transparent",
    border: "none",
    cursor: "pointer",
    lineHeight: 1,
    transition:
      "background 160ms ease, color 160ms ease, transform 160ms ease",
  });

  const divider = (
    <div
      aria-hidden="true"
      style={{
        width: "1px",
        height: "22px",
        background: BORDER,
        margin: "0 3px",
      }}
    />
  );

  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: "12px",
        overflow: "hidden",
        background: "#ffffff",
        boxShadow:
          "0 8px 30px rgba(29,35,39,0.05)",
      }}
    >
      <div
        style={{
          padding:
            "10px 10px 8px",
          background:
            "linear-gradient(180deg,#ffffff,#f8f9f9)",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "3px",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            style={btnStyle(
              editor.isActive("bold"),
            )}
            onClick={() =>
              editor
                .chain()
                .focus()
                .toggleBold()
                .run()
            }
            title="Bold"
          >
            B
          </button>

          <button
            type="button"
            style={{
              ...btnStyle(
                editor.isActive(
                  "italic",
                ),
              ),
              fontStyle: "italic",
            }}
            onClick={() =>
              editor
                .chain()
                .focus()
                .toggleItalic()
                .run()
            }
            title="Italic"
          >
            I
          </button>

          <button
            type="button"
            style={{
              ...btnStyle(
                editor.isActive(
                  "underline",
                ),
              ),
              textDecoration:
                "underline",
            }}
            onClick={() =>
              editor
                .chain()
                .focus()
                .toggleUnderline()
                .run()
            }
            title="Underline"
          >
            U
          </button>

          <button
            type="button"
            style={{
              ...btnStyle(
                editor.isActive(
                  "strike",
                ),
              ),
              textDecoration:
                "line-through",
            }}
            onClick={() =>
              editor
                .chain()
                .focus()
                .toggleStrike()
                .run()
            }
            title="Strikethrough"
          >
            S
          </button>

          {divider}

          <button
            type="button"
            style={btnStyle(
              editor.isActive(
                "heading",
                { level: 2 },
              ),
            )}
            onClick={() =>
              editor
                .chain()
                .focus()
                .toggleHeading({
                  level: 2,
                })
                .run()
            }
            title="Heading 2"
          >
            H2
          </button>

          <button
            type="button"
            style={btnStyle(
              editor.isActive(
                "heading",
                { level: 3 },
              ),
            )}
            onClick={() =>
              editor
                .chain()
                .focus()
                .toggleHeading({
                  level: 3,
                })
                .run()
            }
            title="Heading 3"
          >
            H3
          </button>

          <button
            type="button"
            style={btnStyle(
              editor.isActive(
                "heading",
                { level: 4 },
              ),
            )}
            onClick={() =>
              editor
                .chain()
                .focus()
                .toggleHeading({
                  level: 4,
                })
                .run()
            }
            title="Heading 4"
          >
            H4
          </button>

          <button
            type="button"
            style={btnStyle(
              editor.isActive(
                "paragraph",
              ),
            )}
            onClick={() =>
              editor
                .chain()
                .focus()
                .setParagraph()
                .run()
            }
            title="Paragraph"
          >
            P
          </button>

          {divider}

          <button
            type="button"
            style={btnStyle(
              editor.isActive(
                "bulletList",
              ),
            )}
            onClick={() =>
              editor
                .chain()
                .focus()
                .toggleBulletList()
                .run()
            }
          >
            • List
          </button>

          <button
            type="button"
            style={btnStyle(
              editor.isActive(
                "orderedList",
              ),
            )}
            onClick={() =>
              editor
                .chain()
                .focus()
                .toggleOrderedList()
                .run()
            }
          >
            1. List
          </button>

          <button
            type="button"
            style={btnStyle(
              editor.isActive(
                "blockquote",
              ),
            )}
            onClick={() =>
              editor
                .chain()
                .focus()
                .toggleBlockquote()
                .run()
            }
          >
            “ Quote
          </button>

          <button
            type="button"
            style={btnStyle(
              editor.isActive(
                "codeBlock",
              ),
            )}
            onClick={() =>
              editor
                .chain()
                .focus()
                .toggleCodeBlock()
                .run()
            }
          >
            {"</>"}
          </button>

          {divider}

          <button
            type="button"
            style={btnStyle(
              editor.isActive("link"),
            )}
            onClick={handleSetLink}
          >
            🔗 Link
          </button>

          <button
            type="button"
            style={btnStyle(false)}
            onClick={handleInsertImage}
          >
            🖼 Image
          </button>

          {divider}

          <button
            type="button"
            style={btnStyle(false)}
            onClick={() =>
              editor
                .chain()
                .focus()
                .undo()
                .run()
            }
            title="Undo"
          >
            ↺
          </button>

          <button
            type="button"
            style={btnStyle(false)}
            onClick={() =>
              editor
                .chain()
                .focus()
                .redo()
                .run()
            }
            title="Redo"
          >
            ↻
          </button>
        </div>

        <div
          style={{
            marginTop: "8px",
            padding:
              "7px 9px",
            borderRadius: "8px",
            background: "#fbf7f0",
            color: TEXT_MED,
            fontSize: "11px",
            lineHeight: 1.45,
          }}
        >
          <strong
            style={{
              color: ACCENT,
            }}
          >
            Writing tip:
          </strong>{" "}
          Start with a direct answer, then break the
          article into clear H2/H3 sections. Use useful
          examples, original details, and descriptive
          links rather than repeating keywords.
        </div>
      </div>

      <EditorContent editor={editor} />

      <style jsx global>{`
        .blog-editor-prose {
          min-height: 460px;
          max-width: none;
          padding: 22px 24px;
          outline: none;
          color: ${TEXT_DARK} !important;
          background: #ffffff;
          font-size: 16px;
          line-height: 1.8;
        }

        .blog-editor-prose:focus {
          outline: none;
        }

        .blog-editor-prose > *:first-child {
          margin-top: 0;
        }

        .blog-editor-prose * {
          color: inherit;
        }

        .blog-editor-prose h2 {
          font-family:
            var(
              --pr-font-heading,
              "Fraunces",
              Georgia,
              serif
            );
          font-size: 1.7rem;
          font-weight: 650;
          line-height: 1.2;
          margin: 1.8rem 0 0.7rem;
          color: ${ACCENT} !important;
          scroll-margin-top: 6rem;
        }

        .blog-editor-prose h3 {
          font-family:
            var(
              --pr-font-heading,
              "Fraunces",
              Georgia,
              serif
            );
          font-size: 1.28rem;
          font-weight: 650;
          line-height: 1.3;
          margin: 1.45rem 0 0.55rem;
          color: ${TEXT_DARK} !important;
          scroll-margin-top: 6rem;
        }

        .blog-editor-prose h4 {
          font-size: 1.05rem;
          font-weight: 700;
          line-height: 1.35;
          margin: 1.2rem 0 0.45rem;
          color: ${TEXT_DARK} !important;
        }

        .blog-editor-prose p {
          margin: 0.85rem 0;
          line-height: 1.8;
          color: ${TEXT_DARK} !important;
        }

        .blog-editor-prose ul,
        .blog-editor-prose ol {
          padding-left: 1.55rem;
          margin: 0.9rem 0 1.1rem;
          color: ${TEXT_DARK} !important;
        }

        .blog-editor-prose li {
          margin: 0.35rem 0;
          line-height: 1.75;
        }

        .blog-editor-prose img {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 0.8rem;
          margin: 1.35rem auto;
          box-shadow:
            0 12px 30px rgba(29,35,39,0.08);
        }

        .blog-editor-prose blockquote {
          border-left: 3px solid ${ACCENT};
          padding: 0.25rem 0 0.25rem 1rem;
          font-style: italic;
          color: ${TEXT_MED} !important;
          margin: 1.25rem 0;
          background: #fbf7f0;
          border-radius: 0 0.7rem 0.7rem 0;
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
          border-radius: 0.65rem;
          overflow-x: auto;
          margin: 1.25rem 0;
          line-height: 1.6;
        }

        .blog-editor-prose pre code {
          background: transparent;
          color: inherit !important;
        }

        .blog-editor-prose a {
          color: ${ACCENT} !important;
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 3px;
        }

        .blog-editor-prose a:hover {
          text-decoration-thickness: 2px;
        }

        .blog-editor-prose p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #8c8f94 !important;
          pointer-events: none;
          height: 0;
        }

        @media (max-width: 640px) {
          .blog-editor-prose {
            min-height: 390px;
            padding: 18px 16px;
            font-size: 15px;
          }

          .blog-editor-prose h2 {
            font-size: 1.45rem;
          }

          .blog-editor-prose h3 {
            font-size: 1.18rem;
          }
        }
      `}</style>
    </div>
  );
}
