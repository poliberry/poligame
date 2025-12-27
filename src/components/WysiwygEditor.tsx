import React, { useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Image as ImageIcon, Code } from "lucide-react";

interface WysiwygEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

export const WysiwygEditor: React.FC<WysiwygEditorProps> = ({
  content,
  onChange,
  placeholder = "Write your post...",
  className = "",
}) => {
  const isUpdatingFromProps = useRef(false);
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-400 hover:text-blue-300 underline",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      if (!isUpdatingFromProps.current) {
        onChange(editor.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class: "prose text-foreground prose-invert max-w-none focus:outline-none min-h-[200px] p-3",
      },
    },
  });

  // Update editor content when prop changes (but not when user is typing)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      isUpdatingFromProps.current = true;
      editor.commands.setContent(content, { emitUpdate: false });
      isUpdatingFromProps.current = false;
    }
  }, [editor, content]);

  const addImage = useCallback(() => {
    const url = window.prompt("Enter image URL:");
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL:", previousUrl);

    if (url === null) {
      return;
    }

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={`border border-foreground/20 bg-foreground/5 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-foreground/10 flex-wrap">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-foreground/10 transition-colors ${
            editor.isActive("bold") ? "bg-foreground/20" : ""
          }`}
          title="Bold"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-foreground/10 transition-colors ${
            editor.isActive("italic") ? "bg-foreground/20" : ""
          }`}
          title="Italic"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          className={`p-2 rounded hover:bg-foreground/10 transition-colors ${
            editor.isActive("code") ? "bg-foreground/20" : ""
          }`}
          title="Code"
        >
          <Code size={16} />
        </button>
        <div className="w-px h-6 bg-foreground/20 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded hover:bg-foreground/10 transition-colors ${
            editor.isActive("heading", { level: 1 }) ? "bg-foreground/20" : ""
          }`}
          title="Heading 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-foreground/10 transition-colors ${
            editor.isActive("heading", { level: 2 }) ? "bg-foreground/20" : ""
          }`}
          title="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 rounded hover:bg-foreground/10 transition-colors ${
            editor.isActive("heading", { level: 3 }) ? "bg-foreground/20" : ""
          }`}
          title="Heading 3"
        >
          H3
        </button>
        <div className="w-px h-6 bg-foreground/20 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-foreground/10 transition-colors ${
            editor.isActive("bulletList") ? "bg-foreground/20" : ""
          }`}
          title="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-foreground/10 transition-colors ${
            editor.isActive("orderedList") ? "bg-foreground/20" : ""
          }`}
          title="Numbered List"
        >
          <ListOrdered size={16} />
        </button>
        <div className="w-px h-6 bg-foreground/20 mx-1" />
        <button
          type="button"
          onClick={addLink}
          className={`p-2 rounded hover:bg-foreground/10 transition-colors ${
            editor.isActive("link") ? "bg-foreground/20" : ""
          }`}
          title="Add Link"
        >
          <LinkIcon size={16} />
        </button>
        <button
          type="button"
          onClick={addImage}
          className="p-2 rounded hover:bg-foreground/10 transition-colors"
          title="Add Image"
        >
          <ImageIcon size={16} />
        </button>
      </div>

      {/* Editor */}
      <div className="min-h-[200px] max-h-[500px] overflow-y-auto text-foreground">
        <EditorContent editor={editor} className="text-foreground" />
      </div>
    </div>
  );
};

