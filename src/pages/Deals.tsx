import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from "@dnd-kit/core";
import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useDeals, useUpdateDealStage } from "@/hooks/useDeals";
import { useStages } from "@/hooks/useStages";
import { useSalesReps } from "@/hooks/useSalesReps";
import { useUserRole } from "@/hooks/useUserRole";
import { useRottenDeals } from "@/hooks/useRottenDeals";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import KanbanColumn from "@/components/KanbanColumn";
import KanbanCard from "@/components/KanbanCard";
import DealDialog from "@/components/DealDialog";
import type { Tables } from "@/integrations/supabase/types";

type Deal = Tables<"deals"> & {
  contacts: { first_name: string; last_name: string } | null;
  organizations: { name: string } | null;
  assigned_user: { id: string; full_name: string; avatar_url: string | null } | null;
};

export default function Deals() {
  const [searchParams] = useSearchParams();
  const filter = searchParams.get("filter") || "all";
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [selectedSalesRep, setSelectedSalesRep] = useState<string>("all");
  const { data: deals, isLoading: dealsLoading } = useDeals();
  const { data: stages, isLoading: stagesLoading } = useStages();
  const { data: salesReps } = useSalesReps();
  const { role } = useUserRole();
  const { data: rottenDeals } = useRottenDeals();
  const updateDealStage = useUpdateDealStage();
  
  const isManagerOrAdmin = role && (role === "admin" || role === "manager");

  const filteredDeals = useMemo(() => {
    if (!deals) return [];
    
    let filtered = deals;
    
    // Filtrar por status
    switch (filter) {
      case "open":
        filtered = filtered.filter(d => d.status === "open");
        break;
      case "won":
        filtered = filtered.filter(d => d.status === "won");
        break;
      case "lost":
        filtered = filtered.filter(d => d.status === "lost");
        break;
      case "rotten":
        // Filtrar apenas deals que estão em rottenDeals
        const rottenIds = new Set(rottenDeals?.map(d => d.id) || []);
        filtered = filtered.filter(d => rottenIds.has(d.id));
        break;
    }
    
    // Filtrar por vendedor (apenas para admin/manager)
    if (isManagerOrAdmin && selectedSalesRep !== "all") {
      filtered = filtered.filter(d => d.assigned_to === selectedSalesRep);
    }
    
    return filtered;
  }, [deals, filter, selectedSalesRep, isManagerOrAdmin, rottenDeals]);

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
      <div className="mb-8">
        <div className="flex items-center justify-between">
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

        {isManagerOrAdmin && salesReps && salesReps.length > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <label className="text-sm font-medium text-foreground">
              Filtrar por Vendedor:
            </label>
            <Select value={selectedSalesRep} onValueChange={setSelectedSalesRep}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Selecione um vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os vendedores</SelectItem>
                {salesReps.map((rep) => (
                  <SelectItem key={rep.id} value={rep.id}>
                    {rep.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
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
