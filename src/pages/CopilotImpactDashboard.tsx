import { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Clock,
  Sparkles,
  Star,
  TrendingUp,
  BookOpen,
  Activity,
} from "lucide-react";
import {
  useCopilotHealthScore,
  useCopilotMonthlyEvolution,
  useCopilotComparison,
  useKBGapsByCategory,
} from "@/hooks/useCopilotHealthScore";
import { useCopilotInsights } from "@/hooks/useCopilotInsights";

// Components
import { HealthScoreGauge } from "@/components/copilot/HealthScoreGauge";
import { CopilotComparisonChart } from "@/components/copilot/CopilotComparisonChart";
import { MonthlyEvolutionChart } from "@/components/copilot/MonthlyEvolutionChart";
import { KBGapsByCategoryTable } from "@/components/copilot/KBGapsByCategoryTable";
import { CopilotInsightsCard } from "@/components/copilot/CopilotInsightsCard";

export default function CopilotImpactDashboard() {
  const [period, setPeriod] = useState("30");

  const periodDays = parseInt(period);

  // Fetch all data
  const { data: healthScore, isLoading: healthLoading } = useCopilotHealthScore(periodDays);
  const { data: comparison, isLoading: comparisonLoading } = useCopilotComparison(periodDays);
  const { data: evolution, isLoading: evolutionLoading } = useCopilotMonthlyEvolution(6);
  const { data: kbGaps, isLoading: kbGapsLoading } = useKBGapsByCategory(periodDays);
  
  const { 
    data: insightsData, 
    isLoading: insightsLoading,
    refetch: refetchInsights 
  } = useCopilotInsights(healthScore, comparison, evolution, kbGaps);

  const formatTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return "—";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}min`;
  };

  const formatPercent = (value: number | null | undefined, showSign = false) => {
    if (value === null || value === undefined) return "—";
    const sign = showSign && value > 0 ? "+" : "";
    return `${sign}${value}%`;
  };

  return (
    <Layout>
      <div className="container py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/reports">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="h-6 w-6 text-primary" />
                Impacto do Copilot
              </h1>
              <p className="text-muted-foreground text-sm">
                Métricas agregadas de saúde da operação e impacto da IA
              </p>
            </div>
          </div>

          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Health Score + Metric Cards Row */}
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 mb-6">
          {/* Health Score Gauge - spans 2 cols */}
          <div className="lg:col-span-2">
            <HealthScoreGauge 
              score={healthScore?.health_score} 
              isLoading={healthLoading}
              adoptionComponent={healthScore?.adoption_component}
              kbComponent={healthScore?.kb_component}
              csatComponent={healthScore?.csat_component}
              usageComponent={healthScore?.usage_component}
              dataQuality={healthScore?.data_quality}
            />
          </div>

          {/* Metric Cards - spans 4 cols */}
          <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Adoção IA
                </CardTitle>
              </CardHeader>
              <CardContent>
                {healthLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold text-primary">
                    {formatPercent(healthScore?.copilot_adoption_rate)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Eficiência
                </CardTitle>
              </CardHeader>
              <CardContent>
                {healthLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold text-chart-2">
                    {formatPercent(healthScore?.resolution_improvement_percent, true)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Cobertura KB
                </CardTitle>
              </CardHeader>
              <CardContent>
                {healthLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">
                    {formatPercent(healthScore?.kb_coverage_rate)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Aproveitamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {healthLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">
                    {formatPercent(healthScore?.suggestion_usage_rate)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Secondary Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total Conversas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <div className="text-lg font-semibold">
                  {healthScore?.total_conversations || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Tempo com IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <div className="text-lg font-semibold">
                  {formatTime(healthScore?.avg_resolution_time_with_copilot || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Star className="h-3 w-3" />
                CSAT com IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <div className="text-lg font-semibold">
                  {healthScore?.avg_csat_with_copilot?.toFixed(1) || "—"}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Sugestões Usadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <div className="text-lg font-semibold">
                  {healthScore?.suggestions_used_total || 0}
                  <span className="text-xs text-muted-foreground ml-1">
                    / {healthScore?.suggestions_available_total || 0}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <CopilotComparisonChart data={comparison} isLoading={comparisonLoading} />
          <MonthlyEvolutionChart data={evolution} isLoading={evolutionLoading} />
        </div>

        {/* KB Gaps + Insights Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <KBGapsByCategoryTable data={kbGaps} isLoading={kbGapsLoading} />
          <CopilotInsightsCard
            insights={insightsData?.insights}
            isLoading={insightsLoading}
            onRefresh={() => refetchInsights()}
            source={insightsData?.source}
            confidence={insightsData?.confidence}
          />
        </div>

        {/* Ethical Banner */}
        <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <BarChart3 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground mb-1">
                Dashboard de Impacto Operacional
              </p>
              <p>
                Este dashboard mostra métricas <strong>agregadas do sistema</strong>, não
                avaliação individual de agentes. Use para identificar oportunidades de melhoria
                de processos, treinamentos e cobertura da base de conhecimento.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
