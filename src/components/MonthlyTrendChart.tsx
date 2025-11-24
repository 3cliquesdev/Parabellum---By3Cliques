import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonthlyTrend } from "@/hooks/useMonthlyTrend";
import { TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface MonthlyTrendChartProps {
  year: number;
}

export function MonthlyTrendChart({ year }: MonthlyTrendChartProps) {
  const { data: trendData, isLoading } = useMonthlyTrend(year, 6);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Tendência Mensal
          </CardTitle>
          <CardDescription>Carregando gráfico...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!trendData || trendData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Tendência Mensal
          </CardTitle>
          <CardDescription>Evolução das metas nos últimos 6 meses</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Sem dados de tendência disponíveis.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate average achievement rate
  const avgAchievementRate = trendData.reduce((sum, data) => sum + data.achievementRate, 0) / trendData.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Tendência Mensal
        </CardTitle>
        <CardDescription>
          Evolução das metas nos últimos 6 meses • Taxa média: {avgAchievementRate.toFixed(0)}%
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="month" 
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                padding: '12px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold', marginBottom: '8px' }}
              formatter={(value: number, name: string) => {
                if (name === "Taxa de Conquista") return [`${value}%`, name];
                return [formatCurrency(value), name];
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            <Line 
              type="monotone" 
              dataKey="totalGoalsValue" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Meta Total"
              dot={{ fill: 'hsl(var(--primary))', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="totalAchievedValue" 
              stroke="hsl(var(--chart-2))" 
              strokeWidth={2}
              name="Valor Conquistado"
              dot={{ fill: 'hsl(var(--chart-2))', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="achievementRate" 
              stroke="hsl(var(--chart-3))" 
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Taxa de Conquista (%)"
              dot={{ fill: 'hsl(var(--chart-3))', r: 4 }}
              activeDot={{ r: 6 }}
              yAxisId={0}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Meses com Metas</p>
            <p className="text-2xl font-bold">{trendData.filter(d => d.goalsCount > 0).length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Melhor Mês</p>
            <p className="text-2xl font-bold">
              {trendData.reduce((max, d) => d.achievementRate > max.achievementRate ? d : max).month}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Conquistado</p>
            <p className="text-2xl font-bold">
              {formatCurrency(trendData.reduce((sum, d) => sum + d.totalAchievedValue, 0))}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
