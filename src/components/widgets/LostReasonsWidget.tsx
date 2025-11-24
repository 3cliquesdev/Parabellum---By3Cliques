import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle } from "lucide-react";
import { useLostReasonsStats } from "@/hooks/useLostReasonsStats";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export default function LostReasonsWidget() {
  const { data: lostReasons, isLoading } = useLostReasonsStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Análise de Perdas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!lostReasons || lostReasons.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Análise de Perdas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum negócio perdido registrado
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = lostReasons.map((item) => ({
    reason: item.reason.length > 20 ? item.reason.substring(0, 20) + "..." : item.reason,
    count: item.count,
    value: item.totalValue,
  }));

  const top3 = lostReasons.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-destructive" />
          Análise de Perdas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {top3.map((reason, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-border bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Top {idx + 1}</p>
                <p className="text-sm font-medium truncate" title={reason.reason}>
                  {reason.reason}
                </p>
                <p className="text-lg font-bold text-destructive">{reason.count}</p>
                <p className="text-xs text-muted-foreground">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(reason.totalValue)}
                </p>
              </div>
            ))}
          </div>

          <ChartContainer
            config={{
              count: {
                label: "Quantidade",
                color: "hsl(var(--destructive))",
              },
            }}
            className="h-[200px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="reason"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(var(--destructive))" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
