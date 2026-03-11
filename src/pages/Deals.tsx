import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from "@dnd-kit/core";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, TrendingUp, Flame, Skull, DollarSign, Settings, Users, Search, Trophy, TrendingDown, CheckSquare, BarChart3, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { useDeals, useUpdateDeal, useUpdateDealStage, DealFilters } from "@/hooks/useDeals";
import { useDealsMetrics } from "@/hooks/useDealsMetrics";
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
import { AdvancedDealFiltersModal } from "@/components/deals/AdvancedDealFiltersModal";
import { SavedFiltersDropdown } from "@/components/deals/filters/SavedFiltersDropdown";
import { SortBySelect, SortByOption } from "@/components/deals/filters/SortBySelect";
import { ActiveFilterChips, generateDealFilterChips } from "@/components/ui/active-filter-chips";
import BulkMoveDealsDialog from "@/components/deals/BulkMoveDealsDialog";
import BulkActionsBar from "@/components/deals/BulkActionsBar";
import BulkTransferToSellerDialog from "@/components/deals/BulkTransferToSellerDialog";
import { BulkMarkAsLostDialog } from "@/components/deals/BulkMarkAsLostDialog";
import { TransferDealsDialog } from "@/components/deals/TransferDealsDialog";
import { CleanupInvalidAssignmentsDialog } from "@/components/deals/CleanupInvalidAssignmentsDialog";
import { supabase } from "@/integrations/supabase/client";
import { usePerformanceLog } from "@/lib/prefetch";
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
  
  // Bulk selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [showBulkMoveDialog, setShowBulkMoveDialog] = useState(false);
  const [showBulkTransferDialog, setShowBulkTransferDialog] = useState(false);
  const [showBulkLostDialog, setShowBulkLostDialog] = useState(false);
  
  // Advanced filters state
  const [dealFilters, setDealFilters] = useState<DealFilters>({
    search: "",
    leadSource: [],
    assignedTo: [],
    status: [],
    stageIds: [],
    sortBy: "created_at_desc",
  });
  
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const { data: stages, isLoading: stagesLoading } = useStages(selectedPipeline);
  const { data: deals, isLoading: dealsLoading } = useDeals(selectedPipeline, dealFilters);
  usePerformanceLog('Deals', !dealsLoading);
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
  const canViewSalesDistribution = hasPermission('reports.lead_distribution');

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
    } else if (key === "value") {
      setDealFilters({ ...dealFilters, valueMin: undefined, valueMax: undefined });
    } else if (key === "valueMin") {
      setDealFilters({ ...dealFilters, valueMin: undefined });
    } else if (key === "valueMax") {
      setDealFilters({ ...dealFilters, valueMax: undefined });
    } else if (key === "status") {
      setDealFilters({ ...dealFilters, status: [] });
    } else if (key === "stageIds") {
      setDealFilters({ ...dealFilters, stageIds: [] });
    } else if (key === "probability") {
      setDealFilters({ ...dealFilters, probabilityMin: undefined, probabilityMax: undefined });
    } else if (key === "closedDateRange") {
      setDealFilters({ ...dealFilters, closedDateRange: undefined });
    } else {
      setDealFilters({ ...dealFilters, [key]: undefined });
    }
  };

  const clearAllFilters = () => {
    setDealFilters({
      search: "",
      leadSource: [],
      assignedTo: [],
      status: [],
      stageIds: [],
      sortBy: "created_at_desc",
      createdDateRange: undefined,
      expectedCloseDateRange: undefined,
      closedDateRange: undefined,
      updatedDateRange: undefined,
      valueMin: undefined,
      valueMax: undefined,
      probabilityMin: undefined,
      probabilityMax: undefined,
    });
  };

  // Bulk selection handlers
  const handleSelectionChange = (dealId: string, selected: boolean) => {
    setSelectedDeals(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(dealId);
      } else {
        next.delete(dealId);
      }
      return next;
    });
  };

  const handleSelectAllInStage = (dealIds: string[]) => {
    setSelectedDeals(prev => {
      const newSet = new Set(prev);
      const allSelected = dealIds.every(id => newSet.has(id));
      
      if (allSelected) {
        // Deselect all deals from this stage
        dealIds.forEach(id => newSet.delete(id));
      } else {
        // Select all deals from this stage
        dealIds.forEach(id => newSet.add(id));
      }
      
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedDeals(new Set());
    setIsSelectionMode(false);
  };

  // Atalho ESC para sair do modo de seleção
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelectionMode) {
        clearSelection();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSelectionMode]);

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      clearSelection();
    } else {
      setIsSelectionMode(true);
    }
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

  // Usar hook dedicado para métricas com filtros corretos
  // - Criados: filtrado por created_at
  // - Ganhos/Perdidos: filtrado por closed_at
  const { data: dealsMetrics } = useDealsMetrics(selectedPipeline, dealFilters.createdDateRange);

  // Calculate additional pipeline metrics (forecast, hot deals, rotten)
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
          // Manter assigned_to existente, NÃO auto-atribuir a não-vendedores
          assigned_to: pendingWonDeal.assigned_to || null,
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

  // Handler para fechamento manual (venda externa sem Kiwify)
  const handleManualWonSuccess = async (data: { 
    value: number; 
    observation: string;
    sales_channel_id?: string;
    sales_channel_name?: string;
    external_order_id?: string;
    company_contact_id?: string;
    company_name?: string;
  }) => {
    if (!pendingWonDeal) return;

    // Backend validation: if channel requires order ID, verify it
    if (data.sales_channel_id) {
      const { data: channelData } = await supabase
        .from("sales_channels")
        .select("requires_order_id, name")
        .eq("id", data.sales_channel_id)
        .single();
      
      if (channelData?.requires_order_id && !data.external_order_id?.trim()) {
        toast({
          title: "ID da Venda obrigatório",
          description: `O canal "${channelData.name}" exige o ID da venda.`,
          variant: "destructive",
        });
        return;
      }
    }

    updateDeal.mutate(
      {
        id: pendingWonDeal.id,
        updates: {
          status: "won",
          value: data.value,
          closed_at: new Date().toISOString(),
          assigned_to: pendingWonDeal.assigned_to || null,
          is_organic_sale: false,
          sales_channel_id: data.sales_channel_id || null,
          sales_channel_name: data.sales_channel_name || null,
          external_order_id: data.external_order_id || null,
          company_contact_id: data.company_contact_id || null,
          company_name_snapshot: data.company_name || null,
        },
      },
      {
        onSuccess: async () => {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FFD700', '#FFA500', '#FF6347', '#00FF00', '#1E90FF'],
          });

          const channelLabel = data.sales_channel_name || "venda externa";
          toast({
            title: "🎉 Negócio Ganho!",
            description: `${channelLabel}: ${formatCurrency(data.value)}`,
          });

          // Log na timeline se houver contact_id
          if (pendingWonDeal.contact_id) {
            const parts = [`✅ Negócio fechado (${channelLabel}): ${formatCurrency(data.value)}`];
            if (data.external_order_id) parts.push(`🔗 ID: ${data.external_order_id}`);
            if (data.company_name) parts.push(`🏢 Empresa: ${data.company_name}`);
            parts.push(`📝 Observação: ${data.observation}`);

            await supabase.from('interactions').insert({
              customer_id: pendingWonDeal.contact_id,
              type: 'note',
              content: parts.join('\n'),
              channel: 'other',
              metadata: {
                deal_id: pendingWonDeal.id,
                manual_closure: true,
                observation: data.observation,
                validated_value: data.value,
                validated_at: new Date().toISOString(),
                sales_channel_id: data.sales_channel_id || null,
                sales_channel_name: data.sales_channel_name || null,
                external_order_id: data.external_order_id || null,
                company_name: data.company_name || null,
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
            {/* Botão de limpeza de responsáveis inválidos - apenas para quem gerencia pipelines */}
            {canManagePipelines && <CleanupInvalidAssignmentsDialog />}
            {canViewSalesDistribution && (
              <Button variant="outline" asChild className="gap-2">
                <Link to="/reports/sales-distribution">
                  <BarChart3 className="h-4 w-4" />
                  Distribuição
                </Link>
              </Button>
            )}
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
            <PendingDealsQueue pipelineId={selectedPipeline} />
          </div>
        )}

        {/* Pipeline Metrics Bar - Compact Inline */}
        {pipelineMetrics && (
          <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/40 rounded-lg mb-6 text-sm overflow-x-auto border border-border/50">
            {/* Total Pipeline */}
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Pipeline:</span>
              <span className="font-semibold">{formatCurrency(pipelineMetrics.totalValue)}</span>
            </div>
            
            {(dealsMetrics?.wonValue ?? 0) > 0 && (
              <>
                <div className="h-4 border-l border-border" />
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Ganho ({dealsMetrics?.won ?? 0}):</span>
                  <span className="font-semibold text-primary">
                    {formatCurrency(dealsMetrics?.wonValue ?? 0)}
                  </span>
                </div>
              </>
            )}
            
            {(dealsMetrics?.lostValue ?? 0) > 0 && (
              <>
                <div className="h-4 border-l border-border" />
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <span className="text-muted-foreground">Perdido ({dealsMetrics?.lost ?? 0}):</span>
                  <span className="font-semibold text-destructive">
                    {formatCurrency(dealsMetrics?.lostValue ?? 0)}
                  </span>
                </div>
              </>
            )}
            
            <div className="h-4 border-l border-border" />
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Forecast:</span>
              <span className="font-semibold text-primary">
                {formatCurrency(pipelineMetrics.weightedForecast)}
              </span>
            </div>
            
            <div className="h-4 border-l border-border" />
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-muted-foreground">Quentes:</span>
              <span className="font-semibold">{pipelineMetrics.hotDeals}</span>
            </div>
            
            <div className="h-4 border-l border-border" />
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Skull className="h-4 w-4 text-destructive" />
              <span className="text-muted-foreground">Rotten:</span>
              <span className="font-semibold text-destructive">{pipelineMetrics.rottenCount}</span>
            </div>
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

          {/* Selection Mode Toggle */}
          <Button
            variant={isSelectionMode ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={toggleSelectionMode}
          >
            <CheckSquare className="h-4 w-4" />
            {isSelectionMode ? "Sair Seleção" : "Selecionar Deals"}
          </Button>

          {/* Transfer Portfolio Button - Only for managers/admins */}
          {canManagePipelines && <TransferDealsDialog />}

          {/* Advanced Filters */}
          <AdvancedDealFiltersModal
            filters={dealFilters}
            onFiltersChange={setDealFilters}
            pipelineId={selectedPipeline}
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
              return (
                <KanbanColumn 
                  key={stage.id} 
                  stage={stage} 
                  deals={stageDeals as Deal[]}
                  isSelectionMode={isSelectionMode}
                  selectedDeals={selectedDeals}
                  onSelectionChange={handleSelectionChange}
                  onSelectAllInStage={handleSelectAllInStage}
                />
              );
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
        onManualSuccess={handleManualWonSuccess}
      />

      {/* Bulk Move Deals Dialog */}
      <BulkMoveDealsDialog
        open={showBulkMoveDialog}
        onOpenChange={setShowBulkMoveDialog}
        selectedDealIds={Array.from(selectedDeals)}
        currentPipelineId={selectedPipeline}
        onSuccess={clearSelection}
      />

      {/* Bulk Transfer to Seller Dialog */}
      <BulkTransferToSellerDialog
        open={showBulkTransferDialog}
        onOpenChange={setShowBulkTransferDialog}
        selectedDealIds={Array.from(selectedDeals)}
        onSuccess={clearSelection}
      />

      {/* Bulk Mark as Lost Dialog */}
      <BulkMarkAsLostDialog
        open={showBulkLostDialog}
        onOpenChange={setShowBulkLostDialog}
        selectedDealIds={Array.from(selectedDeals)}
        pipelineId={selectedPipeline}
        onSuccess={clearSelection}
      />

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedDeals.size}
        onMoveClick={() => setShowBulkMoveDialog(true)}
        onTransferClick={() => setShowBulkTransferDialog(true)}
        onMarkAsLostClick={() => setShowBulkLostDialog(true)}
        onClearSelection={clearSelection}
      />
    </div>
  );
}
