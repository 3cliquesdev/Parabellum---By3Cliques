import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { RefreshCw } from "lucide-react";
import { SubscriptionMetrics } from "@/hooks/useKiwifySubscriptions";

interface NewVsRecurringChartProps {
  data?: SubscriptionMetrics;
  isLoading: boolean;
}

export function NewVsRecurringChart({ data, isLoading }: NewVsRecurringChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Usando dados do useKiwifySubscriptions (mesma fonte do menu /subscriptions)
  // novasAssinaturas = charges.completed.length === 1
  // renovacoes = charges.completed.length > 1
  // produtosUnicos = sem subscription plan
  const chartData = [
    {
      name: "Novas Assinaturas",
      value: data?.novasAssinaturas || 0,
      fill: "hsl(var(--chart-1))",
    },
    {
      name: "Renovações",
      value: data?.renovacoes || 0,
      fill: "hsl(var(--chart-2))",
    },
    {
      name: "Produtos Únicos",
      value: data?.produtosUnicos || 0,
      fill: "hsl(var(--chart-3))",
    },
  ];

  const total = (data?.novasAssinaturas || 0) + (data?.renovacoes || 0) + (data?.produtosUnicos || 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          Novas vs Renovações
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={120}
                tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
              />
              <Tooltip
                formatter={(value: number) => [value, "Quantidade"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          
          <div className="grid grid-cols-3 gap-3 pt-2 border-t">
            <div className="text-center">
              <p className="text-xl font-bold text-primary">{data?.novasAssinaturas || 0}</p>
              <p className="text-xs text-muted-foreground">
                {total > 0 ? ((data?.novasAssinaturas || 0) / total * 100).toFixed(1) : 0}% Novas
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-chart-2">{data?.renovacoes || 0}</p>
              <p className="text-xs text-muted-foreground">
                {total > 0 ? ((data?.renovacoes || 0) / total * 100).toFixed(1) : 0}% Renovações
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-chart-3">{data?.produtosUnicos || 0}</p>
              <p className="text-xs text-muted-foreground">
                {total > 0 ? ((data?.produtosUnicos || 0) / total * 100).toFixed(1) : 0}% Únicos
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
