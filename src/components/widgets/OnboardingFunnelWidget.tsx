import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOnboardingFunnel } from "@/hooks/useOnboardingFunnel";
import { Rocket, Loader2, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OnboardingFunnelWidgetProps {
  startDate: Date;
  endDate: Date;
}

const STAGE_COLORS = [
  'hsl(221, 83%, 53%)', // Blue
  'hsl(142, 76%, 36%)', // Green
  'hsl(48, 96%, 53%)', // Yellow
  'hsl(25, 95%, 53%)', // Orange
];

export function OnboardingFunnelWidget({ startDate, endDate }: OnboardingFunnelWidgetProps) {
  const { data: funnel, isLoading } = useOnboardingFunnel(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Funil de Onboarding
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const maxCount = funnel?.[0]?.count || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          Funil de Retenção - Onboarding
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Jornada do cliente desde a compra até conclusão do onboarding
        </p>
      </CardHeader>
      <CardContent>
        {funnel?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Rocket className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum dado de onboarding neste período</p>
          </div>
        ) : (
          <div className="space-y-6">
            {funnel?.map((stage, index) => {
              const widthPercentage = (stage.count / maxCount) * 100;
              const dropOffPercentage = stage.drop_off && index > 0 
                ? ((stage.drop_off / funnel[index - 1].count) * 100)
                : 0;

              return (
                <div key={stage.stage} className="space-y-2">
                  {/* Stage Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: STAGE_COLORS[index] }}
                      />
                      <span className="font-medium">{stage.stage}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {stage.count} clientes
                      </Badge>
                      <Badge variant="outline">
                        {stage.percentage.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>

                  {/* Funnel Bar */}
                  <div className="relative">
                    <div 
                      className="h-12 rounded-lg transition-all duration-500 flex items-center justify-center text-white font-bold shadow-lg"
                      style={{ 
                        width: `${widthPercentage}%`,
                        backgroundColor: STAGE_COLORS[index],
                        minWidth: '60px'
                      }}
                    >
                      {stage.count}
                    </div>
                  </div>

                  {/* Drop-off Indicator */}
                  {stage.drop_off !== undefined && stage.drop_off > 0 && (
                    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 pl-2">
                      <TrendingDown className="h-4 w-4" />
                      <span>
                        <strong>{stage.drop_off}</strong> desistiram ({dropOffPercentage.toFixed(1)}% de drop-off)
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Final Stats */}
            {funnel && funnel.length > 0 && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {funnel[funnel.length - 1].percentage.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">Taxa de Conclusão</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {(100 - funnel[funnel.length - 1].percentage).toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">Taxa de Desistência</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
