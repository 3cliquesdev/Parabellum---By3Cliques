import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  CheckCircle2,
  MessageSquare,
  Paperclip,
  Clock,
  AlertCircle,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProjectCard } from "@/hooks/useProjectCards";

interface KanbanCardProps {
  card: ProjectCard;
  isDragging?: boolean;
  onClick?: () => void;
}

const priorityConfig = {
  low: { label: "Baixa", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  medium: { label: "Média", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  high: { label: "Alta", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  urgent: { label: "Urgente", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

export function KanbanCard({ card, isDragging, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue = card.due_date && new Date(card.due_date) < new Date() && !card.is_completed;
  const isDueSoon =
    card.due_date &&
    !isOverdue &&
    new Date(card.due_date) <= new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

  // Handle click separately from drag
  const handleClick = (e: React.MouseEvent | React.PointerEvent) => {
    // Only trigger click if not dragging
    if (!isSortableDragging && onClick) {
      e.stopPropagation();
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      onPointerUp={handleClick}
      className={cn(
        "bg-card border rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow",
        (isDragging || isSortableDragging) && "opacity-50 shadow-lg rotate-2",
        card.is_completed && "opacity-60"
      )}
    >
      {/* Cover Image */}
      {card.cover_image_url && (
        <div className="mb-2 -mx-3 -mt-3 rounded-t-lg overflow-hidden">
          <img
            src={card.cover_image_url}
            alt=""
            className="w-full h-24 object-cover"
          />
        </div>
      )}

      {/* Labels */}
      {card.labels && card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.labels.slice(0, 3).map((labelData) => (
            <div
              key={labelData.label_id}
              className="h-2 w-8 rounded-full"
              style={{ backgroundColor: labelData.label?.color || "#888" }}
              title={labelData.label?.name}
            />
          ))}
          {card.labels.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{card.labels.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Title */}
      <div className="flex items-start gap-2">
        {card.is_completed && (
          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
        )}
        <h4 className={cn("text-sm font-medium flex-1", card.is_completed && "line-through")}>
          {card.title}
        </h4>
      </div>

      {/* Priority Badge */}
      {card.priority !== "low" && (
        <Badge variant="outline" className={cn("mt-2", priorityConfig[card.priority].className)}>
          {card.priority === "urgent" && <AlertCircle className="h-3 w-3 mr-1" />}
          {priorityConfig[card.priority].label}
        </Badge>
      )}

      {/* Due Date */}
      {card.due_date && (
        <div
          className={cn(
            "flex items-center gap-1 mt-2 text-xs",
            isOverdue && "text-red-500",
            isDueSoon && !isOverdue && "text-orange-500",
            !isOverdue && !isDueSoon && "text-muted-foreground"
          )}
        >
          <Calendar className="h-3 w-3" />
          <span>
            {format(new Date(card.due_date), "dd MMM", { locale: ptBR })}
          </span>
          {isOverdue && <span className="font-medium">(atrasado)</span>}
        </div>
      )}

      {/* Footer: Metadata & Assignees */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {/* Checklist progress */}
          {card.checklists_count !== undefined && card.checklists_count > 0 && (
            <div className="flex items-center gap-1">
              <CheckSquare className="h-3 w-3" />
              <span>
                {card.checklists_completed || 0}/{card.checklists_count}
              </span>
            </div>
          )}

          {/* Comments count */}
          {card.comments_count !== undefined && card.comments_count > 0 && (
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              <span>{card.comments_count}</span>
            </div>
          )}

          {/* Attachments count */}
          {card.attachments_count !== undefined && card.attachments_count > 0 && (
            <div className="flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              <span>{card.attachments_count}</span>
            </div>
          )}

          {/* Estimated hours */}
          {card.estimated_hours && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{card.estimated_hours}h</span>
            </div>
          )}
        </div>

        {/* Assignees */}
        {card.assignees && card.assignees.length > 0 && (
          <div className="flex -space-x-2">
            {card.assignees.slice(0, 3).map((assignee) => (
              <Avatar key={assignee.id} className="h-6 w-6 border-2 border-card">
                <AvatarImage src={assignee.profile?.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">
                  {assignee.profile?.full_name?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            ))}
            {card.assignees.length > 3 && (
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] border-2 border-card">
                +{card.assignees.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
