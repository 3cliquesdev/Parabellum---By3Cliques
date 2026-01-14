import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { GripVertical, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EmailBlock } from "@/types/emailBuilderV2";

import { TextBlock } from "./blocks/TextBlock";
import { ImageBlock } from "./blocks/ImageBlock";
import { ButtonBlock } from "./blocks/ButtonBlock";
import { SpacerBlock } from "./blocks/SpacerBlock";
import { DividerBlock } from "./blocks/DividerBlock";
import { BannerBlock } from "./blocks/BannerBlock";
import { SignatureBlock } from "./blocks/SignatureBlock";
import { SocialBlock } from "./blocks/SocialBlock";
import { HtmlBlock } from "./blocks/HtmlBlock";
import { ColumnsBlock } from "./blocks/ColumnsBlock";

interface BlockRendererProps {
  block: EmailBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (content: Partial<EmailBlock['content']>) => void;
  onStyleUpdate: (styles: Partial<EmailBlock['styles']>) => void;
  onDelete: () => void;
  readOnly?: boolean;
}

export function BlockRenderer({
  block,
  isSelected,
  onSelect,
  onUpdate,
  onStyleUpdate,
  onDelete,
  readOnly,
}: BlockRendererProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const renderBlock = () => {
    switch (block.block_type) {
      case "text":
        return <TextBlock block={block} isSelected={isSelected} onUpdate={onUpdate} onStyleUpdate={onStyleUpdate} readOnly={readOnly} />;
      case "image":
        return <ImageBlock block={block} isSelected={isSelected} onUpdate={onUpdate} readOnly={readOnly} />;
      case "button":
        return <ButtonBlock block={block} isSelected={isSelected} onUpdate={onUpdate} onStyleUpdate={onStyleUpdate} readOnly={readOnly} />;
      case "spacer":
        return <SpacerBlock block={block} isSelected={isSelected} onUpdate={onUpdate} readOnly={readOnly} />;
      case "divider":
        return <DividerBlock block={block} isSelected={isSelected} readOnly={readOnly} />;
      case "banner":
        return <BannerBlock block={block} isSelected={isSelected} onUpdate={onUpdate} onStyleUpdate={onStyleUpdate} readOnly={readOnly} />;
      case "signature":
        return <SignatureBlock block={block} isSelected={isSelected} onUpdate={onUpdate} readOnly={readOnly} />;
      case "social":
        return <SocialBlock block={block} isSelected={isSelected} onUpdate={onUpdate} readOnly={readOnly} />;
      case "html":
        return <HtmlBlock block={block} isSelected={isSelected} onUpdate={onUpdate} readOnly={readOnly} />;
      case "columns":
        return <ColumnsBlock block={block} isSelected={isSelected} onUpdate={onUpdate} readOnly={readOnly} />;
      default:
        return <div className="p-4 bg-slate-100 text-slate-600 text-center">Bloco não suportado: {block.block_type}</div>;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        isDragging && "opacity-50 z-50"
      )}
      onClick={onSelect}
    >
      {!readOnly && (
        <div className={cn(
          "absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10",
          isSelected && "opacity-100"
        )}>
          <Button
            size="icon"
            variant="secondary"
            className="h-7 w-7 cursor-grab shadow-sm"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="h-7 w-7 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {renderBlock()}
    </div>
  );
}
