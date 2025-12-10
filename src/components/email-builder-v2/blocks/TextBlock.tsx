import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import type { EmailBlock } from "@/types/emailBuilderV2";

interface TextBlockProps {
  block: EmailBlock;
  isSelected: boolean;
  onUpdate: (content: { html: string }) => void;
  readOnly?: boolean;
}

export function TextBlock({ block, isSelected, onUpdate, readOnly }: TextBlockProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: "Digite seu texto aqui... Use {{variavel}} para personalização",
      }),
    ],
    content: block.content.html || "<p></p>",
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onUpdate({ html: editor.getHTML() });
    },
  });

  useEffect(() => {
    if (editor && block.content.html !== editor.getHTML()) {
      editor.commands.setContent(block.content.html || "<p></p>");
    }
  }, [block.content.html]);

  return (
    <div
      className={cn(
        "min-h-[60px] transition-all",
        isSelected && "ring-2 ring-primary ring-offset-2"
      )}
      style={{
        backgroundColor: block.styles.backgroundColor || '#ffffff',
        color: block.styles.color || '#1e293b',
        padding: block.styles.padding || "16px",
        textAlign: block.styles.textAlign,
        fontSize: block.styles.fontSize,
      }}
    >
      <EditorContent 
        editor={editor} 
        className="prose prose-sm max-w-none prose-slate focus:outline-none [&_*]:text-inherit"
      />
    </div>
  );
}
