import { useKiwifySubscriptions, SubscriptionMetrics } from "@/hooks/useKiwifySubscriptions";
import { useDealsCounts } from "@/hooks/useDealsCounts";
import { FileDown, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const { data: subscriptionData, isLoading: subscriptionLoading, error: subscriptionError, isRefetching: subscriptionRefetching } = useKiwifySubscriptions(startDate, endDate);
  const { data: dealsCounts, isLoading: dealsLoading, error: dealsError, isRefetching: dealsRefetching } = useDealsCounts(startDate, endDate);
  
  // PDF Export
  const { exportToPDF, isExporting } = useExportPDF();

  const isLoading = subscriptionLoading || dealsLoading;
  
  // Detectar erro de conexão
  const hasConnectionError = !!(subscriptionError || dealsError);
  const isRefetching = subscriptionRefetching || dealsRefetching;

  const handleExportPDF = async () => {
    // Bloquear exportação enquanto dados carregam
    if (isLoading) {
      toast.warning("Aguarde os dados carregarem antes de exportar.");
      return;
    }
    
    try {
      // Pequeno delay para garantir que DOM está totalmente renderizado
      await new Promise(resolve => setTimeout(resolve, 500));
      
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

      {/* Connection Error Alert */}
      {hasConnectionError && (
        <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
          <Wifi className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-2">
            <span>Conexão instável detectada.</span>
            {isRefetching && (
              <span className="text-xs animate-pulse">Reconectando...</span>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              Exibindo últimos dados disponíveis
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Dashboard Content - Wrapped for PDF export */}
      <div id="subscriptions-dashboard" className="space-y-6 bg-background">
        {/* ROW 1: Conversion Funnel (Full Width) */}
        <ConversionFunnelWidget
          leadMetrics={{ totalCreated: dealsCounts?.totalCreated || 0 }}
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
