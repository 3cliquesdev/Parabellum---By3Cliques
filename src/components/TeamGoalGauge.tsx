import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { RadialBarChart, RadialBar, ResponsiveContainer, Legend } from "recharts";

interface TeamGoalGaugeProps {
  targetValue: number;
  currentValue: number;
  percentage: number;
  isLoading?: boolean;
}

export function TeamGoalGauge({ targetValue, currentValue, percentage, isLoading }: TeamGoalGaugeProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Calculate days remaining in month
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysRemaining = Math.max(0, lastDay.getDate() - today.getDate());
  const totalDaysInMonth = lastDay.getDate();
  const daysElapsed = totalDaysInMonth - daysRemaining;
  const expectedPercentage = (daysElapsed / totalDaysInMonth) * 100;

  // Pacing status
  const isPacingAhead = percentage > expectedPercentage;
  const pacingDifference = Math.abs(percentage - expectedPercentage);

  // Chart data
  const chartData = [
    {
      name: "Meta da Equipe",
      value: Math.min(percentage, 100),
      fill: percentage >= 100 ? "hsl(142.1 76.2% 36.3%)" : percentage >= 75 ? "hsl(221.2 83.2% 53.3%)" : "hsl(0 72.2% 50.6%)",
    },
  ];

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-96 w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
          <Target className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Meta da Equipe</h2>
          <p className="text-sm text-muted-foreground">Progresso agregado de todos os liderados</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gauge Chart */}
        <div className="flex flex-col items-center justify-center">
          <ResponsiveContainer width="100%" height={240}>
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="70%"
              outerRadius="90%"
              barSize={20}
              data={chartData}
              startAngle={90}
              endAngle={-270}
            >
              <RadialBar
                dataKey="value"
                cornerRadius={10}
                background={{ fill: "hsl(var(--muted))" }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center mt-12">
            <div className="text-5xl font-bold text-foreground">{percentage.toFixed(0)}%</div>
            <div className="text-sm text-muted-foreground mt-1">da meta atingida</div>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-4">
          {/* Meta Definida */}
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Meta Definida</span>
              <Target className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(targetValue)}</div>
          </div>

          {/* Valor Realizado */}
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Realizado</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(currentValue)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Faltam {formatCurrency(Math.max(0, targetValue - currentValue))} para bater
            </div>
          </div>

          {/* Pacing Indicator */}
          <div className={`p-4 rounded-lg ${isPacingAhead ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-rose-50 dark:bg-rose-950/20'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Ritmo de Execução</span>
              {isPacingAhead ? (
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-600" />
              )}
            </div>
            <div className={`text-lg font-bold ${isPacingAhead ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
              {isPacingAhead ? "Acima do esperado" : "Abaixo do esperado"}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {pacingDifference.toFixed(1)}% {isPacingAhead ? "à frente" : "atrasado"} • {daysRemaining} dias restantes
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
