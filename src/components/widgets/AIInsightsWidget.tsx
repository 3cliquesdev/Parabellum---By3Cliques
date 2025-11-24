import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAIInsights } from "@/hooks/useAIInsights";
import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AIInsightsWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

export function AIInsightsWidget({ startDate, endDate }: AIInsightsWidgetProps) {
  const { data, isLoading, refetch, isFetching } = useAIInsights(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Insights de IA
          </CardTitle>
          <CardDescription>Análise automática da performance de vendas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <p>Gerando insights...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Insights de IA
          </CardTitle>
          <CardDescription>Análise automática da performance de vendas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Erro ao gerar insights</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const timeAgo = formatDistanceToNow(new Date(data.generatedAt), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Insights de IA
            </CardTitle>
            <CardDescription>
              Análise gerada {timeAgo}
            </CardDescription>
          </div>
          <Button
            onClick={() => refetch()}
            variant="ghost"
            size="sm"
            disabled={isFetching}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="rounded-lg bg-card p-4 border border-border">
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
              {data.insights}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="rounded-md bg-card/50 p-2 border border-border/50">
              <p className="text-muted-foreground">Taxa de Conversão</p>
              <p className="font-semibold text-foreground">{data.metrics.conversionRate.toFixed(1)}%</p>
            </div>
            <div className="rounded-md bg-card/50 p-2 border border-border/50">
              <p className="text-muted-foreground">Ticket Médio</p>
              <p className="font-semibold text-foreground">
                R$ {data.metrics.avgDealValue.toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="rounded-md bg-card/50 p-2 border border-border/50">
              <p className="text-muted-foreground">Em Aberto</p>
              <p className="font-semibold text-foreground">{data.metrics.openDeals}</p>
            </div>
            <div className="rounded-md bg-card/50 p-2 border border-border/50">
              <p className="text-muted-foreground">Tendência (30d)</p>
              <p className={`font-semibold ${
                data.metrics.recentConversionTrend > 0 
                  ? 'text-green-600' 
                  : data.metrics.recentConversionTrend < 0 
                  ? 'text-red-600' 
                  : 'text-muted-foreground'
              }`}>
                {data.metrics.recentConversionTrend > 0 ? '+' : ''}
                {data.metrics.recentConversionTrend.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
