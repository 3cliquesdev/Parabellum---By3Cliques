import { useSyncJob } from "@/hooks/useSyncJob";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, Users, Key, Briefcase, Clock, AlertTriangle, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SyncProgressWidgetProps {
  jobId: string | null;
}

export default function SyncProgressWidget({ jobId }: SyncProgressWidgetProps) {
  const { job, isLoading } = useSyncJob(jobId);

  if (!jobId || isLoading) {
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

  const progress = job.total_items
    ? Math.round((job.processed_items / job.total_items) * 100)
    : 0;

  const isRunning = job.status === 'running';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';

  const estimatedTimeLeft = () => {
    if (!job.started_at || !job.total_items || job.processed_items === 0) return null;
    
    const elapsed = new Date().getTime() - new Date(job.started_at).getTime();
    const avgTimePerItem = elapsed / job.processed_items;
    const remaining = (job.total_items - job.processed_items) * avgTimePerItem;
    const minutes = Math.ceil(remaining / 60000);
    
    return minutes > 0 ? `~${minutes} min` : "< 1 min";
  };

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
              {isRunning && "🔄 Importando Vendas Kiwify"}
              {isCompleted && "✅ Sincronização Concluída"}
              {isFailed && "❌ Sincronização Falhou"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {job.total_items ? `${job.processed_items} / ${job.total_items} vendas processadas` : 'Processando...'}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {isRunning && job.total_items && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">{progress}%</p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Users className="h-4 w-4 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Contatos criados</p>
              <p className="text-sm font-semibold text-foreground">{job.contacts_created}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Contatos atualizados</p>
              <p className="text-sm font-semibold text-foreground">{job.updated_items}</p>
            </div>
          </div>

          {job.auth_users_created > 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Key className="h-4 w-4 text-emerald-600" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Acessos criados</p>
                <p className="text-sm font-semibold text-foreground">{job.auth_users_created}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Briefcase className="h-4 w-4 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Deals criados</p>
              <p className="text-sm font-semibold text-foreground">{job.deals_created}</p>
            </div>
          </div>

          {(job.customers_churned ?? 0) > 0 && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/20 rounded-lg border border-rose-200 dark:border-rose-900">
              <XCircle className="h-4 w-4 text-rose-600" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-rose-900 dark:text-rose-100">Inadimplentes</p>
                <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">{job.customers_churned}</p>
              </div>
            </div>
          )}

          {(job.tags_added ?? 0) > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
              <Tag className="h-4 w-4 text-amber-600" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-amber-900 dark:text-amber-100">Tags adicionadas</p>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{job.tags_added}</p>
              </div>
            </div>
          )}
        </div>

        {/* Estimated Time */}
        {isRunning && estimatedTimeLeft() && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
            <Clock className="h-4 w-4 text-blue-600" />
            <p className="text-sm text-blue-900 dark:text-blue-100">
              ⏱️ Tempo estimado: {estimatedTimeLeft()}
            </p>
          </div>
        )}

        {/* Errors */}
        {job.errors && Array.isArray(job.errors) && job.errors.length > 0 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              ⚠️ {job.errors.length} erro(s) durante processamento
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}