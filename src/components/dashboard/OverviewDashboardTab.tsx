import { TrendingUp, Target, DollarSign, Clock, Headphones, MessageSquare, Users, AlertCircle } from "lucide-react";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import { KPICard } from "@/components/widgets/KPICard";
import { useKiwifyFinancials } from "@/hooks/useKiwifyFinancials";
import { usePipelineValue } from "@/hooks/usePipelineValue";
import { useDealsConversionAnalysis } from "@/hooks/useDealsConversionAnalysis";
import { useSupportMetrics, useSupportDashboardCounts } from "@/hooks/useSupportMetrics";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useTeamOnlineCount } from "@/hooks/useTeamOnlineCount";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePerformanceLog } from "@/lib/prefetch";

interface OverviewDashboardTabProps {
  dateRange?: DateRange;
}

/** Lightweight RPC count instead of loading all conversations */
function useActiveConversationCounts() {
  return useQuery({
    queryKey: ["active-conversation-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_active_conversation_counts");
      if (error) throw error;
      const result = data as any;
      return {
        total: result?.total || 0,
        queued: result?.queued || 0,
      };
    },
    staleTime: 30_000,
  });
}

export function OverviewDashboardTab({ dateRange }: OverviewDashboardTabProps) {
  // Default date range if not provided
  const startDate = dateRange?.from || startOfMonth(new Date());
  const endDate = dateRange?.to || endOfMonth(new Date());

  const { data: kiwifyFinancials } = useKiwifyFinancials(dateRange?.from, dateRange?.to);
  const { totalPipelineValue, weightedValue } = usePipelineValue();
  const { data: conversionData } = useDealsConversionAnalysis(dateRange);
  const { data: dashCounts, isError: countsError } = useSupportDashboardCounts(startDate, endDate);
  const { data: supportMetrics, isError: metricsError } = useSupportMetrics(startDate, endDate);
  const { data: whatsappInstances } = useWhatsAppInstances();
  const { data: convCounts } = useActiveConversationCounts();
  const { data: teamOnlineCount } = useTeamOnlineCount();

  // Perf log: mount → data ready
  const dataReady = convCounts !== undefined && supportMetrics !== undefined && dashCounts !== undefined;
  usePerformanceLog('DashboardOverview', dataReady);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatTime = (minutes: number | undefined) => {
    if (!minutes || minutes === 0) return "0s";
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    if (minutes >= 1) {
      const mins = Math.floor(minutes);
      const secs = Math.round((minutes - mins) * 60);
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    return `${Math.round(minutes * 60)}s`;
  };

  const errorLabel = <span className="inline-flex items-center gap-1 text-destructive text-xs"><AlertCircle className="h-3 w-3" />Erro</span>;
  const activeSlaAlerts = countsError ? "—" : (dashCounts?.sla_risk || 0).toString();
  const connectedInstances = whatsappInstances?.filter(i => i.status === 'connected').length || 0;
  const totalInstances = whatsappInstances?.length || 0;
  const activeConversations = convCounts?.total || 0;
  const queuedConversations = convCounts?.queued || 0;

  return (
    <BentoGrid cols={4}>
      {/* Seção Vendas */}
      <BentoCard span="full">
        <Card className="border border-border/50 rounded-xl shadow-sm p-4">
          <CardHeader className="pb-2 px-0 pt-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">Vendas</CardTitle>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="grid grid-cols-4 gap-4">
              <KPICard 
                title="Pipeline" 
                value={formatCurrency(totalPipelineValue)} 
                icon={TrendingUp}
                description="valor total"
              />
              <KPICard 
                title="Pipeline Ponderado" 
                value={formatCurrency(weightedValue)} 
                icon={Target}
                description="por probabilidade"
              />
              <KPICard 
                title="Taxa Conversão" 
                value={`${conversionData?.createdToWonRate?.toFixed(1) || 0}%`}
                icon={Target}
                description={`${conversionData?.totalWon || 0} de ${conversionData?.totalCreated || 0}`}
              />
              <KPICard 
                title="Ciclo Médio" 
                value={`${conversionData?.avgTimeToWinDays || 0} dias`}
                icon={Clock}
                description="tempo p/ ganhar"
              />
            </div>
          </CardContent>
        </Card>
      </BentoCard>

      {/* Seção Suporte */}
      <BentoCard span="full">
        <Card className="border border-border/50 rounded-xl shadow-sm p-4">
          <CardHeader className="pb-2 px-0 pt-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">Suporte</CardTitle>
              <Headphones className="h-5 w-5 text-info" />
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="grid grid-cols-4 gap-4">
              <KPICard 
                title="SLA em Risco" 
                value={activeSlaAlerts}
                icon={Clock}
                description={countsError ? errorLabel : "alertas ativos"}
              />
              <KPICard 
                title="Tickets Abertos" 
                value={countsError ? "—" : (dashCounts?.tickets_open || 0).toString()}
                icon={Headphones}
                description={countsError ? errorLabel : "no período"}
              />
              <KPICard 
                title="Resposta Humana" 
                value={metricsError ? "—" : formatTime(supportMetrics?.avgFRT)}
                icon={Clock}
                description={metricsError ? errorLabel : "tempo médio"}
              />
              <KPICard 
                title="CSAT" 
                value={metricsError ? "—" : (supportMetrics?.avgCSAT ? `${supportMetrics.avgCSAT.toFixed(1)}/5` : "0/5")}
                icon={Target}
                description={metricsError ? errorLabel : "satisfação"}
              />
            </div>
          </CardContent>
        </Card>
      </BentoCard>

      {/* Seção Financeiro */}
      <BentoCard span="full">
        <Card className="border border-border/50 rounded-xl shadow-sm p-4">
          <CardHeader className="pb-2 px-0 pt-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">Financeiro</CardTitle>
              <DollarSign className="h-5 w-5 text-success" />
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="grid grid-cols-4 gap-4">
              <KPICard 
                title="Receita Líquida" 
                value={formatCurrency(kiwifyFinancials?.totalNetRevenue || 0)}
                icon={DollarSign}
                description="depositado"
              />
              <KPICard 
                title="Receita Bruta" 
                value={formatCurrency(kiwifyFinancials?.totalGrossRevenue || 0)}
                icon={DollarSign}
                description="vendas totais"
              />
              <KPICard 
                title="Taxas" 
                value={formatCurrency(kiwifyFinancials?.totalKiwifyFees || 0)}
                icon={DollarSign}
                description="Kiwify + gateway"
              />
              <KPICard 
                title="Comissões" 
                value={formatCurrency(kiwifyFinancials?.totalAffiliateCommissions || 0)}
                icon={Users}
                description="afiliados"
              />
            </div>
          </CardContent>
        </Card>
      </BentoCard>

      {/* Seção Operacional */}
      <BentoCard span="full">
        <Card className="border border-border/50 rounded-xl shadow-sm p-4">
          <CardHeader className="pb-2 px-0 pt-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">Operacional</CardTitle>
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="grid grid-cols-4 gap-4">
              <KPICard 
                title="WhatsApp" 
                value={`${connectedInstances}/${totalInstances}`}
                icon={MessageSquare}
                description="instâncias ativas"
              />
              <KPICard 
                title="Equipe Online" 
                value={(teamOnlineCount || 0).toString()}
                icon={Users}
                description="agentes disponíveis"
              />
              <KPICard 
                title="Conversas Ativas" 
                value={activeConversations.toString()}
                icon={MessageSquare}
                description="em atendimento"
              />
              <KPICard 
                title="Fila" 
                value={queuedConversations.toString()}
                icon={Clock}
                description="aguardando"
              />
            </div>
          </CardContent>
        </Card>
      </BentoCard>
    </BentoGrid>
  );
}
