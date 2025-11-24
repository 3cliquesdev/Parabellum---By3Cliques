import { useDraggable } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User, Pencil } from "lucide-react";
import DealDialog from "./DealDialog";
import type { Tables } from "@/integrations/supabase/types";

type Deal = Tables<"deals"> & {
  contacts: { first_name: string; last_name: string } | null;
  organizations: { name: string } | null;
  assigned_user: { id: string; full_name: string; avatar_url: string | null } | null;
};

interface KanbanCardProps {
  deal: Deal;
}

export default function KanbanCard({ deal }: KanbanCardProps) {
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
    <Card
      ref={setNodeRef}
      style={style}
      className="cursor-grab active:cursor-grabbing mb-3 hover:border-primary transition-colors relative group"
    >
      <CardContent className="p-4">
        <DealDialog
          deal={deal}
          trigger={
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          }
        />

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

          {deal.assigned_user && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
              <Avatar className="h-6 w-6">
                <AvatarImage 
                  src={deal.assigned_user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${deal.assigned_user.full_name}`} 
                  alt={deal.assigned_user.full_name} 
                />
                <AvatarFallback className="text-xs">
                  {deal.assigned_user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">{deal.assigned_user.full_name}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
