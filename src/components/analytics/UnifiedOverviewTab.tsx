import { CompactMetricsGrid, type CompactMetric } from "@/components/ui/CompactMetricsGrid";
import { useKiwifyCompleteMetrics } from "@/hooks/useKiwifyCompleteMetrics";
import { useLeadCreationMetrics } from "@/hooks/useLeadCreationMetrics";
import { useSupportMetrics } from "@/hooks/useSupportMetrics";
import { usePipelineValue } from "@/hooks/usePipelineValue";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  TrendingUp,
  Users,
  Target,
  AlertTriangle,
  Headphones,
  Clock,
  Star,
  Banknote,
  ShoppingCart,
  UserMinus,
} from "lucide-react";

interface UnifiedOverviewTabProps {
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

function formatTime(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function UnifiedOverviewTab({ startDate, endDate }: UnifiedOverviewTabProps) {
  const { data: kiwifyMetrics, isLoading: kiwifyLoading } = useKiwifyCompleteMetrics(startDate, endDate);
  const { data: leadMetrics, isLoading: leadLoading } = useLeadCreationMetrics(startDate, endDate);
  const { data: supportMetrics, isLoading: supportLoading } = useSupportMetrics(startDate, endDate);
  const { weightedValue, isLoading: pipelineLoading } = usePipelineValue(startDate, endDate);

  const isLoading = kiwifyLoading || leadLoading || supportLoading || pipelineLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  // Revenue Metrics
  const receitaLiquida = kiwifyMetrics?.receitaLiquida || 0;
  const receitaBruta = kiwifyMetrics?.receitaBruta || 0;
  const vendasTotal = kiwifyMetrics?.vendasAprovadas || 0;
  const vendasNovas = kiwifyMetrics?.vendasNovas || 0;
  const renovacoes = kiwifyMetrics?.renovacoes || 0;

  // Lead Metrics
  const totalLeads = leadMetrics?.totalCreated || 0;
  const totalWon = leadMetrics?.totalWon || 0;
  const totalLost = leadMetrics?.totalLost || 0;
  const conversionRate = totalLeads > 0 ? ((totalWon / totalLeads) * 100).toFixed(1) : "0";

  // Churn Metrics
  const taxaChurn = kiwifyMetrics?.taxaChurn || 0;
  const reembolsos = kiwifyMetrics?.reembolsos?.quantidade || 0;
  const chargebacks = kiwifyMetrics?.chargebacks?.quantidade || 0;

  // Support Metrics
  const avgFRT = supportMetrics?.avgFRT || 0;
  const avgCSAT = supportMetrics?.avgCSAT || 0;
  const totalRatings = supportMetrics?.totalRatings || 0;

  // Percentages
  const percentLiquida = receitaBruta > 0 
    ? ((receitaLiquida / receitaBruta) * 100).toFixed(0) + "%"
    : "0%";
  const percentNovos = vendasTotal > 0
    ? ((vendasNovas / vendasTotal) * 100).toFixed(0) + "%"
    : "0%";

  // Row 1: Revenue & Sales Overview
  const revenueMetrics: CompactMetric[] = [
    {
      title: "Receita Líquida",
      value: formatCurrency(receitaLiquida),
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
      percent: percentLiquida,
      percentColor: "green",
      tooltip: "Receita após taxas Kiwify e comissões",
    },
    {
      title: "Vendas Totais",
      value: vendasTotal,
      icon: ShoppingCart,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      subtext: `${vendasNovas} novos | ${renovacoes} recorrentes`,
      tooltip: "Total de vendas aprovadas no período",
    },
    {
      title: "Leads Totais",
      value: totalLeads,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
      subtext: `${totalWon} ganhos | ${totalLost} perdidos`,
      tooltip: "Deals criados no período",
    },
    {
      title: "Taxa Conversão",
      value: conversionRate + "%",
      icon: Target,
      color: "text-amber-600",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
      subtext: `Pipeline: ${formatCurrency(weightedValue)}`,
      tooltip: "Deals ganhos / Deals criados",
    },
  ];

  // Row 2: Churn & Support
  const operationalMetrics: CompactMetric[] = [
    {
      title: "Churn Rate",
      value: taxaChurn.toFixed(1) + "%",
      icon: UserMinus,
      color: taxaChurn > 5 ? "text-red-600" : "text-amber-600",
      bgColor: taxaChurn > 5 ? "bg-red-100 dark:bg-red-900/30" : "bg-amber-100 dark:bg-amber-900/30",
      subtext: `${reembolsos} reembolsos | ${chargebacks} chargebacks`,
      tooltip: "Taxa de cancelamentos e reembolsos",
    },
    {
      title: "Pipeline Ponderado",
      value: formatCurrency(weightedValue),
      icon: Banknote,
      color: "text-cyan-600",
      bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
      tooltip: "Valor potencial ponderado por probabilidade",
    },
    {
      title: "Tempo 1ª Resposta",
      value: formatTime(avgFRT),
      icon: Clock,
      color: avgFRT <= 5 ? "text-green-600" : avgFRT <= 15 ? "text-amber-600" : "text-red-600",
      bgColor: avgFRT <= 5 ? "bg-green-100 dark:bg-green-900/30" : avgFRT <= 15 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-red-100 dark:bg-red-900/30",
      subtext: avgFRT <= 5 ? "Excelente" : avgFRT <= 15 ? "Bom" : "Precisa melhorar",
      tooltip: "First Response Time médio",
    },
    {
      title: "CSAT",
      value: avgCSAT > 0 ? `${avgCSAT.toFixed(1)}/5` : "N/A",
      icon: Star,
      color: avgCSAT >= 4 ? "text-green-600" : avgCSAT >= 3 ? "text-amber-600" : "text-red-600",
      bgColor: avgCSAT >= 4 ? "bg-green-100 dark:bg-green-900/30" : avgCSAT >= 3 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-red-100 dark:bg-red-900/30",
      subtext: `${totalRatings} avaliações`,
      tooltip: "Customer Satisfaction Score",
    },
  ];

  return (
    <div className="space-y-6">
      <CompactMetricsGrid 
        label="Receita & Vendas" 
        metrics={revenueMetrics} 
        columns={4} 
      />
      <CompactMetricsGrid 
        label="Operacional & Suporte" 
        metrics={operationalMetrics} 
        columns={4} 
      />
    </div>
  );
}
