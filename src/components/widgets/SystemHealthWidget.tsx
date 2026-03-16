import { Activity, AlertTriangle, CheckCircle, XCircle, Server } from "lucide-react";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG = {
  green: { icon: CheckCircle, label: 'Saudável', color: 'text-green-500', bg: 'bg-green-500/10' },
  yellow: { icon: AlertTriangle, label: 'Atenção', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  red: { icon: XCircle, label: 'Crítico', color: 'text-red-500', bg: 'bg-red-500/10' },
};

const TYPE_LABELS: Record<string, string> = {
  runtime: 'Runtime',
  network: 'Rede',
  edge_function: 'Edge Functions',
  chunk: 'Chunk/Build',
  unhandled_rejection: 'Promessas',
};

export function SystemHealthWidget() {
  const { data, isLoading } = useSystemHealth();

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!data) return null;

  const statusConfig = STATUS_CONFIG[data.healthStatus];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Saúde do Sistema</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${statusConfig.bg}`}>
          <StatusIcon className={`h-3.5 w-3.5 ${statusConfig.color}`} />
          <span className={`text-xs font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <p className="text-lg font-bold text-foreground">{data.totalErrors24h}</p>
          <p className="text-[10px] text-muted-foreground">Erros 24h</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <p className="text-lg font-bold text-foreground">{data.errorsPerHour}</p>
          <p className="text-[10px] text-muted-foreground">Erros/hora</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <p className="text-lg font-bold text-foreground">{data.edgeFunctionFailures.length}</p>
          <p className="text-[10px] text-muted-foreground">EF com falha</p>
        </div>
      </div>

      {/* Errors by Type */}
      {Object.keys(data.errorsByType).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Por tipo</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(data.errorsByType).map(([type, count]) => (
              <Badge key={type} variant="secondary" className="text-[10px]">
                {TYPE_LABELS[type] || type}: {count}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Top Edge Function Failures */}
      {data.edgeFunctionFailures.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Server className="h-3 w-3" /> Edge Functions instáveis
          </p>
          <div className="space-y-1">
            {data.edgeFunctionFailures.slice(0, 3).map((ef) => (
              <div key={ef.url} className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-muted/30">
                <span className="text-foreground font-mono truncate max-w-[70%]">{ef.url}</span>
                <span className="text-destructive font-medium">{ef.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Errors */}
      {data.topErrors.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Top erros</p>
          <div className="space-y-1">
            {data.topErrors.slice(0, 3).map((err, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-muted/30">
                <span className="text-foreground truncate max-w-[75%]">{err.message}</span>
                <span className="text-muted-foreground">{err.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.totalErrors24h === 0 && (
        <div className="text-center py-3">
          <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Nenhum erro nas últimas 24h</p>
        </div>
      )}
    </div>
  );
}
