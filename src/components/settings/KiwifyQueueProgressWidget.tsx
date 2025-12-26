import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, Users, Clock, AlertTriangle, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KiwifyQueueProgressWidgetProps {
  jobId: string | null;
}

interface QueueItem {
  id: string;
  status: string;
  window_start: string;
  window_end: string;
  contacts_created: number;
  contacts_updated: number;
  contacts_skipped: number;
  sales_fetched: number;
  last_error?: string;
}

export default function KiwifyQueueProgressWidget({ jobId }: KiwifyQueueProgressWidgetProps) {
  // Buscar job
  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ["kiwify-import-job", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const { data, error } = await supabase
        .from("sync_jobs")
        .select("*")
        .eq("id", jobId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
    refetchInterval: 5000, // Atualizar a cada 5 segundos
  });

  // Buscar items da fila
  const { data: queueItems, isLoading: queueLoading } = useQuery({
    queryKey: ["kiwify-import-queue", jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from("kiwify_import_queue")
        .select("*")
        .eq("job_id", jobId)
        .order("window_end", { ascending: false });
      if (error) throw error;
      return (data || []) as QueueItem[];
    },
    enabled: !!jobId,
    refetchInterval: 5000,
  });

  if (!jobId || jobLoading || queueLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Carregando status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!job) return null;

  const completed = queueItems?.filter(q => q.status === 'completed').length || 0;
  const failed = queueItems?.filter(q => q.status === 'failed').length || 0;
  const processing = queueItems?.filter(q => q.status === 'processing').length || 0;
  const pending = queueItems?.filter(q => q.status === 'pending').length || 0;
  const total = queueItems?.length || 0;

  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const totalCreated = queueItems?.reduce((sum, q) => sum + (q.contacts_created || 0), 0) || 0;
  const totalUpdated = queueItems?.reduce((sum, q) => sum + (q.contacts_updated || 0), 0) || 0;
  const totalSales = queueItems?.reduce((sum, q) => sum + (q.sales_fetched || 0), 0) || 0;

  const isRunning = job.status === 'running' && (pending > 0 || processing > 0);
  const isCompleted = job.status === 'completed' || job.status === 'completed_with_errors';
  const isFailed = job.status === 'failed';

  const currentProcessing = queueItems?.find(q => q.status === 'processing');

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          {isRunning && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          {isCompleted && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          {isFailed && <XCircle className="h-5 w-5 text-rose-600" />}
          
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">
              {isRunning && "🔄 Importando Contatos Kiwify"}
              {isCompleted && job.status === 'completed_with_errors' ? "⚠️ Importação Concluída com Erros" : isCompleted && "✅ Importação Concluída"}
              {isFailed && "❌ Importação Falhou"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Janela {completed}/{total} processada
              {processing > 0 && " • 1 em processamento"}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {total > 0 && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">{progress}%</p>
          </div>
        )}

        {/* Current Window */}
        {currentProcessing && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
            <Calendar className="h-4 w-4 text-blue-600" />
            <p className="text-sm text-blue-900 dark:text-blue-100">
              📅 Processando: {format(new Date(currentProcessing.window_start), "dd/MM/yy", { locale: ptBR })} - {format(new Date(currentProcessing.window_end), "dd/MM/yy", { locale: ptBR })}
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Users className="h-4 w-4 text-emerald-600" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Contatos criados</p>
              <p className="text-sm font-semibold text-foreground">{totalCreated}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Users className="h-4 w-4 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Contatos atualizados</p>
              <p className="text-sm font-semibold text-foreground">{totalUpdated}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Vendas processadas</p>
              <p className="text-sm font-semibold text-foreground">{totalSales}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Janelas restantes</p>
              <p className="text-sm font-semibold text-foreground">{pending + processing}</p>
            </div>
          </div>
        </div>

        {/* Errors */}
        {failed > 0 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-900 dark:text-amber-100">
                ⚠️ {failed} janela(s) falharam após todas as tentativas
              </p>
            </div>
          </div>
        )}

        {/* Estimated Time */}
        {isRunning && pending > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              ⏱️ O CRON processa 1 janela a cada 2 minutos. Estimativa: ~{(pending + processing) * 2} min
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
