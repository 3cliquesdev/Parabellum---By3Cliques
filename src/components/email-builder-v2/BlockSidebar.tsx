import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import {
  Type,
  Image,
  MousePointerClick,
  Minus,
  Columns,
  PanelTop,
  PenTool,
  SeparatorHorizontal,
  Share2,
  Code,
} from "lucide-react";
import type { BlockType } from "@/types/emailBuilderV2";

interface BlockItem {
  type: BlockType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const BLOCK_ITEMS: BlockItem[] = [
  { type: "text", label: "Texto", icon: <Type className="h-5 w-5" />, description: "Parágrafo ou título" },
  { type: "image", label: "Imagem", icon: <Image className="h-5 w-5" />, description: "Imagem ou logo" },
  { type: "button", label: "Botão", icon: <MousePointerClick className="h-5 w-5" />, description: "Call to action" },
  { type: "spacer", label: "Espaçador", icon: <Minus className="h-5 w-5" />, description: "Espaço vertical" },
  { type: "columns", label: "Colunas", icon: <Columns className="h-5 w-5" />, description: "Layout 2-4 colunas" },
  { type: "banner", label: "Banner", icon: <PanelTop className="h-5 w-5" />, description: "Header full-width" },
  { type: "signature", label: "Assinatura", icon: <PenTool className="h-5 w-5" />, description: "Assinatura do remetente" },
  { type: "divider", label: "Divisor", icon: <SeparatorHorizontal className="h-5 w-5" />, description: "Linha divisória" },
  { type: "social", label: "Redes Sociais", icon: <Share2 className="h-5 w-5" />, description: "Links sociais" },
  { type: "html", label: "HTML", icon: <Code className="h-5 w-5" />, description: "Código HTML customizado" },
];

interface DraggableBlockProps {
  item: BlockItem;
}

function DraggableBlock({ item }: DraggableBlockProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `new-block-${item.type}`,
    data: {
      type: "block",
      blockType: item.type,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border cursor-grab transition-all",
        "bg-card hover:bg-accent hover:border-primary/50",
        isDragging && "opacity-50 ring-2 ring-primary"
      )}
    >
      <div className="flex-shrink-0 text-muted-foreground">{item.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{item.label}</p>
        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
      </div>
    </div>
  );
}

export function BlockSidebar() {
  return (
    <div className="w-64 border-r bg-muted/30 flex flex-col h-full text-foreground">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Blocos</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Arraste para o canvas
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {BLOCK_ITEMS.map((item) => (
          <DraggableBlock key={item.type} item={item} />
        ))}
      </div>
    </div>
  );
}
