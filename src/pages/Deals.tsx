import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from "@dnd-kit/core";
import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useDeals, useUpdateDealStage } from "@/hooks/useDeals";
import { useStages } from "@/hooks/useStages";
import KanbanColumn from "@/components/KanbanColumn";
import KanbanCard from "@/components/KanbanCard";
import DealDialog from "@/components/DealDialog";
import type { Tables } from "@/integrations/supabase/types";

type Deal = Tables<"deals"> & {
  contacts: { first_name: string; last_name: string } | null;
  organizations: { name: string } | null;
};

export default function Deals() {
  const [searchParams] = useSearchParams();
  const filter = searchParams.get("filter") || "all";
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const { data: deals, isLoading: dealsLoading } = useDeals();
  const { data: stages, isLoading: stagesLoading } = useStages();
  const updateDealStage = useUpdateDealStage();

  const filteredDeals = useMemo(() => {
    if (!deals) return [];
    
    switch (filter) {
      case "open":
        return deals.filter(d => d.status === "open");
      case "won":
        return deals.filter(d => d.status === "won");
      case "lost":
        return deals.filter(d => d.status === "lost");
      default:
        return deals;
    }
  }, [deals, filter]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const deal = active.data.current?.deal;
    if (deal) {
      setActiveDeal(deal);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over) return;

    const dealId = active.id as string;
    const newStageId = over.id as string;

    // Find the deal's current stage
    const deal = filteredDeals?.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === newStageId) return;

    // Optimistically update the stage
    updateDealStage.mutate({ id: dealId, stage_id: newStageId });
  };

  if (dealsLoading || stagesLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!stages || stages.length === 0) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            Nenhuma etapa configurada. Configure etapas para usar o pipeline.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Pipeline de Negócios</h2>
          <p className="text-muted-foreground">
            Arraste e solte para mover negócios entre etapas
          </p>
        </div>
        <DealDialog
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Negócio
            </Button>
          }
        />
      </div>

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageDeals = filteredDeals?.filter((deal) => deal.stage_id === stage.id) || [];
            return <KanbanColumn key={stage.id} stage={stage} deals={stageDeals as Deal[]} />;
          })}
        </div>

        <DragOverlay>
          {activeDeal ? <KanbanCard deal={activeDeal} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
