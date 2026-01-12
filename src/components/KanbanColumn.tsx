import { useState, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, ChevronUp, CheckSquare, Square } from "lucide-react";
import KanbanCard from "./KanbanCard";
import StageDialog from "./StageDialog";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import type { Tables } from "@/integrations/supabase/types";

type Deal = Tables<"deals"> & {
  contacts: { first_name: string; last_name: string } | null;
  organizations: { name: string } | null;
  assigned_user: { id: string; full_name: string; avatar_url: string | null } | null;
};

interface KanbanColumnProps {
  stage: Tables<"stages">;
  deals: Deal[];
  isSelectionMode?: boolean;
  selectedDeals?: Set<string>;
  onSelectionChange?: (dealId: string, selected: boolean) => void;
  onSelectAllInStage?: (dealIds: string[]) => void;
}

// Stage colors based on position/type - can be extended
const STAGE_COLORS = [
  "hsl(45, 93%, 47%)",   // Amber/Yellow
  "hsl(199, 89%, 48%)",  // Blue
  "hsl(262, 83%, 58%)",  // Purple
  "hsl(142, 71%, 45%)",  // Green
  "hsl(24, 95%, 53%)",   // Orange
  "hsl(330, 81%, 60%)",  // Pink
  "hsl(173, 80%, 40%)",  // Teal
  "hsl(0, 84%, 60%)",    // Red
];

export default function KanbanColumn({ 
  stage, 
  deals, 
  isSelectionMode = false,
  selectedDeals = new Set(),
  onSelectionChange,
  onSelectAllInStage,
}: KanbanColumnProps) {
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 5;
  
  const visibleDeals = showAll ? deals : deals.slice(0, LIMIT);
  const hasMore = deals.length > LIMIT;
  const remaining = deals.length - LIMIT;

  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: {
      stage,
    },
  });

  const { hasPermission } = useRolePermissions();
  const canManageStages = hasPermission('deals.manage_stages');

  // Calculate financial metrics
  const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Check if all deals in this column are selected
  const dealIds = useMemo(() => deals.map(d => d.id), [deals]);
  const allSelected = useMemo(() => 
    dealIds.length > 0 && dealIds.every(id => selectedDeals.has(id)),
    [dealIds, selectedDeals]
  );

  const handleSelectAllClick = () => {
    if (onSelectAllInStage && dealIds.length > 0) {
      onSelectAllInStage(dealIds);
    }
  };

  // Get color for this stage (based on position or use a default)
  const stageColor = STAGE_COLORS[(stage.position || 0) % STAGE_COLORS.length];

  return (
    <div className="flex-shrink-0" style={{ width: '300px', minWidth: '280px', maxWidth: '320px' }}>
      <div className="bg-card rounded-xl border border-border/40 shadow-sm overflow-hidden">
        {/* Color bar at top - enterprise style */}
        <div 
          className="h-1.5 w-full" 
          style={{ backgroundColor: stageColor }}
        />
        
        <div className="p-3">
          {/* Header - clean and minimal */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {canManageStages ? (
                <StageDialog
                  trigger={
                    <button className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate uppercase tracking-wide">
                      {stage.name}
                    </button>
                  }
                  pipelineId={stage.pipeline_id}
                  stage={stage}
                />
              ) : (
                <h3 className="text-sm font-semibold text-foreground truncate uppercase tracking-wide">
                  {stage.name}
                </h3>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Select All button - only visible in selection mode */}
              {isSelectionMode && dealIds.length > 0 && (
                <Button
                  variant={allSelected ? "default" : "ghost"}
                  size="sm"
                  className="h-6 px-2 text-xs gap-1"
                  onClick={handleSelectAllClick}
                >
                  {allSelected ? (
                    <CheckSquare className="h-3 w-3" />
                  ) : (
                    <Square className="h-3 w-3" />
                  )}
                </Button>
              )}
              
              {/* Deal count */}
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {deals.length}
              </span>
              
              {/* Add stage button */}
              {canManageStages && (
                <StageDialog
                  trigger={
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  }
                  pipelineId={stage.pipeline_id}
                />
              )}
            </div>
          </div>

          {/* Subtle total value - inline, not a box */}
          {totalValue > 0 && (
            <div className="mb-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{formatCurrency(totalValue)}</span>
              <span className="mx-1">•</span>
              <span>{stage.probability || 50}% prob.</span>
            </div>
          )}

          {/* Droppable area */}
          <div
            ref={setNodeRef}
            className={cn(
              "min-h-[400px] transition-all rounded-lg space-y-2",
              isOver && "bg-primary/5 ring-2 ring-primary/30 ring-inset"
            )}
          >
            {visibleDeals.map((deal) => (
              <KanbanCard 
                key={deal.id} 
                deal={deal}
                isSelectionMode={isSelectionMode}
                isSelected={selectedDeals.has(deal.id)}
                onSelectionChange={onSelectionChange}
              />
            ))}
            
            {deals.length === 0 && (
              <div className="flex items-center justify-center h-24 text-muted-foreground text-xs">
                Nenhum negócio
              </div>
            )}

            {/* Ver Mais / Ver Menos Button */}
            {hasMore && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Mostrar menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Ver mais ({remaining})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
