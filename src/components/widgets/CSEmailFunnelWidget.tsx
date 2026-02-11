import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCSOnboardingEmailFunnel } from "@/hooks/useCSOnboardingEmailFunnel";
import { Mail, Loader2, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CSEmailFunnelWidgetProps {
  startDate: Date;
  endDate: Date;
}

const STAGES = [
  { key: "totalSales", label: "Vendas Novas", color: "hsl(221, 83%, 53%)" },
  { key: "firstEmailDelivered", label: "1º Email Entregue", color: "hsl(142, 76%, 36%)" },
  { key: "secondEmailOpened", label: "2º Email Aberto", color: "hsl(25, 95%, 53%)" },
] as const;

export function CSEmailFunnelWidget({ startDate, endDate }: CSEmailFunnelWidgetProps) {
  const { data, isLoading } = useCSOnboardingEmailFunnel(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Funil Vendas x Emails de Onboarding
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const values = [data.totalSales, data.firstEmailDelivered, data.secondEmailOpened];
  const rates = [100, data.firstEmailDeliveredRate, data.secondEmailOpenedRate];
  const maxCount = data.totalSales || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Funil Vendas x Emails de Onboarding
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Conversão entre vendas novas e engajamento com emails do playbook
        </p>
      </CardHeader>
      <CardContent>
        {data.totalSales === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma venda nova neste período</p>
          </div>
        ) : (
          <div className="space-y-6">
            {STAGES.map((stage, index) => {
              const count = values[index];
              const widthPercentage = (count / maxCount) * 100;
              const dropOff = index > 0 ? values[index - 1] - count : 0;
              const dropOffRate = index > 0 && values[index - 1] > 0
                ? (dropOff / values[index - 1]) * 100
                : 0;

              return (
                <div key={stage.key} className="space-y-2">
                  {/* Stage Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="font-medium">{stage.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{count}</Badge>
                      <Badge variant="outline">{rates[index].toFixed(1)}%</Badge>
                    </div>
                  </div>

                  {/* Funnel Bar */}
                  <div className="relative">
                    <div
                      className="h-12 rounded-lg transition-all duration-500 flex items-center justify-center text-white font-bold shadow-lg"
                      style={{
                        width: `${Math.max(widthPercentage, 8)}%`,
                        backgroundColor: stage.color,
                        minWidth: "60px",
                      }}
                    >
                      {count}
                    </div>
                  </div>

                  {/* Drop-off Indicator */}
                  {index > 0 && dropOff > 0 && (
                    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 pl-2">
                      <TrendingDown className="h-4 w-4" />
                      <span>
                        <strong>{dropOff}</strong> não atingiram ({dropOffRate.toFixed(1)}% drop-off)
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Final Stats */}
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {data.firstEmailDeliveredRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">Taxa de Entrega (1º Email)</p>
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: "hsl(25, 95%, 53%)" }}>
                    {data.secondEmailOpenedRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">Taxa de Abertura (2º Email)</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
