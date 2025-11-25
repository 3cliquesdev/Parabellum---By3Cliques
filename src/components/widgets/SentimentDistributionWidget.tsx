import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAIMetrics } from "@/hooks/useAIMetrics";
import { TrendingUp, Angry, Meh, Smile, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SentimentDistributionWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

export function SentimentDistributionWidget({ startDate, endDate }: SentimentDistributionWidgetProps) {
  const { data: metrics, isLoading } = useAIMetrics(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Distribuição de Sentimentos
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const sentimentMetric = metrics?.find(m => m.feature_type === 'sentiment');
  const sentiments = sentimentMetric?.sentiment_breakdown || {};

  const critico = Number(sentiments.critico || 0);
  const neutro = Number(sentiments.neutro || 0);
  const promotor = Number(sentiments.promotor || 0);
  const total = critico + neutro + promotor;

  const criticoPercent = total > 0 ? (critico / total) * 100 : 0;
  const neutroPercent = total > 0 ? (neutro / total) * 100 : 0;
  const promotorPercent = total > 0 ? (promotor / total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Distribuição de Sentimentos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum sentimento analisado neste período</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Total */}
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Total Analisado</p>
              <p className="text-4xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground mt-1">conversas avaliadas</p>
            </div>

            {/* Crítico */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Angry className="h-5 w-5 text-destructive" />
                  <span className="font-medium">Crítico</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {critico} ({criticoPercent.toFixed(0)}%)
                </span>
              </div>
              <Progress value={criticoPercent} className="h-2 bg-destructive/20" />
            </div>

            {/* Neutro */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Meh className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Neutro</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {neutro} ({neutroPercent.toFixed(0)}%)
                </span>
              </div>
              <Progress value={neutroPercent} className="h-2 bg-muted" />
            </div>

            {/* Promotor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smile className="h-5 w-5 text-green-500" />
                  <span className="font-medium">Promotor</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {promotor} ({promotorPercent.toFixed(0)}%)
                </span>
              </div>
              <Progress value={promotorPercent} className="h-2 bg-green-500/20" />
            </div>

            {/* Health Indicator */}
            {criticoPercent > 30 && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive font-medium flex items-center gap-2">
                  <Angry className="h-4 w-4" />
                  Atenção: Alto índice de clientes críticos
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Considere revisar processos de atendimento
                </p>
              </div>
            )}

            {promotorPercent > 60 && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-600 font-medium flex items-center gap-2">
                  <Smile className="h-4 w-4" />
                  Excelente: Maioria de clientes satisfeitos
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Continue com o bom trabalho!
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
