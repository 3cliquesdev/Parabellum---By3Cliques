import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConversionStats } from "@/hooks/useConversionStats";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConversionRateWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

export function ConversionRateWidget({ startDate, endDate }: ConversionRateWidgetProps) {
  const { data: conversionData, isLoading } = useConversionStats(startDate, endDate);

  // Calcular métricas resumidas
  const avgConversionRate = conversionData && conversionData.length > 0
    ? (conversionData.reduce((sum, item) => sum + item.conversion_rate, 0) / conversionData.length).toFixed(1)
    : "0.0";

  const latestConversionRate = conversionData && conversionData.length > 0
    ? conversionData[conversionData.length - 1].conversion_rate.toFixed(1)
    : "0.0";

  const oldestConversionRate = conversionData && conversionData.length > 0
    ? conversionData[0].conversion_rate.toFixed(1)
    : "0.0";

  const trend = parseFloat(latestConversionRate) - parseFloat(oldestConversionRate);

  const getTrendIcon = () => {
    if (trend > 5) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend < -5) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendText = () => {
    if (trend > 5) return `+${trend.toFixed(1)}% vs. início`;
    if (trend < -5) return `${trend.toFixed(1)}% vs. início`;
    return "Estável";
  };

  const periodLabel = startDate && endDate
    ? `${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`
    : "Últimos 90 dias";

  // Formatar dados para o gráfico
  const chartData = conversionData?.map((item) => ({
    date: format(parseISO(item.date), "dd/MM", { locale: ptBR }),
    fullDate: format(parseISO(item.date), "dd/MM/yyyy", { locale: ptBR }),
    rate: item.conversion_rate,
    won: item.won_deals,
    lost: item.lost_deals,
    total: item.total_deals,
  })) || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Taxa de Conversão - Tendência</CardTitle>
          <CardDescription>{periodLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Taxa de Conversão - Tendência</span>
          <div className="flex items-center gap-2 text-sm font-normal">
            {getTrendIcon()}
            <span className="text-muted-foreground">{getTrendText()}</span>
          </div>
        </CardTitle>
        <CardDescription>
          {periodLabel} | Média: <span className="font-semibold text-foreground">{avgConversionRate}%</span> | 
          Atual: <span className="font-semibold text-foreground">{latestConversionRate}%</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">Nenhum dado disponível para o período selecionado</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
                        <p className="font-semibold text-foreground">{data.fullDate}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Taxa de Conversão: <span className="font-semibold text-primary">{data.rate.toFixed(1)}%</span>
                        </p>
                        <div className="mt-2 space-y-1 text-xs">
                          <p className="text-green-600">✓ Ganhos: {data.won}</p>
                          <p className="text-red-600">✗ Perdidos: {data.lost}</p>
                          <p className="text-muted-foreground">Total: {data.total}</p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line 
                type="monotone" 
                dataKey="rate" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
