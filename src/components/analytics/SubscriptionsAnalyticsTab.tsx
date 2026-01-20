import { useKiwifyCompleteMetrics } from "@/hooks/useKiwifyCompleteMetrics";
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
import { SalesRepRankingWidget } from "./subscriptions/SalesRepRankingWidget";
import { ChurnAnalysisCard } from "./subscriptions/ChurnAnalysisCard";
import { WhoSoldRankingWidget } from "./subscriptions/WhoSoldRankingWidget";
import { RefundsTimelineTable } from "./subscriptions/RefundsTimelineTable";

interface SubscriptionsAnalyticsTabProps {
  startDate: Date;
  endDate: Date;
}

export function SubscriptionsAnalyticsTab({ startDate, endDate }: SubscriptionsAnalyticsTabProps) {
  // Data hooks
  const { data: kiwifyMetrics, isLoading: kiwifyLoading } = useKiwifyCompleteMetrics(startDate, endDate);
  const dateRange: DateRange = { from: startDate, to: endDate };
  const { data: conversionData, isLoading: conversionLoading } = useDealsConversionAnalysis(dateRange);
  const { data: leadMetrics, isLoading: leadLoading } = useLeadCreationMetrics(startDate, endDate);
  
  // PDF Export
  const { exportToPDF, isExporting } = useExportPDF();

  const isLoading = kiwifyLoading || conversionLoading || leadLoading;

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
          kiwifyMetrics={kiwifyMetrics}
          isLoading={isLoading}
        />

        {/* ROW 2: Leads por Fonte (Pie) + Novas vs Recorrentes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <LeadsBySourceChart startDate={startDate} endDate={endDate} />
          <NewVsRecurringChart data={kiwifyMetrics} isLoading={kiwifyLoading} />
        </div>

        {/* ROW 3: Quem Vendeu - Ranking por Canal (Full Width) */}
        <WhoSoldRankingWidget startDate={startDate} endDate={endDate} />

        {/* ROW 4: Performance por Produto (Full Width) */}
        <ProductPerformanceTable data={kiwifyMetrics} isLoading={kiwifyLoading} />

        {/* ROW 5: Top Vendedores + Análise de Churn */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SalesRepRankingWidget />
          <ChurnAnalysisCard data={kiwifyMetrics} isLoading={kiwifyLoading} />
        </div>

        {/* ROW 6: Reembolsos por Data (Full Width) */}
        <RefundsTimelineTable startDate={startDate} endDate={endDate} />
      </div>
    </div>
  );
}
