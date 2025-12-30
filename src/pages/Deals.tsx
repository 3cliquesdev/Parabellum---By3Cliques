import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from "@dnd-kit/core";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, TrendingUp, Flame, Skull, DollarSign, Settings, Users, Search } from "lucide-react";
import { useDeals, useUpdateDeal, useUpdateDealStage, DealFilters } from "@/hooks/useDeals";
import { useStages } from "@/hooks/useStages";
import { usePipelines } from "@/hooks/usePipelines";
import { useSalesReps } from "@/hooks/useSalesReps";
import { useUserRole } from "@/hooks/useUserRole";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useRottenDeals } from "@/hooks/useRottenDeals";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import confetti from "canvas-confetti";
import KanbanColumn from "@/components/KanbanColumn";
import KanbanStatusColumn from "@/components/KanbanStatusColumn";
import KanbanCard from "@/components/KanbanCard";
import DealDialog from "@/components/DealDialog";
import PipelineDialog from "@/components/PipelineDialog";
import PipelineStagesDialog from "@/components/deals/PipelineStagesDialog";
import PipelineSalesRepsDialog from "@/components/deals/PipelineSalesRepsDialog";
import DragDropActionBar from "@/components/DragDropActionBar";
import LostReasonDialog from "@/components/LostReasonDialog";
import ValidateWonDealDialog from "@/components/deals/ValidateWonDealDialog";
import { PendingDealsQueue } from "@/components/deals/PendingDealsQueue";
import { KanbanScrollNavigation } from "@/components/deals/KanbanScrollNavigation";
import DealFilterPopover from "@/components/deals/DealFilterPopover";
import { ActiveFilterChips, generateDealFilterChips } from "@/components/ui/active-filter-chips";
import { supabase } from "@/integrations/supabase/client";
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
  const [selectedPipeline, setSelectedPipeline] = useState<string>("");
  const [showLostDialog, setShowLostDialog] = useState(false);
  const [pendingLostDeal, setPendingLostDeal] = useState<Deal | null>(null);
  const [showValidateWonDialog, setShowValidateWonDialog] = useState(false);
  const [pendingWonDeal, setPendingWonDeal] = useState<Deal | null>(null);
  
  // Advanced filters state
  const [dealFilters, setDealFilters] = useState<DealFilters>({
    search: "",
    leadSource: [],
    assignedTo: [],
  });
  
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const { data: stages, isLoading: stagesLoading } = useStages(selectedPipeline);
  const { data: deals, isLoading: dealsLoading } = useDeals(selectedPipeline, dealFilters);
  const { data: salesReps } = useSalesReps();
  const { role, loading: roleLoading } = useUserRole();
  const { hasPermission } = useRolePermissions();
  const { data: rottenDeals } = useRottenDeals();
  const { user } = useAuth();
  const updateDealStage = useUpdateDealStage();
  const updateDeal = useUpdateDeal();
  const { toast } = useToast();
  
  // Dynamic permission checks
  const canViewAllDeals = hasPermission('deals.view_all');
  const canManagePipelines = hasPermission('deals.manage_pipelines');
  const canViewPendingQueue = hasPermission('deals.view_pending_queue');

  // Selecionar pipeline default ao carregar
  useEffect(() => {
    if (pipelines && pipelines.length > 0 && !selectedPipeline) {
      const defaultPipeline = pipelines.find(p => p.is_default) || pipelines[0];
      setSelectedPipeline(defaultPipeline.id);
    }
  }, [pipelines, selectedPipeline]);

  const filteredDeals = useMemo(() => {
    if (!deals) return [];
    
    let filtered = deals;
    
    // Filter by status (URL param)
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
        const rottenIds = new Set(rottenDeals?.map(d => d.id) || []);
        filtered = filtered.filter(d => rottenIds.has(d.id));
        break;
    }
    
    return filtered;
  }, [deals, filter, rottenDeals]);

  // Generate filter chips for display
  const filterChips = useMemo(() => 
    generateDealFilterChips(dealFilters, salesReps || []),
    [dealFilters, salesReps]
  );

  const handleRemoveFilterChip = (key: string) => {
    if (key.startsWith("leadSource_")) {
      const source = key.replace("leadSource_", "");
      setDealFilters({
        ...dealFilters,
        leadSource: dealFilters.leadSource.filter(s => s !== source),
      });
    } else if (key.startsWith("assignedTo_")) {
      const repId = key.replace("assignedTo_", "");
      setDealFilters({
        ...dealFilters,
        assignedTo: (dealFilters.assignedTo || []).filter(r => r !== repId),
      });
    } else if (key === "value" || key === "valueMin") {
      setDealFilters({ ...dealFilters, valueMin: undefined });
    } else if (key === "valueMax") {
      setDealFilters({ ...dealFilters, valueMax: undefined });
    } else {
      setDealFilters({ ...dealFilters, [key]: undefined });
    }
  };

  const clearAllFilters = () => {
    setDealFilters({ search: "", leadSource: [], assignedTo: [] });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const deal = active.data.current?.deal;
    if (deal) {
      setActiveDeal(deal);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const dealId = active.id as string;
    const deal = filteredDeals?.find((d) => d.id === dealId);
    
    setActiveDeal(null);

    if (!over || !deal) return;

    // Check if dropped on action zones
    if (over.id === "won-zone") {
      // Open validation dialog instead of marking as won directly
      setPendingWonDeal(deal);
      setShowValidateWonDialog(true);
      return;
    }

    if (over.id === "lost-zone") {
      // Open modal for lost reason
      setPendingLostDeal(deal);
      setShowLostDialog(true);
      return;
    }

    // Normal stage change
    const newStageId = over.id as string;
    if (deal.stage_id === newStageId) return;

    updateDealStage.mutate({ id: dealId, stage_id: newStageId });
  };

  // Calculate pipeline metrics (MUST be before early returns)
  const pipelineMetrics = useMemo(() => {
    if (!filteredDeals || !stages) return null;

    const totalValue = filteredDeals
      .filter(d => d.status === "open")
      .reduce((sum, d) => sum + (d.value || 0), 0);

    let weightedForecast = 0;
    stages.forEach(stage => {
      const stageDeals = filteredDeals.filter(d => d.stage_id === stage.id && d.status === "open");
      const stageValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
      weightedForecast += stageValue * ((stage.probability || 50) / 100);
    });

    const hotDeals = filteredDeals.filter(d => {
      if (d.status !== "open" || !d.value) return false;
      return d.value > 10000; // Deals above 10k are "hot"
    }).length;

    const rottenCount = rottenDeals?.length || 0;

    return { totalValue, weightedForecast, hotDeals, rottenCount };
  }, [filteredDeals, stages, rottenDeals]);

  const handleLostReasonConfirm = (reason: string, notes?: string) => {
    if (!pendingLostDeal) return;

    updateDeal.mutate(
      {
        id: pendingLostDeal.id,
        updates: {
          status: "lost",
          lost_reason: reason,
          closed_at: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Negócio marcado como perdido",
            description: `Motivo: ${reason}`,
            variant: "destructive",
          });
          setShowLostDialog(false);
          setPendingLostDeal(null);
        },
      }
    );
  };

  const handleValidationSuccess = async (validatedData: {
    value: number;
    gross_value: number;
    customer_email: string;
    customer_name: string;
    product_name: string;
    order_ref: string;
  }) => {
    if (!pendingWonDeal) return;

    updateDeal.mutate(
      {
        id: pendingWonDeal.id,
        updates: {
          status: "won",
          value: validatedData.value,
          gross_value: validatedData.gross_value,
          closed_at: new Date().toISOString(),
          // Salvar email e nome do cliente Kiwify
          lead_email: validatedData.customer_email,
          // Auto-atribuir ao usuário atual se não tiver responsável
          assigned_to: pendingWonDeal.assigned_to || user?.id,
        },
      },
      {
        onSuccess: async () => {
          // Trigger confetti
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FFD700', '#FFA500', '#FF6347', '#00FF00', '#1E90FF'],
          });

          toast({
            title: "🎉 Negócio Ganho!",
            description: `Validado com Kiwify: ${formatCurrency(validatedData.value)}`,
          });

          // Log na timeline se houver contact_id
          if (pendingWonDeal.contact_id) {
            await supabase.from('interactions').insert({
              customer_id: pendingWonDeal.contact_id,
              type: 'note',
              content: `✅ Negócio validado com transação Kiwify: ${validatedData.order_ref} - ${formatCurrency(validatedData.value)}`,
              channel: 'other',
              metadata: {
                deal_id: pendingWonDeal.id,
                kiwify_order_ref: validatedData.order_ref,
                validated_value: validatedData.value,
                validated_at: new Date().toISOString(),
              },
            });
          }

          setShowValidateWonDialog(false);
          setPendingWonDeal(null);
        },
      }
    );
  };

  if (dealsLoading || stagesLoading || pipelinesLoading || roleLoading) {
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Pipeline de Negócios</h2>
            <p className="text-muted-foreground">
              Arraste e solte para mover negócios entre etapas. Arraste para as zonas de ação para fechar.
            </p>
          </div>
          <div className="flex gap-2">
            {canManagePipelines && <PipelineDialog />}
            <DealDialog
              trigger={
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Negócio
                </Button>
              }
            />
          </div>
        </div>

        {/* Fila de Deals Pendentes (apenas para quem tem permissão) */}
        {canViewPendingQueue && (
          <div className="mb-6">
            <PendingDealsQueue />
          </div>
        )}

        {/* Pipeline Metrics Bar */}
        {pipelineMetrics && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <DollarSign className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Pipeline</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(pipelineMetrics.totalValue)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Forecast Ponderado</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(pipelineMetrics.weightedForecast)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Flame className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Deals Quentes</p>
                    <p className="text-2xl font-bold text-foreground">
                      {pipelineMetrics.hotDeals}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-destructive/10 rounded-lg">
                    <Skull className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Rotten Deals</p>
                    <p className="text-2xl font-bold text-destructive">
                      {pipelineMetrics.rottenCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4">
          {/* Pipeline Selector */}
          {pipelines && pipelines.length > 0 && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-foreground">
                Pipeline:
              </label>
              <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Selecione um pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                      {pipeline.is_default && " (Padrão)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Pipeline Config Buttons */}
              {canManagePipelines && selectedPipeline && (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <PipelineSalesRepsDialog
                            pipelineId={selectedPipeline}
                            pipelineName={pipelines?.find(p => p.id === selectedPipeline)?.name}
                            trigger={
                              <Button variant="ghost" size="icon" className="h-9 w-9">
                                <Users className="h-4 w-4" />
                              </Button>
                            }
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Equipe do Pipeline</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <PipelineStagesDialog
                            pipelineId={selectedPipeline}
                            pipelineName={pipelines?.find(p => p.id === selectedPipeline)?.name}
                            trigger={
                              <Button variant="ghost" size="icon" className="h-9 w-9">
                                <Settings className="h-4 w-4" />
                              </Button>
                            }
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Configurar Etapas</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}
            </div>
          )}

          {/* Advanced Filters */}
          <DealFilterPopover
            filters={dealFilters}
            onFiltersChange={setDealFilters}
          />

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar negócios..."
              value={dealFilters.search}
              onChange={(e) => setDealFilters({ ...dealFilters, search: e.target.value })}
              className="pl-9 w-[250px]"
            />
          </div>
        </div>

        {/* Active Filter Chips */}
        {filterChips.length > 0 && (
          <div className="mt-4">
            <ActiveFilterChips
              chips={filterChips}
              onRemoveChip={handleRemoveFilterChip}
              onClearAll={clearAllFilters}
            />
          </div>
        )}
      </div>

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <KanbanScrollNavigation>
          <div className="flex gap-2 min-w-max px-12 py-1">
            {/* Regular stage columns - only show open deals */}
            {stages.map((stage) => {
              const stageDeals = filteredDeals?.filter(
                (deal) => deal.stage_id === stage.id && deal.status === "open"
              ) || [];
              return <KanbanColumn key={stage.id} stage={stage} deals={stageDeals as Deal[]} />;
            })}

            {/* Virtual Won column */}
            <KanbanStatusColumn 
              status="won" 
              title="✅ Ganho" 
              deals={(filteredDeals?.filter(d => d.status === "won") || []) as Deal[]}
            />

            {/* Virtual Lost column */}
            <KanbanStatusColumn 
              status="lost" 
              title="❌ Perdido" 
              deals={(filteredDeals?.filter(d => d.status === "lost") || []) as Deal[]}
            />
          </div>
        </KanbanScrollNavigation>

        <DragOverlay>
          {activeDeal ? <KanbanCard deal={activeDeal} /> : null}
        </DragOverlay>

        {/* Drop Zones Action Bar */}
        <DragDropActionBar isVisible={!!activeDeal} />
      </DndContext>

      {/* Lost Reason Dialog */}
      <LostReasonDialog
        open={showLostDialog}
        onClose={() => {
          setShowLostDialog(false);
          setPendingLostDeal(null);
        }}
        onConfirm={handleLostReasonConfirm}
        dealTitle={pendingLostDeal?.title || ""}
      />

      {/* Validate Won Deal Dialog */}
      <ValidateWonDealDialog
        open={showValidateWonDialog}
        onOpenChange={setShowValidateWonDialog}
        deal={pendingWonDeal}
        onValidationSuccess={handleValidationSuccess}
      />
    </div>
  );
}
