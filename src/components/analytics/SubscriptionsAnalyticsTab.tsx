import { useKiwifyCompleteMetrics } from "@/hooks/useKiwifyCompleteMetrics";
import { useDealsConversionAnalysis } from "@/hooks/useDealsConversionAnalysis";
import { useLeadCreationMetrics } from "@/hooks/useLeadCreationMetrics";
import { DateRange } from "react-day-picker";
import { Users, ShoppingCart, Target, DollarSign, RefreshCcw, TrendingDown } from "lucide-react";

// Widgets
import { KPIScorecard } from "./subscriptions/KPIScorecard";
import { LeadsBySourceChart } from "./subscriptions/LeadsBySourceChart";
import { NewVsRecurringChart } from "./subscriptions/NewVsRecurringChart";
import { ProductPerformanceTable } from "./subscriptions/ProductPerformanceTable";
import { SalesRepRankingWidget } from "./subscriptions/SalesRepRankingWidget";
import { ChurnAnalysisCard } from "./subscriptions/ChurnAnalysisCard";
import { ChannelPerformanceTable } from "./subscriptions/ChannelPerformanceTable";

interface SubscriptionsAnalyticsTabProps {
  startDate: Date;
  endDate: Date;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function SubscriptionsAnalyticsTab({ startDate, endDate }: SubscriptionsAnalyticsTabProps) {
  // Data hooks
  const { data: kiwifyMetrics, isLoading: kiwifyLoading } = useKiwifyCompleteMetrics(startDate, endDate);
  const dateRange: DateRange = { from: startDate, to: endDate };
  const { data: conversionData, isLoading: conversionLoading } = useDealsConversionAnalysis(dateRange);
  const { data: leadMetrics, isLoading: leadLoading } = useLeadCreationMetrics(startDate, endDate);

  const isLoading = kiwifyLoading || conversionLoading || leadLoading;

  return (
    <div className="space-y-6">
      {/* ROW 1: 6 KPI Scorecards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPIScorecard
          title="Total Leads"
          value={leadMetrics?.totalCreated || 0}
          subtitle="criados no período"
          icon={Users}
          iconColor="text-blue-500"
          isLoading={isLoading}
        />
        <KPIScorecard
          title="Total Vendas"
          value={kiwifyMetrics?.vendasAprovadas || 0}
          subtitle="vendas aprovadas"
          icon={ShoppingCart}
          iconColor="text-green-500"
          isLoading={isLoading}
        />
        <KPIScorecard
          title="Taxa Conversão"
          value={`${(conversionData?.createdToWonRate || 0).toFixed(1)}%`}
          subtitle="leads → vendas"
          icon={Target}
          iconColor="text-purple-500"
          isLoading={isLoading}
        />
        <KPIScorecard
          title="Receita Bruta"
          value={formatCurrency(kiwifyMetrics?.receitaBruta || 0)}
          subtitle="valor total"
          icon={DollarSign}
          iconColor="text-emerald-500"
          isLoading={isLoading}
        />
        <KPIScorecard
          title="Reembolsos"
          value={kiwifyMetrics?.reembolsos?.quantidade || 0}
          subtitle={formatCurrency(kiwifyMetrics?.reembolsos?.valor || 0)}
          icon={RefreshCcw}
          iconColor="text-orange-500"
          isLoading={isLoading}
        />
        <KPIScorecard
          title="Churn Rate"
          value={`${(kiwifyMetrics?.taxaChurn || 0).toFixed(1)}%`}
          subtitle="cancelamentos"
          icon={TrendingDown}
          iconColor="text-red-500"
          isLoading={isLoading}
        />
      </div>

      {/* ROW 2: Leads por Fonte (Pie) + Novas vs Recorrentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LeadsBySourceChart startDate={startDate} endDate={endDate} />
        <NewVsRecurringChart data={kiwifyMetrics} isLoading={kiwifyLoading} />
      </div>

      {/* ROW 3: Performance por Produto (Full Width) */}
      <ProductPerformanceTable data={kiwifyMetrics} isLoading={kiwifyLoading} />

      {/* ROW 4: Top Vendedores + Análise de Churn */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SalesRepRankingWidget />
        <ChurnAnalysisCard data={kiwifyMetrics} isLoading={kiwifyLoading} />
      </div>

      {/* ROW 5: Performance por Canal (Full Width) */}
      <ChannelPerformanceTable startDate={startDate} endDate={endDate} />
    </div>
  );
}
