import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import KanbanCard from "./KanbanCard";
import StageDialog from "./StageDialog";
import { useUserRole } from "@/hooks/useUserRole";
import type { Tables } from "@/integrations/supabase/types";

type Deal = Tables<"deals"> & {
  contacts: { first_name: string; last_name: string } | null;
  organizations: { name: string } | null;
  assigned_user: { id: string; full_name: string; avatar_url: string | null } | null;
};

interface KanbanColumnProps {
  stage: Tables<"stages">;
  deals: Deal[];
}

export default function KanbanColumn({ stage, deals }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: {
      stage,
    },
  });

  const { role } = useUserRole();
  const isAdmin = role === "admin";

  // Calculate financial metrics
  const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
  const weightedValue = totalValue * ((stage.probability || 50) / 100);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="flex-shrink-0 w-64">
      <div className="bg-muted/50 rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <StageDialog
                trigger={
                  <button className="text-sm font-semibold text-foreground hover:text-primary hover:underline cursor-pointer transition-colors">
                    {stage.name}
                  </button>
                }
                pipelineId={stage.pipeline_id}
                stage={stage}
              />
            ) : (
              <h3 className="text-sm font-semibold text-foreground">{stage.name}</h3>
            )}
            {isAdmin && (
              <StageDialog
                trigger={
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Plus className="h-3 w-3" />
                  </Button>
                }
                pipelineId={stage.pipeline_id}
              />
            )}
          </div>
          <span className="text-sm text-muted-foreground bg-muted rounded-full px-2 py-1">
            {deals.length}
          </span>
        </div>

        {/* Financial Intelligence */}
        {totalValue > 0 && (
          <div className="mb-2 p-2 bg-background/50 rounded-lg border border-border">
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Total:</span>
                <span className="text-sm font-bold text-foreground">{formatCurrency(totalValue)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Previsto ({stage.probability}%):</span>
                <span className="text-sm font-semibold text-primary">{formatCurrency(weightedValue)}</span>
              </div>
            </div>
          </div>
        )}

        <div
          ref={setNodeRef}
          className={cn(
            "min-h-[400px] transition-colors rounded-lg",
            isOver && "bg-primary/5 ring-2 ring-primary"
          )}
        >
          {deals.map((deal) => (
            <KanbanCard key={deal.id} deal={deal} />
          ))}
          {deals.length === 0 && (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Nenhum negócio
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
