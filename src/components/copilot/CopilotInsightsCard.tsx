import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Database,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CopilotInsight } from "@/hooks/useCopilotInsights";

interface CopilotInsightsCardProps {
  insights: CopilotInsight[] | undefined;
  isLoading?: boolean;
  onRefresh?: () => void;
  source?: "ai" | "cache" | "fallback";
  confidence?: "alta" | "média";
}

export function CopilotInsightsCard({ 
  insights, 
  isLoading, 
  onRefresh, 
  source,
  confidence 
}: CopilotInsightsCardProps) {
  const getInsightIcon = (type: CopilotInsight["type"]) => {
    switch (type) {
      case "positive":
        return <TrendingUp className="h-4 w-4 text-chart-2" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-chart-4" />;
      case "opportunity":
        return <Lightbulb className="h-4 w-4 text-chart-1" />;
    }
  };

  const getInsightBadgeVariant = (type: CopilotInsight["type"]) => {
    switch (type) {
      case "positive":
        return "default" as const;
      case "warning":
        return "destructive" as const;
      case "opportunity":
        return "secondary" as const;
    }
  };

  const getInsightBadgeLabel = (type: CopilotInsight["type"]) => {
    switch (type) {
      case "positive":
        return "Positivo";
      case "warning":
        return "Atenção";
      case "opportunity":
        return "Oportunidade";
    }
  };

  const getSourceBadge = () => {
    switch (source) {
      case "ai":
        return (
          <Badge variant="outline" className="text-xs gap-1">
            <Sparkles className="h-3 w-3" />
            IA
          </Badge>
        );
      case "cache":
        return (
          <Badge variant="outline" className="text-xs gap-1">
            <Database className="h-3 w-3" />
            Cache
          </Badge>
        );
      case "fallback":
        return (
          <Badge variant="secondary" className="text-xs">
            Fallback
          </Badge>
        );
      default:
        return null;
    }
  };

  const getConfidenceBadge = (insightConfidence?: "alta" | "média") => {
    const conf = insightConfidence || confidence;
    if (!conf) return null;

    if (conf === "alta") {
      return (
        <Badge variant="outline" className="text-xs gap-1 border-chart-2/50 text-chart-2">
          <ShieldCheck className="h-3 w-3" />
          Confiança Alta
        </Badge>
      );
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-xs gap-1 border-chart-4/50 text-chart-4">
              <ShieldAlert className="h-3 w-3" />
              Confiança Média
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">
              Baseado em volume limitado de dados. Aguarde mais conversas para maior precisão.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <Sparkles className="h-5 w-5 text-primary" />
            Insights Acionáveis
            {getSourceBadge()}
            {confidence && getConfidenceBadge()}
          </CardTitle>
          <CardDescription>
            Padrões identificados para melhorar a operação
          </CardDescription>
        </div>
        {onRefresh && (
          <Button variant="ghost" size="icon" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 border rounded-lg">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : !insights?.length ? (
          <div className="py-8 text-center">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-1">Nenhum insight disponível</h3>
            <p className="text-sm text-muted-foreground">
              Insights serão gerados conforme os dados forem acumulados
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {insights.map((insight, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getInsightIcon(insight.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium truncate">{insight.title}</span>
                      <Badge variant={getInsightBadgeVariant(insight.type)} className="text-xs">
                        {getInsightBadgeLabel(insight.type)}
                      </Badge>
                      {insight.confidence && getConfidenceBadge(insight.confidence)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {insight.description}
                    </p>
                    <p className="text-sm text-primary font-medium">
                      💡 {insight.action}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ethical banner */}
        <div className="mt-6 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <span>
            <strong>Nota ética:</strong> Estes insights focam em padrões do sistema, não em
            avaliação individual. Use para melhorar processos e treinamentos.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
