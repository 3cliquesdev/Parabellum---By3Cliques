/**
 * ════════════════════════════════════════════════════════════════════════════
 * ⚠️ LÓGICA TRAVADA - VALIDADA EM 20/01/2026 ⚠️
 * 
 * Este componente usa fontes de dados VALIDADAS:
 * - useDealsCounts: Contagem simples de deals (306 em 15/01/2026)
 * - useKiwifySubscriptions: Vendas Kiwify (já validado no menu /subscriptions)
 * 
 * NÃO ALTERAR a lógica de contagem sem aprovação!
 * ════════════════════════════════════════════════════════════════════════════
 */

import { useKiwifySubscriptions } from "@/hooks/useKiwifySubscriptions";
import { useDealsCounts } from "@/hooks/useDealsCounts";
import { DateRange } from "react-day-picker";
import { Download, FileText, FileCode, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useExportPDF } from "@/hooks/useExportPDF";
import { useExportXML, type XMLReportData } from "@/hooks/useExportXML";
import { useExportExcel, type ExcelReportData } from "@/hooks/useExportExcel";
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
import { OfferPerformanceTable } from "./subscriptions/OfferPerformanceTable";
import { SalesRepRankingWidget } from "./subscriptions/SalesRepRankingWidget";
import { WhoSoldRankingWidget } from "./subscriptions/WhoSoldRankingWidget";
import { WonDealsByChannelWidget } from "./subscriptions/WonDealsByChannelWidget";
import { SalesChannelQuantityWidget } from "./subscriptions/SalesChannelQuantityWidget";
// Premium widgets (do Dashboard de Vendas)
import { VisualFunnelChart } from "@/components/widgets/VisualFunnelChart";
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
  
  // ⚠️ LÓGICA TRAVADA: Usar useDealsCounts (query simples + cache 60s)
  const { data: dealsCounts, isLoading: dealsLoading } = useDealsCounts(startDate, endDate);
  
  const { exportToPDF, isExporting: isExportingPDF } = useExportPDF();
  const { exportToXML, isExporting: isExportingXML } = useExportXML();
  const { exportToExcel, isExporting: isExportingExcel } = useExportExcel();
  const isLoading = subscriptionLoading || dealsLoading;
  const isExporting = isExportingPDF || isExportingXML || isExportingExcel;

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

  const handleExportXML = async () => {
    try {
      const totalCreated = dealsCounts?.totalCreated || 0;
      const totalWon = dealsCounts?.totalWon || 0;
      const totalLost = dealsCounts?.totalLost || 0;
      const totalOpen = dealsCounts?.totalOpen || 0;

      const totalGross = subscriptionData?.subscriptions?.reduce((sum, s) => sum + (s.grossValue || 0), 0) || 0;
      const totalNet = subscriptionData?.subscriptions?.reduce((sum, s) => sum + (s.netValue || 0), 0) || 0;
      const newCustomers = subscriptionData?.clientesNovos || 0;
      const recurring = subscriptionData?.clientesRecorrentes || 0;
      const kiwifyTotal = subscriptionData?.vendasLiquidas || 0;

      const conversionRate = totalCreated > 0 
        ? ((totalWon / totalCreated) * 100).toFixed(1) + "%"
        : "0%";

      const xmlData: XMLReportData = {
        periodo: { inicio: startDate, fim: endDate },
        resumo: {
          dealsCreados: totalCreated,
          dealsGanhos: totalWon,
          dealsAbertos: totalOpen,
          dealsPerdidos: totalLost,
          taxaConversao: conversionRate,
        },
        receita: {
          bruta: totalGross,
          liquida: totalNet,
        },
        clientes: {
          total: kiwifyTotal,
          novos: newCustomers,
          recorrentes: recurring,
        },
      };

      await exportToXML(xmlData, {
        filename: "Relatorio_Vendas_Assinaturas",
        title: "Relatório de Vendas e Assinaturas",
      });
      toast.success("XML exportado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar XML. Tente novamente.");
    }
  };

  const handleExportExcel = async () => {
    try {
      const totalCreated = dealsCounts?.totalCreated || 0;
      const totalWon = dealsCounts?.totalWon || 0;
      const totalLost = dealsCounts?.totalLost || 0;
      const totalOpen = dealsCounts?.totalOpen || 0;

      const totalGross = subscriptionData?.subscriptions?.reduce((sum, s) => sum + (s.grossValue || 0), 0) || 0;
      const totalNet = subscriptionData?.subscriptions?.reduce((sum, s) => sum + (s.netValue || 0), 0) || 0;
      const newCustomers = subscriptionData?.clientesNovos || 0;
      const recurring = subscriptionData?.clientesRecorrentes || 0;
      const kiwifyTotal = subscriptionData?.vendasLiquidas || 0;

      const conversionRate = totalCreated > 0 
        ? ((totalWon / totalCreated) * 100).toFixed(1) + "%"
        : "0%";

      // Agregar por produto
      const produtosMap = new Map<string, { nome: string; vendas: number; bruto: number; liquido: number }>();
      subscriptionData?.subscriptions?.forEach(sub => {
        const key = sub.productCategory || sub.productName;
        const current = produtosMap.get(key) || { nome: key, vendas: 0, bruto: 0, liquido: 0 };
        current.vendas++;
        current.bruto += sub.grossValue || 0;
        current.liquido += sub.netValue || 0;
        produtosMap.set(key, current);
      });

      const excelData: ExcelReportData = {
        periodo: { inicio: startDate, fim: endDate },
        resumo: {
          dealsCreados: totalCreated,
          dealsGanhos: totalWon,
          dealsAbertos: totalOpen,
          dealsPerdidos: totalLost,
          taxaConversao: conversionRate,
        },
        receita: {
          bruta: totalGross,
          liquida: totalNet,
        },
        clientes: {
          total: kiwifyTotal,
          novos: newCustomers,
          recorrentes: recurring,
        },
        produtos: Array.from(produtosMap.values()).sort((a, b) => b.bruto - a.bruto),
      };

      await exportToExcel(excelData, {
        filename: "Relatorio_Vendas_Assinaturas",
        title: "Relatório de Vendas e Assinaturas",
      });
      toast.success("Excel exportado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar Excel. Tente novamente.");
    }
  };

  // ⚠️ LÓGICA TRAVADA: Usar dados do useDealsCounts (query simples, cache 60s)
  const totalCreated = dealsCounts?.totalCreated || 0;
  const totalWon = dealsCounts?.totalWon || 0;
  const totalLost = dealsCounts?.totalLost || 0;
  const totalOpen = dealsCounts?.totalOpen || 0;

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isExporting} className="gap-2">
              <Download className="h-4 w-4" />
              {isExporting ? "Exportando..." : "Exportar"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem onClick={handleExportExcel} disabled={isExportingExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPDF} disabled={isExportingPDF}>
              <FileText className="h-4 w-4 mr-2" />
              PDF (Visual)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportXML} disabled={isExportingXML}>
              <FileCode className="h-4 w-4 mr-2" />
              XML (Dados)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dashboard Content */}
      <div id="sales-subscriptions-dashboard" className="space-y-6 bg-background">
        {/* KPI Cards */}
        <CompactMetricsGrid label="Resumo do Funil" metrics={resumoMetrics} columns={4} />
        <CompactMetricsGrid label="Receita e Breakdown" metrics={receitaMetrics} columns={4} />

        {/* 1. Detalhamento por Canal (com Insight + Quem Ganhou os Deals) */}
        <WonDealsByChannelWidget startDate={startDate} endDate={endDate} />

        {/* 2. Funil de Conversão Visual + Conversão por Etapa */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VisualFunnelChart dateRange={dateRange} />
          <StageConversionChart />
        </div>

        {/* 3. Leads por Fonte + Novos vs Recorrentes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <LeadsBySourceChart startDate={startDate} endDate={endDate} />
          <NewVsRecurringChart data={subscriptionData} isLoading={subscriptionLoading} />
        </div>

        {/* 4. Quem Vendeu (Produtos) */}
        <WhoSoldRankingWidget subscriptionData={subscriptionData} isLoading={subscriptionLoading} />

        {/* 5. Performance por Produto */}
        <ProductPerformanceTable subscriptionData={subscriptionData} isLoading={subscriptionLoading} />

        {/* 6. Performance por Oferta */}
        <OfferPerformanceTable subscriptionData={subscriptionData} isLoading={subscriptionLoading} />

        {/* 7. Canais de Vendas (Ranking por Quantidade) */}
        <SalesChannelQuantityWidget subscriptionData={subscriptionData} isLoading={subscriptionLoading} />

        {/* 8. Ranking de Vendedores */}
        <SalesRepRankingWidget startDate={startDate} endDate={endDate} />
      </div>
    </div>
  );
}
