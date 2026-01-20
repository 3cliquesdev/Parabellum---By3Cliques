import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, Cell } from "recharts";
import { RefreshCw } from "lucide-react";
import { KiwifyCompleteMetrics } from "@/hooks/useKiwifyCompleteMetrics";

interface NewVsRecurringChartProps {
  data?: KiwifyCompleteMetrics;
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

  const chartData = [
    {
      name: "Novas",
      value: data?.vendasNovas || 0,
      fill: "hsl(var(--chart-1))",
    },
    {
      name: "Renovações",
      value: data?.renovacoes || 0,
      fill: "hsl(var(--chart-2))",
    },
  ];

  const total = (data?.vendasNovas || 0) + (data?.renovacoes || 0);

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
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={100}
                tick={{ fontSize: 14, fill: "hsl(var(--foreground))" }}
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
          
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{data?.vendasNovas || 0}</p>
              <p className="text-xs text-muted-foreground">
                {total > 0 ? ((data?.vendasNovas || 0) / total * 100).toFixed(1) : 0}% Novas
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-chart-2">{data?.renovacoes || 0}</p>
              <p className="text-xs text-muted-foreground">
                {total > 0 ? ((data?.renovacoes || 0) / total * 100).toFixed(1) : 0}% Renovações
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
