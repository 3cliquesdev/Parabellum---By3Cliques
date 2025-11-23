import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Pencil } from "lucide-react";
import DealDialog from "./DealDialog";
import type { Tables } from "@/integrations/supabase/types";

type Deal = Tables<"deals"> & {
  contacts: { first_name: string; last_name: string } | null;
  organizations: { name: string } | null;
};

interface KanbanCardProps {
  deal: Deal;
}

export default function KanbanCard({ deal }: KanbanCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: {
      deal,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        className="cursor-grab active:cursor-grabbing mb-3 hover:border-primary transition-colors relative group"
      >
        <CardContent className="p-4">
          {/* Botão de Edição - Aparece no hover */}
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditDialogOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>

          {/* Área draggable */}
          <div {...listeners} {...attributes}>
            <h4 className="font-semibold text-foreground mb-2 pr-8">{deal.title}</h4>
            
            {deal.value && (
              <p className="text-lg font-bold text-success mb-2">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: deal.currency || 'BRL',
                }).format(deal.value)}
              </p>
            )}

            {deal.contacts && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{deal.contacts.first_name} {deal.contacts.last_name}</span>
              </div>
            )}

            {deal.organizations && (
              <Badge variant="secondary" className="mt-2">
                {deal.organizations.name}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      {isEditDialogOpen && (
        <DealDialog
          deal={deal}
          trigger={<span />}
          onOpenChange={setIsEditDialogOpen}
        />
      )}
    </>
  );
}
