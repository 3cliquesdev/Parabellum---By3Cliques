import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useYoYComparison } from "@/hooks/useYoYComparison";
import { TrendingUp, TrendingDown, DollarSign, Target, Award, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface YoYComparisonWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

export function YoYComparisonWidget({ startDate, endDate }: YoYComparisonWidgetProps) {
  const { data, isLoading, error } = useYoYComparison(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comparação Ano a Ano (YoY)</CardTitle>
          <CardDescription>Crescimento 2025 vs 2024</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comparação Ano a Ano (YoY)</CardTitle>
          <CardDescription>Erro ao carregar dados</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar os dados de comparação.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (growth < 0) {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return "text-green-500";
    if (growth < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  const metrics = [
    {
      label: "Receita Total",
      icon: DollarSign,
      value2025: formatCurrency(data.year2025.totalRevenue),
      value2024: formatCurrency(data.year2024.totalRevenue),
      growth: data.growth.revenueGrowth,
    },
    {
      label: "Taxa de Conversão",
      icon: Target,
      value2025: formatPercentage(data.year2025.conversionRate),
      value2024: formatPercentage(data.year2024.conversionRate),
      growth: data.growth.conversionGrowth,
    },
    {
      label: "Ticket Médio",
      icon: BarChart3,
      value2025: formatCurrency(data.year2025.avgDealValue),
      value2024: formatCurrency(data.year2024.avgDealValue),
      growth: data.growth.avgDealValueGrowth,
    },
    {
      label: "Negócios Ganhos",
      icon: Award,
      value2025: data.year2025.wonDeals.toString(),
      value2024: data.year2024.wonDeals.toString(),
      growth: data.growth.wonDealsGrowth,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparação Ano a Ano (YoY)</CardTitle>
        <CardDescription>
          Crescimento 2025 vs 2024 (baseline simulado)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{metric.label}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">2024:</span>
                    <span className="text-xs">{metric.value2024}</span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <span className="text-xs text-muted-foreground">2025:</span>
                    <span className="text-sm font-semibold">{metric.value2025}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getGrowthIcon(metric.growth)}
                <span className={`text-sm font-semibold ${getGrowthColor(metric.growth)}`}>
                  {metric.growth > 0 ? "+" : ""}{formatPercentage(metric.growth)}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
