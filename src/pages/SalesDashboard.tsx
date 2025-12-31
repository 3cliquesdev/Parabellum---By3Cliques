import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSalesManagerKPIs } from "@/hooks/useSalesManagerKPIs";
import { useSalesLeaderboard } from "@/hooks/useSalesLeaderboard";
import { MonthlyWonDealsChart } from "@/components/widgets/MonthlyWonDealsChart";
import { StageConversionChart } from "@/components/widgets/StageConversionChart";
import { SalesLeaderboard } from "@/components/widgets/SalesLeaderboard";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  DollarSign, 
  Target, 
  Flame,
  BarChart3
} from "lucide-react";

export default function SalesDashboard() {
  const { data: kpis, isLoading: kpisLoading } = useSalesManagerKPIs();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const kpiCards = [
    {
      title: "Pipeline Total",
      value: formatCurrency(kpis?.pipelineTotal || 0),
      icon: DollarSign,
      description: "Valor em aberto",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Vendas do Mês",
      value: formatCurrency(kpis?.revenueWonThisMonth || 0),
      icon: TrendingUp,
      description: `${kpis?.dealsWonThisMonth || 0} negócio(s)`,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Taxa de Conversão",
      value: `${(kpis?.conversionRate || 0).toFixed(1)}%`,
      icon: Target,
      description: "Este mês",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Hot Deals",
      value: kpis?.hotDealsCount?.toString() || "0",
      icon: Flame,
      description: "Fechamento em 7 dias",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Dashboard de Métricas de Vendas
            </h1>
            <p className="text-muted-foreground">
              Visão analítica da performance comercial
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, index) => (
          <Card key={index} className="relative overflow-hidden">
            <CardContent className="p-4">
              {kpisLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{kpi.title}</p>
                    <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.description}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                    <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyWonDealsChart />
        <StageConversionChart />
      </div>

      {/* Sales Ranking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Ranking de Vendedores</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesLeaderboard />
        </CardContent>
      </Card>
    </div>
  );
}
