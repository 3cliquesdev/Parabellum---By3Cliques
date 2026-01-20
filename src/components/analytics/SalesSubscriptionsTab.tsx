import { useKiwifySubscriptions } from "@/hooks/useKiwifySubscriptions";
import { useDealsConversionAnalysis } from "@/hooks/useDealsConversionAnalysis";
import { useLeadCreationMetrics } from "@/hooks/useLeadCreationMetrics";
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
import { ConversionFunnelWidget } from "./subscriptions/ConversionFunnelWidget";
import { LeadsBySourceChart } from "./subscriptions/LeadsBySourceChart";
import { NewVsRecurringChart } from "./subscriptions/NewVsRecurringChart";
import { ProductPerformanceTable } from "./subscriptions/ProductPerformanceTable";
import { SalesRepRankingWidget } from "./subscriptions/SalesRepRankingWidget";
import { WhoSoldRankingWidget } from "./subscriptions/WhoSoldRankingWidget";
import { WonDealsByChannelWidget } from "./subscriptions/WonDealsByChannelWidget";

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
  const { data: conversionData, isLoading: conversionLoading } = useDealsConversionAnalysis(dateRange);
  const { data: leadMetrics, isLoading: leadLoading } = useLeadCreationMetrics(startDate, endDate);
  
  const { exportToPDF, isExporting } = useExportPDF();
  const isLoading = subscriptionLoading || conversionLoading || leadLoading;

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

  // Calculate metrics
  const kiwifyTotal = leadMetrics?.kiwifyEvents?.total || 0;
  const totalCreated = leadMetrics?.totalCreated || 0;
  const totalWon = leadMetrics?.totalWon || 0;
  const totalGross = leadMetrics?.kiwifyEvents?.totalGross || 0;
  const totalNet = leadMetrics?.kiwifyEvents?.totalNet || 0;
  const newCustomers = leadMetrics?.kiwifyEvents?.newCustomers || 0;
  const recurring = leadMetrics?.kiwifyEvents?.recurring || 0;

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
      subtext: formatCurrency(leadMetrics?.totalOpenValue || 0),
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
      subtext: formatCurrency(leadMetrics?.totalWonValue || 0),
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
      subtext: `${leadMetrics?.totalLost || 0} perdidos`,
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

        {/* Conversion Funnel */}
        <ConversionFunnelWidget
          leadMetrics={leadMetrics}
          subscriptionData={subscriptionData}
          isLoading={isLoading}
        />

        {/* Won Deals Breakdown by Channel & Seller */}
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
