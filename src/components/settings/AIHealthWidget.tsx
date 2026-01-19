import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, AlertTriangle, CheckCircle, Users, BookOpen, TrendingUp, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface KnowledgeStats {
  total: number;
  byCategory: Record<string, number>;
  avgLength: number;
}

interface ConversationStats {
  waitingHuman: number;
  autopilot: number;
  copilot: number;
}

export function AIHealthWidget() {
  const { data: knowledgeStats, isLoading: statsLoading, refetch } = useQuery({
    queryKey: ["ai-health-knowledge-stats"],
    queryFn: async (): Promise<KnowledgeStats> => {
      const { data, error } = await supabase
        .from("knowledge_articles")
        .select("id, category, content");

      if (error) throw error;

      const byCategory: Record<string, number> = {};
      let totalLength = 0;

      (data || []).forEach((article) => {
        const cat = article.category || "Sem Categoria";
        byCategory[cat] = (byCategory[cat] || 0) + 1;
        totalLength += (article.content?.length || 0);
      });

      return {
        total: data?.length || 0,
        byCategory,
        avgLength: data?.length ? Math.round(totalLength / data.length) : 0,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: conversationStats, isLoading: convLoading } = useQuery({
    queryKey: ["ai-health-conversation-stats"],
    queryFn: async (): Promise<ConversationStats> => {
      const { data, error } = await supabase
        .from("conversations")
        .select("ai_mode")
        .eq("status", "open");

      if (error) throw error;

      const stats = { waitingHuman: 0, autopilot: 0, copilot: 0 };
      (data || []).forEach((conv) => {
        if (conv.ai_mode === "waiting_human") stats.waitingHuman++;
        else if (conv.ai_mode === "autopilot") stats.autopilot++;
        else if (conv.ai_mode === "copilot") stats.copilot++;
      });

      return stats;
    },
    staleTime: 30 * 1000,
  });

  const { data: qualityLogs } = useQuery({
    queryKey: ["ai-health-quality-logs"],
    queryFn: async () => {
      const since = new Date();
      since.setHours(since.getHours() - 24);

      const { data, error } = await supabase
        .from("ai_quality_logs")
        .select("action_taken, confidence_score")
        .gte("created_at", since.toISOString());

      if (error) throw error;

      const handoffs = data?.filter(l => l.action_taken === "handoff").length || 0;
      const total = data?.length || 1;
      const handoffRate = Math.round((handoffs / total) * 100);
      const avgConfidence = data?.length
        ? Math.round((data.reduce((sum, l) => sum + (l.confidence_score || 0), 0) / data.length) * 100)
        : 0;

      return { handoffRate, avgConfidence, total };
    },
    staleTime: 60 * 1000,
  });

  const isLoading = statsLoading || convLoading;

  const getHealthStatus = () => {
    if (!knowledgeStats) return { status: "unknown", color: "bg-muted", text: "Carregando..." };
    
    if (knowledgeStats.total < 50) {
      return { status: "critical", color: "bg-red-500", text: "Crítico - Poucos artigos" };
    }
    if (knowledgeStats.total < 100) {
      return { status: "warning", color: "bg-yellow-500", text: "Atenção - Base limitada" };
    }
    return { status: "good", color: "bg-green-500", text: "Saudável" };
  };

  const health = getHealthStatus();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>Saúde da IA</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Status da base de conhecimento e conversas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Health Status */}
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${health.color}`} />
          <span className="font-medium">{health.text}</span>
          {health.status === "critical" && (
            <Badge variant="destructive" className="ml-auto">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Ação necessária
            </Badge>
          )}
          {health.status === "good" && (
            <Badge variant="outline" className="ml-auto text-green-600 border-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              OK
            </Badge>
          )}
        </div>

        {/* Knowledge Stats */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Base de Conhecimento</span>
            </div>
            <span className="text-2xl font-bold">{knowledgeStats?.total || 0}</span>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Cobertura</span>
              <span>{Math.min(100, Math.round((knowledgeStats?.total || 0) / 2))}%</span>
            </div>
            <Progress value={Math.min(100, Math.round((knowledgeStats?.total || 0) / 2))} className="h-2" />
            <p className="text-xs text-muted-foreground">Recomendado: 100-200 artigos</p>
          </div>
        </div>

        {/* Categories */}
        {knowledgeStats && Object.keys(knowledgeStats.byCategory).length > 0 && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Por Categoria:</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(knowledgeStats.byCategory)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([cat, count]) => (
                  <Badge key={cat} variant="secondary" className="text-xs">
                    {cat}: {count}
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {/* Conversation Stats */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Conversas Ativas</span>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
              <p className="text-lg font-bold text-green-700 dark:text-green-400">
                {conversationStats?.autopilot || 0}
              </p>
              <p className="text-xs text-green-600 dark:text-green-500">Autopilot</p>
            </div>
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
              <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                {conversationStats?.copilot || 0}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-500">Copilot</p>
            </div>
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20">
              <p className="text-lg font-bold text-orange-700 dark:text-orange-400">
                {conversationStats?.waitingHuman || 0}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-500">Aguardando</p>
            </div>
          </div>
        </div>

        {/* Quality Metrics (24h) */}
        {qualityLogs && qualityLogs.total > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Qualidade (24h)</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Taxa de Handoff:</span>
                <p className="font-medium">{qualityLogs.handoffRate}%</p>
              </div>
              <div>
                <span className="text-muted-foreground">Confiança Média:</span>
                <p className="font-medium">{qualityLogs.avgConfidence}%</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
