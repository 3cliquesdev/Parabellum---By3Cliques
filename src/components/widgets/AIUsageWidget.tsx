import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAIMetrics } from "@/hooks/useAIMetrics";
import { Sparkles, TrendingUp, MessageSquare, Tag, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AIUsageWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

const featureLabels: Record<string, string> = {
  summary: "Resumos AI",
  sentiment: "Análise de Sentimento",
  reply: "Respostas Sugeridas",
  tags: "Tags Automáticas",
};

const featureIcons: Record<string, any> = {
  summary: MessageSquare,
  sentiment: TrendingUp,
  reply: Sparkles,
  tags: Tag,
};

export function AIUsageWidget({ startDate, endDate }: AIUsageWidgetProps) {
  const { data: metrics, isLoading } = useAIMetrics(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Uso de AI
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const totalUsage = metrics?.reduce((sum, m) => sum + Number(m.usage_count), 0) || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Uso de AI
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Total Usage */}
          <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Total de Operações</p>
              <p className="text-3xl font-bold text-primary">{totalUsage}</p>
            </div>
            <Sparkles className="h-12 w-12 text-primary/50" />
          </div>

          {/* Feature Breakdown */}
          <div className="space-y-2">
            {metrics?.map((metric) => {
              const Icon = featureIcons[metric.feature_type] || Sparkles;
              return (
                <div
                  key={metric.feature_type}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{featureLabels[metric.feature_type]}</p>
                      <p className="text-xs text-muted-foreground">
                        {metric.unique_users} usuário(s)
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-lg font-bold">
                    {metric.usage_count}
                  </Badge>
                </div>
              );
            })}
          </div>

          {metrics?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum uso de AI registrado neste período</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
