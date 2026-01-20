import { useKiwifySubscriptions, SubscriptionMetrics } from "@/hooks/useKiwifySubscriptions";
import { useDealsConversionAnalysis } from "@/hooks/useDealsConversionAnalysis";
import { useLeadCreationMetrics } from "@/hooks/useLeadCreationMetrics";
import { DateRange } from "react-day-picker";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExportPDF } from "@/hooks/useExportPDF";
import { toast } from "sonner";

// Widgets
import { ConversionFunnelWidget } from "./subscriptions/ConversionFunnelWidget";
import { LeadsBySourceChart } from "./subscriptions/LeadsBySourceChart";
import { NewVsRecurringChart } from "./subscriptions/NewVsRecurringChart";
import { ProductPerformanceTable } from "./subscriptions/ProductPerformanceTable";
import { OfferPerformanceTable } from "./subscriptions/OfferPerformanceTable";
import { SalesRepRankingWidget } from "./subscriptions/SalesRepRankingWidget";
import { ChurnAnalysisCard } from "./subscriptions/ChurnAnalysisCard";
import { WhoSoldRankingWidget } from "./subscriptions/WhoSoldRankingWidget";
import { RefundsTimelineTable } from "./subscriptions/RefundsTimelineTable";
import { TopAffiliatesWidget } from "@/components/widgets/TopAffiliatesWidget";

interface SubscriptionsAnalyticsTabProps {
  startDate: Date;
  endDate: Date;
}

export function SubscriptionsAnalyticsTab({ startDate, endDate }: SubscriptionsAnalyticsTabProps) {
  // Data hooks - USANDO A MESMA FONTE DO MENU /subscriptions
  const { data: subscriptionData, isLoading: subscriptionLoading } = useKiwifySubscriptions(startDate, endDate);
  const dateRange: DateRange = { from: startDate, to: endDate };
  const { data: conversionData, isLoading: conversionLoading } = useDealsConversionAnalysis(dateRange);
  const { data: leadMetrics, isLoading: leadLoading } = useLeadCreationMetrics(startDate, endDate);
  
  // PDF Export
  const { exportToPDF, isExporting } = useExportPDF();

  const isLoading = subscriptionLoading || conversionLoading || leadLoading;

  const handleExportPDF = async () => {
    try {
      await exportToPDF("subscriptions-dashboard", {
        filename: "Relatorio_Vendas_Assinaturas",
        title: "Relatório de Vendas e Assinaturas",
      });
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar PDF. Tente novamente.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Export Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Análise de Vendas e Assinaturas
          </h2>
          <p className="text-sm text-muted-foreground">
            Dashboard executivo com métricas de conversão, vendas e churn
          </p>
        </div>
        <Button
          onClick={handleExportPDF}
          disabled={isExporting}
          variant="outline"
          className="gap-2"
        >
          <FileDown className="h-4 w-4" />
          {isExporting ? "Exportando..." : "Exportar PDF"}
        </Button>
      </div>

      {/* Dashboard Content - Wrapped for PDF export */}
      <div id="subscriptions-dashboard" className="space-y-6 bg-background">
        {/* ROW 1: Conversion Funnel (Full Width) */}
        <ConversionFunnelWidget
          leadMetrics={leadMetrics}
          subscriptionData={subscriptionData}
          isLoading={isLoading}
        />

        {/* ROW 2: Leads por Fonte (Pie) + Novas vs Recorrentes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <LeadsBySourceChart startDate={startDate} endDate={endDate} />
          <NewVsRecurringChart data={subscriptionData} isLoading={subscriptionLoading} />
        </div>

        {/* ROW 3: Quem Vendeu - Ranking por Canal (Full Width) */}
        <WhoSoldRankingWidget subscriptionData={subscriptionData} isLoading={subscriptionLoading} />

        {/* ROW 4: Performance por Produto (Full Width) */}
        <ProductPerformanceTable subscriptionData={subscriptionData} isLoading={subscriptionLoading} />

        {/* ROW 5: Performance por Oferta (Full Width) */}
        <OfferPerformanceTable subscriptionData={subscriptionData} isLoading={subscriptionLoading} />

        {/* ROW 6: Top Vendedores + Top Afiliados + Análise de Churn */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SalesRepRankingWidget startDate={startDate} endDate={endDate} />
          <TopAffiliatesWidget startDate={startDate} endDate={endDate} />
          <ChurnAnalysisCard subscriptionData={subscriptionData} isLoading={subscriptionLoading} />
        </div>

        {/* ROW 7: Reembolsos por Data (Full Width) */}
        <RefundsTimelineTable subscriptionData={subscriptionData} isLoading={subscriptionLoading} />
      </div>
    </div>
  );
}
