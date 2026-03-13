import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, Users } from "lucide-react";
import { useLTVStats } from "@/hooks/useLTVStats";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface LTVWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

export function LTVWidget({ startDate, endDate }: LTVWidgetProps) {
  const { data: stats, isLoading } = useLTVStats(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { name: "Clientes", value: stats?.ltvByStatus.customer || 0, color: "hsl(var(--chart-1))" },
    { name: "Qualificados", value: stats?.ltvByStatus.qualified || 0, color: "hsl(var(--chart-2))" },
    { name: "Leads", value: stats?.ltvByStatus.lead || 0, color: "hsl(var(--chart-3))" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Lifetime Value (LTV)</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* LTV Médio */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">LTV Médio por Cliente</p>
          <p className="text-4xl font-bold text-primary">
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(stats?.avgLTV || 0)}
          </p>
        </div>

        {/* Métricas Resumidas */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Total LTV</p>
            </div>
            <p className="text-xl font-semibold">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                notation: "compact",
              }).format(stats?.totalLTV || 0)}
            </p>
          </div>

          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Clientes</p>
            </div>
            <p className="text-xl font-semibold">{stats?.totalCustomers || 0}</p>
          </div>
        </div>

        {/* Gráfico de Barras: LTV por Status */}
        <div>
          <p className="text-sm text-muted-foreground mb-3 text-center">
            LTV por Status do Cliente
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis 
                dataKey="name" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickFormatter={(value) => 
                  new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    notation: "compact",
                  }).format(value)
                }
              />
              <Tooltip 
                formatter={(value: number) => 
                  new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(value)
                }
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
