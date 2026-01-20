import { useKiwifySubscriptions } from "@/hooks/useKiwifySubscriptions";
import { useAllSourcesConversionAnalysis } from "@/hooks/useAllSourcesConversionAnalysis";
import { DateRange } from "react-day-picker";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExportPDF } from "@/hooks/useExportPDF";
import { toast } from "sonner";
import { CompactMetricsGrid, type CompactMetric } from "@/components/ui/CompactMetricsGrid";
import { 
  TrendingUp, 
  Users, 
  Target, 
  DollarSign,
  ShoppingCart,
  RefreshCw,
  Banknote,
  UserPlus
} from "lucide-react";

// Widgets
import { LeadsBySourceChart } from "./subscriptions/LeadsBySourceChart";
import { NewVsRecurringChart } from "./subscriptions/NewVsRecurringChart";
import { ProductPerformanceTable } from "./subscriptions/ProductPerformanceTable";
import { SalesRepRankingWidget } from "./subscriptions/SalesRepRankingWidget";
import { WhoSoldRankingWidget } from "./subscriptions/WhoSoldRankingWidget";
import { WonDealsByChannelWidget } from "./subscriptions/WonDealsByChannelWidget";
// Premium widgets (do Dashboard de Vendas)
import { ConversionFunnelCard } from "@/components/widgets/ConversionFunnelCard";
import { StageConversionChart } from "@/components/widgets/StageConversionChart";

interface SalesSubscriptionsTabProps {
  startDate: Date;
  endDate: Date;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function SalesSubscriptionsTab({ startDate, endDate }: SalesSubscriptionsTabProps) {
  const { data: subscriptionData, isLoading: subscriptionLoading } = useKiwifySubscriptions(startDate, endDate);
  const dateRange: DateRange = { from: startDate, to: endDate };
  const { totals: conversionTotals, isLoading: conversionLoading } = useAllSourcesConversionAnalysis(dateRange);
  
  const { exportToPDF, isExporting } = useExportPDF();
  const isLoading = subscriptionLoading || conversionLoading;

  const handleExportPDF = async () => {
    try {
      await exportToPDF("sales-subscriptions-dashboard", {
        filename: "Relatorio_Vendas_Assinaturas",
        title: "Relatório de Vendas e Assinaturas",
      });
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar PDF. Tente novamente.");
    }
  };

  // Calculate metrics - using synced data from useAllSourcesConversionAnalysis
  const totalCreated = conversionTotals?.totalCreated || 0;
  const totalWon = conversionTotals?.totalWon || 0;
  const totalLost = conversionTotals?.totalLost || 0;
  const totalOpen = conversionTotals?.totalOpen || 0;

  // Kiwify metrics from subscription data (uses the correct SubscriptionMetrics interface)
  const kiwifyTotal = subscriptionData?.vendasLiquidas || 0;
  const newCustomers = subscriptionData?.clientesNovos || 0;
  const recurring = subscriptionData?.clientesRecorrentes || 0;
  const totalGross = subscriptionData?.subscriptions?.reduce((sum, s) => sum + (s.grossValue || 0), 0) || 0;
  const totalNet = subscriptionData?.subscriptions?.reduce((sum, s) => sum + (s.netValue || 0), 0) || 0;

  const conversionRate = totalCreated > 0 
    ? ((totalWon / totalCreated) * 100).toFixed(1)
    : "0";

  const percentGanhos = totalCreated > 0 
    ? ((totalWon / totalCreated) * 100).toFixed(0) + "%"
    : "0%";
  
  const percentNovos = kiwifyTotal > 0 
    ? ((newCustomers / kiwifyTotal) * 100).toFixed(0) + "%"
    : "0%";
  
  const percentRecorrentes = kiwifyTotal > 0 
    ? ((recurring / kiwifyTotal) * 100).toFixed(0) + "%"
    : "0%";

  const percentLiquida = totalGross > 0
    ? ((totalNet / totalGross) * 100).toFixed(0) + "%"
    : "0%";

  // Row 1: Resumo do Funil
  const resumoMetrics: CompactMetric[] = [
    {
      title: "Deals Criados",
      value: totalCreated,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      subtext: `${totalOpen} em aberto`,
      tooltip: "Total de deals criados no período"
    },
    {
      title: "Deals Ganhos",
      value: totalWon,
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/30",
      percent: percentGanhos,
      percentColor: "green",
      subtext: formatCurrency(totalNet),
      tooltip: "Deals ganhos / Deals criados"
    },
    {
      title: "Vendas Kiwify",
      value: kiwifyTotal,
      icon: ShoppingCart,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
      subtext: `${newCustomers} novos | ${recurring} recorrentes`,
      tooltip: "Total de vendas processadas no Kiwify"
    },
    {
      title: "Conversão",
      value: conversionRate + "%",
      icon: Target,
      color: "text-amber-600",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
      subtext: `${totalLost} perdidos`,
      tooltip: "Taxa de conversão (Ganhos / Criados)"
    },
  ];

  // Row 2: Receita e Breakdown
  const receitaMetrics: CompactMetric[] = [
    {
      title: "Receita Bruta",
      value: formatCurrency(totalGross),
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
      tooltip: "Valor total bruto das vendas Kiwify"
    },
    {
      title: "Receita Líquida",
      value: formatCurrency(totalNet),
      icon: Banknote,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/30",
      percent: percentLiquida,
      percentColor: "green",
      tooltip: "Receita após taxas (% do bruto)"
    },
    {
      title: "Clientes Novos",
      value: newCustomers,
      icon: UserPlus,
      color: "text-cyan-600",
      bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
      percent: percentNovos,
      percentColor: "green",
      tooltip: "Primeira compra do cliente"
    },
    {
      title: "Recorrentes",
      value: recurring,
      icon: RefreshCw,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      percent: percentRecorrentes,
      percentColor: "muted",
      tooltip: "Renovações e recompras"
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Vendas & Assinaturas</h3>
          <p className="text-sm text-muted-foreground">
            Métricas consolidadas de conversão e receita
          </p>
        </div>
        <Button
          onClick={handleExportPDF}
          disabled={isExporting}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <FileDown className="h-4 w-4" />
          {isExporting ? "Exportando..." : "PDF"}
        </Button>
      </div>

      {/* Dashboard Content */}
      <div id="sales-subscriptions-dashboard" className="space-y-6 bg-background">
        {/* KPI Cards */}
        <CompactMetricsGrid label="Resumo do Funil" metrics={resumoMetrics} columns={4} />
        <CompactMetricsGrid label="Receita e Breakdown" metrics={receitaMetrics} columns={4} />

        {/* Premium Conversion Section: Funnel + Stage Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ConversionFunnelCard dateRange={dateRange} />
          <StageConversionChart />
        </div>

        {/* Won Deals Breakdown by Channel & Seller (com breakdown comercial) */}
        <WonDealsByChannelWidget startDate={startDate} endDate={endDate} />

        {/* Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <LeadsBySourceChart startDate={startDate} endDate={endDate} />
          <NewVsRecurringChart data={subscriptionData} isLoading={subscriptionLoading} />
        </div>

        {/* Rankings */}
        <WhoSoldRankingWidget subscriptionData={subscriptionData} isLoading={subscriptionLoading} />
        <ProductPerformanceTable subscriptionData={subscriptionData} isLoading={subscriptionLoading} />

        {/* Sales Rep Ranking */}
        <SalesRepRankingWidget startDate={startDate} endDate={endDate} />
      </div>
    </div>
  );
}
