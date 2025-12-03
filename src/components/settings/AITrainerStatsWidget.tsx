import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, CheckCircle, FileEdit, Ban, Clock, RefreshCw, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface TrainerExecution {
  id: string;
  created_at: string;
  new_data: {
    articles_published: number;
    articles_as_draft: number;
    duplicates_skipped: number;
    low_confidence_skipped: number;
    success_conversations_processed: number;
    failure_corrections_processed: number;
    execution_time_ms: number;
    ai_model: string;
  };
}

export function AITrainerStatsWidget() {
  const [isRunning, setIsRunning] = useState(false);

  // Buscar últimas execuções do trainer
  const { data: executions, isLoading, refetch } = useQuery({
    queryKey: ["ai-trainer-executions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, created_at, new_data")
        .eq("action", "ai_auto_training")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as TrainerExecution[];
    },
  });

  // Buscar artigos pendentes de revisão
  const { data: pendingArticles } = useQuery({
    queryKey: ["pending-trainer-articles"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("knowledge_articles")
        .select("id", { count: "exact", head: true })
        .eq("is_published", false)
        .in("source", ["auto_mining_success", "auto_mining_failure_fix"]);

      if (error) throw error;
      return count || 0;
    },
  });

  // Executar trainer manualmente
  const handleManualRun = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-auto-trainer");
      
      if (error) throw error;
      
      toast.success(
        `Trainer executado: ${data.articles_published} publicados, ${data.articles_as_draft} rascunhos`
      );
      refetch();
    } catch (error) {
      toast.error("Erro ao executar trainer");
      console.error(error);
    } finally {
      setIsRunning(false);
    }
  };

  // Calcular totais das últimas execuções
  const totals = executions?.reduce(
    (acc, exec) => ({
      published: acc.published + (exec.new_data?.articles_published || 0),
      drafts: acc.drafts + (exec.new_data?.articles_as_draft || 0),
      duplicates: acc.duplicates + (exec.new_data?.duplicates_skipped || 0),
      conversations: acc.conversations + (exec.new_data?.success_conversations_processed || 0),
    }),
    { published: 0, drafts: 0, duplicates: 0, conversations: 0 }
  ) || { published: 0, drafts: 0, duplicates: 0, conversations: 0 };

  const lastExecution = executions?.[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Agente de Treinamento Autônomo</CardTitle>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualRun}
            disabled={isRunning}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? "animate-spin" : ""}`} />
            {isRunning ? "Executando..." : "Executar Agora"}
          </Button>
        </div>
        <CardDescription>
          Aprende automaticamente com atendimentos bem-sucedidos e correções de fallback
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
            <CheckCircle className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {totals.published}
            </p>
            <p className="text-xs text-muted-foreground">Auto-Publicados</p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
            <FileEdit className="h-5 w-5 text-amber-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {totals.drafts}
            </p>
            <p className="text-xs text-muted-foreground">Rascunhos</p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
            <Ban className="h-5 w-5 text-slate-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">
              {totals.duplicates}
            </p>
            <p className="text-xs text-muted-foreground">Duplicatas</p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
            <Clock className="h-5 w-5 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {totals.conversations}
            </p>
            <p className="text-xs text-muted-foreground">Processadas</p>
          </div>
        </div>

        {/* Pending Review Alert */}
        {pendingArticles && pendingArticles > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileEdit className="h-5 w-5 text-amber-600" />
                <span className="font-medium text-amber-800 dark:text-amber-300">
                  {pendingArticles} artigos aguardando revisão
                </span>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/knowledge?filter=draft">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Revisar
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Last Execution Info */}
        {lastExecution && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Última Execução</span>
              <Badge variant="outline">
                {format(new Date(lastExecution.created_at), "dd/MM HH:mm", { locale: ptBR })}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Modelo:</span>
                <span className="ml-2 font-mono text-xs">
                  {lastExecution.new_data?.ai_model || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Tempo:</span>
                <span className="ml-2">
                  {lastExecution.new_data?.execution_time_ms 
                    ? `${(lastExecution.new_data.execution_time_ms / 1000).toFixed(1)}s`
                    : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Sucessos:</span>
                <span className="ml-2">
                  {lastExecution.new_data?.success_conversations_processed || 0} conversas
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Correções:</span>
                <span className="ml-2">
                  {lastExecution.new_data?.failure_corrections_processed || 0} fallbacks
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Execution History */}
        {executions && executions.length > 1 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Histórico Recente</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {executions.slice(1, 6).map((exec) => (
                <div 
                  key={exec.id} 
                  className="flex items-center justify-between text-xs text-muted-foreground py-1"
                >
                  <span>
                    {format(new Date(exec.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-xs">
                      +{exec.new_data?.articles_published || 0} pub
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      +{exec.new_data?.articles_as_draft || 0} draft
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="text-center text-muted-foreground py-4">
            Carregando estatísticas...
          </div>
        )}

        {!isLoading && (!executions || executions.length === 0) && (
          <div className="text-center text-muted-foreground py-4">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma execução registrada ainda</p>
            <p className="text-xs">O trainer roda automaticamente a cada hora</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
