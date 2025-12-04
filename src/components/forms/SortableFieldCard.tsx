import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FormField } from "@/hooks/useForms";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  GripVertical, 
  Trash2, 
  Copy,
  Type, 
  Mail, 
  Phone, 
  List, 
  Star, 
  AlignLeft, 
  ThumbsUp, 
  Calendar,
  Hash,
  GitBranch
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableFieldCardProps {
  field: FormField;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const FIELD_ICONS: Record<string, React.ReactNode> = {
  text: <Type className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
  select: <List className="h-4 w-4" />,
  rating: <Star className="h-4 w-4" />,
  long_text: <AlignLeft className="h-4 w-4" />,
  yes_no: <ThumbsUp className="h-4 w-4" />,
  date: <Calendar className="h-4 w-4" />,
  number: <Hash className="h-4 w-4" />,
};

const FIELD_LABELS: Record<string, string> = {
  text: "Texto",
  email: "E-mail",
  phone: "Telefone",
  select: "Seleção",
  rating: "Avaliação",
  long_text: "Texto Longo",
  yes_no: "Sim/Não",
  date: "Data",
  number: "Número",
};

export function SortableFieldCard({
  field,
  index,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: SortableFieldCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-4 cursor-pointer transition-all",
        isSelected && "ring-2 ring-primary border-primary",
        isDragging && "opacity-50 shadow-lg"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Field Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-primary">
              {FIELD_ICONS[field.type]}
            </div>
            <Badge variant="secondary" className="text-xs">
              {FIELD_LABELS[field.type]}
            </Badge>
            {field.required && (
              <Badge variant="destructive" className="text-xs">
                Obrigatório
              </Badge>
            )}
            {field.logic && (
              <Badge variant="outline" className="text-xs gap-1">
                <GitBranch className="h-3 w-3" />
                Lógica
              </Badge>
            )}
          </div>
          <p className="font-medium truncate">{field.label}</p>
          {field.description && (
            <p className="text-sm text-muted-foreground truncate mt-1">
              {field.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onDuplicate}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
