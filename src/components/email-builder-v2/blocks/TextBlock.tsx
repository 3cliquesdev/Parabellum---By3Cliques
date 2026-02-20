import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Type
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EmailBlock } from "@/types/emailBuilderV2";

interface TextBlockProps {
  block: EmailBlock;
  isSelected: boolean;
  onUpdate: (content: { html: string }) => void;
  onStyleUpdate?: (styles: Partial<EmailBlock['styles']>) => void;
  readOnly?: boolean;
}

const fontSizes = [
  { label: "Pequeno", value: "14px" },
  { label: "Normal", value: "16px" },
  { label: "Médio", value: "18px" },
  { label: "Grande", value: "22px" },
  { label: "Extra Grande", value: "28px" },
];

export function TextBlock({ block, isSelected, onUpdate, onStyleUpdate, readOnly }: TextBlockProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
        },
      }),
      Placeholder.configure({
        placeholder: "Digite seu texto aqui... Use {{variável}} para personalização",
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
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

  const handleFontSizeChange = (size: string) => {
    if (onStyleUpdate) {
      onStyleUpdate({ fontSize: size });
    }
  };

  const handleAlignChange = (align: 'left' | 'center' | 'right') => {
    editor?.chain().focus().setTextAlign(align).run();
    if (onStyleUpdate) {
      onStyleUpdate({ textAlign: align });
    }
  };

  return (
    <div
      className={cn(
        "min-h-[60px] transition-all relative group",
        isSelected && "ring-2 ring-primary ring-offset-2"
      )}
      style={{
        backgroundColor: block.styles.backgroundColor || '#ffffff',
        color: block.styles.color || '#1e293b',
        padding: block.styles.padding || "16px",
        textAlign: block.styles.textAlign as any,
        fontSize: block.styles.fontSize,
      }}
    >
      {/* Toolbar - aparece quando selecionado e não é readOnly */}
      {isSelected && !readOnly && editor && (
        <div className="absolute -top-10 left-0 right-0 flex items-center gap-1 bg-background border rounded-lg shadow-lg p-1 z-10">
          {/* Bold */}
          <Button
            type="button"
            variant={editor.isActive('bold') ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-4 w-4" />
          </Button>
          
          {/* Italic */}
          <Button
            type="button"
            variant={editor.isActive('italic') ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Align Left */}
          <Button
            type="button"
            variant={editor.isActive({ textAlign: 'left' }) ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => handleAlignChange('left')}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          
          {/* Align Center */}
          <Button
            type="button"
            variant={editor.isActive({ textAlign: 'center' }) ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => handleAlignChange('center')}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          
          {/* Align Right */}
          <Button
            type="button"
            variant={editor.isActive({ textAlign: 'right' }) ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => handleAlignChange('right')}
          >
            <AlignRight className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Font Size */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2">
                <Type className="h-4 w-4" />
                <span className="text-xs">{block.styles.fontSize || '16px'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {fontSizes.map((size) => (
                <DropdownMenuItem
                  key={size.value}
                  onClick={() => handleFontSizeChange(size.value)}
                  className={block.styles.fontSize === size.value ? "bg-accent" : ""}
                >
                  <span style={{ fontSize: size.value }}>{size.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <EditorContent 
        editor={editor} 
        className="prose prose-sm max-w-none prose-slate focus:outline-none [&_*]:text-inherit"
      />
    </div>
  );
}
