import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Clock, 
  Users, 
  AlertTriangle, 
  Inbox, 
  Wand2, 
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react";
import { formatDistanceToNow, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSalesReps } from "@/hooks/useSalesReps";
import { usePipelineSalesReps } from "@/hooks/usePipelineSalesReps";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface PendingDeal {
  id: string;
  title: string;
  value: number | null;
  created_at: string;
  lead_source: string | null;
  contacts: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
}

function UrgencyIndicator({ createdAt }: { createdAt: string }) {
  const minutes = differenceInMinutes(new Date(), new Date(createdAt));
  
  if (minutes > 30) {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive"></span>
        </span>
        <span className="text-destructive font-medium">{minutes}m</span>
      </div>
    );
  }
  
  if (minutes > 15) {
    return (
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
        <span className="text-amber-600 dark:text-amber-500 font-medium">{minutes}m</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
      <span className="text-emerald-600 dark:text-emerald-500 font-medium">{minutes}m</span>
    </div>
  );
}

function OriginBadge({ source }: { source: string | null }) {
  const sourceConfig: Record<string, { label: string; className: string }> = {
    kiwify: { label: "Kiwify", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    kiwify_upsell: { label: "Upsell", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
    manual: { label: "Manual", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" },
    web_chat: { label: "Chat", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    webchat: { label: "Chat", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    whatsapp: { label: "WhatsApp", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    formulario: { label: "Formulário", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    indicacao: { label: "Indicação", className: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
  };
  
  const config = sourceConfig[source || "manual"] || sourceConfig.manual;
  
  return (
    <Badge variant="secondary" className={cn("text-xs font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}

function KPICard({ 
  icon: Icon, 
  value, 
  label, 
  variant = "default" 
}: { 
  icon: React.ElementType; 
  value: string | number; 
  label: string; 
  variant?: "default" | "warning" | "danger";
}) {
  const variantStyles = {
    default: "bg-primary/10 text-primary",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
    danger: "bg-destructive/10 text-destructive",
  };
  
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-muted/50">
      <div className={cn("p-2 rounded-lg", variantStyles[variant])}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

const INITIAL_LIMIT = 5;

interface PendingDealsQueueProps {
  pipelineId?: string;
}

export function PendingDealsQueue({ pipelineId }: PendingDealsQueueProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [bulkAssignTo, setBulkAssignTo] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: allSalesReps } = useSalesReps();
  const { data: pipelineReps } = usePipelineSalesReps(pipelineId);

  // Filter sales reps based on pipeline team configuration
  // Cruza membros do pipeline com allSalesReps (que só contém role sales_rep)
  const availableReps = useMemo(() => {
    if (pipelineReps && pipelineReps.length > 0) {
      const pipelineUserIds = new Set(pipelineReps.map(r => r.user_id));
      return allSalesReps?.filter(rep => pipelineUserIds.has(rep.id)) || [];
    }
    // Fallback to all sales reps if no pipeline team is configured
    return allSalesReps || [];
  }, [pipelineReps, allSalesReps]);

  const { data: pendingDeals, isLoading } = useQuery({
    queryKey: ["pending-deals", pipelineId],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select(`
          id,
          title,
          value,
          created_at,
          lead_source,
          contacts!deals_contact_id_fkey (
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .is("assigned_to", null)
        .eq("status", "open")
        .order("created_at", { ascending: true });

      // Filter by pipeline if specified
      if (pipelineId) {
        query = query.eq("pipeline_id", pipelineId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as PendingDeal[];
    },
    refetchInterval: 10000,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ dealId, salesRepId }: { dealId: string; salesRepId: string }) => {
      const { error } = await supabase
        .from("deals")
        .update({ assigned_to: salesRepId })
        .eq("id", dealId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ dealIds, salesRepId }: { dealIds: string[]; salesRepId: string }) => {
      const { error } = await supabase
        .from("deals")
        .update({ assigned_to: salesRepId })
        .in("id", dealIds);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pending-deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      setSelectedDeals([]);
      setBulkAssignTo("");
      toast({
        title: "Deals atribuídos",
        description: `${variables.dealIds.length} deals foram atribuídos com sucesso`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atribuir deals",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAssign = async (dealId: string, salesRepId: string) => {
    try {
      await assignMutation.mutateAsync({ dealId, salesRepId });
      toast({
        title: "Deal atribuído",
        description: "O vendedor foi notificado",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atribuir deal",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleBulkAssign = () => {
    if (!bulkAssignTo || selectedDeals.length === 0) return;
    bulkAssignMutation.mutate({ dealIds: selectedDeals, salesRepId: bulkAssignTo });
  };

  const handleAutoDistribute = async () => {
    if (!pendingDeals || pendingDeals.length === 0 || !availableReps || availableReps.length === 0) return;
    
    const onlineReps = availableReps.filter(rep => rep.availability_status === "online");
    if (onlineReps.length === 0) {
      toast({
        title: "Nenhum vendedor online",
        description: pipelineId 
          ? "Não há vendedores da equipe deste pipeline disponíveis"
          : "Não há vendedores disponíveis para distribuição automática",
        variant: "destructive",
      });
      return;
    }

    let repIndex = 0;
    for (const deal of pendingDeals) {
      const rep = onlineReps[repIndex % onlineReps.length];
      await assignMutation.mutateAsync({ dealId: deal.id, salesRepId: rep.id });
      repIndex++;
    }

    toast({
      title: "Distribuição concluída",
      description: `${pendingDeals.length} deals distribuídos para ${onlineReps.length} vendedores da equipe`,
    });
  };

  const toggleDealSelection = (dealId: string) => {
    setSelectedDeals(prev => 
      prev.includes(dealId) 
        ? prev.filter(id => id !== dealId)
        : [...prev, dealId]
    );
  };

  const toggleAllSelection = () => {
    if (!pendingDeals) return;
    if (selectedDeals.length === pendingDeals.length) {
      setSelectedDeals([]);
    } else {
      setSelectedDeals(pendingDeals.map(d => d.id));
    }
  };

  const stats = useMemo(() => {
    if (!pendingDeals || pendingDeals.length === 0) {
      return { count: 0, avgWait: 0, maxWait: 0 };
    }

    const waitTimes = pendingDeals.map(d => differenceInMinutes(new Date(), new Date(d.created_at)));
    const avgWait = Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length);
    const maxWait = Math.max(...waitTimes);

    return { count: pendingDeals.length, avgWait, maxWait };
  }, [pendingDeals]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pendingDeals || pendingDeals.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 overflow-hidden">
      {/* Warning when no team is configured for pipeline */}
      {availableReps.length === 0 && pipelineId && (
        <div className="flex items-center gap-2 p-4 bg-amber-500/10 border-b border-amber-500/20">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <span className="text-sm text-amber-600 dark:text-amber-400">
            Nenhum vendedor configurado para este pipeline. Configure a equipe nas configurações do pipeline.
          </span>
        </div>
      )}

      {/* Header com gradiente e KPIs */}
      <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Fila de Distribuição</CardTitle>
              <CardDescription>Deals aguardando atribuição a vendedores</CardDescription>
            </div>
          </div>

          {/* KPIs */}
          <div className="flex flex-wrap items-center gap-3">
            <KPICard icon={Inbox} value={stats.count} label="Pendentes" />
            <KPICard 
              icon={Clock} 
              value={`${stats.avgWait}m`} 
              label="Média" 
              variant={stats.avgWait > 15 ? "warning" : "default"}
            />
            <KPICard 
              icon={AlertTriangle} 
              value={`${stats.maxWait}m`} 
              label="Mais antigo" 
              variant={stats.maxWait > 30 ? "danger" : stats.maxWait > 15 ? "warning" : "default"}
            />
          </div>

          {/* Ação de distribuição automática */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2">
                <Wand2 className="h-4 w-4" />
                Distribuir
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleAutoDistribute}>
                <Users className="h-4 w-4 mr-2" />
                Distribuição automática (Round Robin)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      {/* Tabela de Deals */}
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedDeals.length === pendingDeals.length}
                    onCheckedChange={toggleAllSelection}
                  />
                </TableHead>
                <TableHead>Deal</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Espera</TableHead>
                <TableHead className="text-center">Origem</TableHead>
                <TableHead className="w-[180px]">Atribuir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(isExpanded ? pendingDeals : pendingDeals.slice(0, INITIAL_LIMIT)).map((deal) => (
                <TableRow 
                  key={deal.id}
                  className={cn(
                    "transition-colors",
                    selectedDeals.includes(deal.id) && "bg-primary/5"
                  )}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedDeals.includes(deal.id)}
                      onCheckedChange={() => toggleDealSelection(deal.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium truncate max-w-[200px]">{deal.title}</span>
                      {deal.contacts && (
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {deal.contacts.first_name} {deal.contacts.last_name}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {deal.value ? (
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "font-mono",
                          deal.value >= 1000 && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        )}
                      >
                        R$ {deal.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <UrgencyIndicator createdAt={deal.created_at} />
                  </TableCell>
                  <TableCell className="text-center">
                    <OriginBadge source={deal.lead_source} />
                  </TableCell>
                  <TableCell>
                    <Select
                      onValueChange={(value) => handleAssign(deal.id, value)}
                      disabled={availableReps.length === 0}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={availableReps.length === 0 ? "Sem equipe" : "Selecionar..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableReps?.map((rep) => (
                          <SelectItem key={rep.id} value={rep.id}>
                            <div className="flex items-center gap-2">
                              <span 
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  rep.availability_status === "online" ? "bg-emerald-500" : "bg-slate-400"
                                )}
                              />
                              {rep.full_name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Botão Ver mais/Mostrar menos */}
        {pendingDeals.length > INITIAL_LIMIT && (
          <div className="flex justify-center py-3 border-t">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsExpanded(!isExpanded)}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Mostrar menos
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Ver mais ({pendingDeals.length - INITIAL_LIMIT})
                </>
              )}
            </Button>
          </div>
        )}

        {/* Barra de ações em lote */}
        {selectedDeals.length > 0 && (
          <div className="sticky bottom-0 flex items-center justify-between gap-4 p-4 bg-primary/5 border-t">
            <span className="text-sm font-medium">
              {selectedDeals.length} {selectedDeals.length === 1 ? "deal selecionado" : "deals selecionados"}
            </span>
            <div className="flex items-center gap-3">
              <Select value={bulkAssignTo} onValueChange={setBulkAssignTo} disabled={availableReps.length === 0}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={availableReps.length === 0 ? "Sem equipe" : "Atribuir para..."} />
                </SelectTrigger>
                <SelectContent>
                  {availableReps?.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      <div className="flex items-center gap-2">
                        <span 
                          className={cn(
                            "h-2 w-2 rounded-full",
                            rep.availability_status === "online" ? "bg-emerald-500" : "bg-slate-400"
                          )}
                        />
                        {rep.full_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleBulkAssign}
                disabled={!bulkAssignTo || bulkAssignMutation.isPending}
              >
                Atribuir Selecionados
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setSelectedDeals([])}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
