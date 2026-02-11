import { Clock, AlertTriangle, Users, CheckCircle, Loader2, ArrowUpDown } from "lucide-react";
import { useDispatchQueue } from "@/hooks/useDispatchQueue";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function DispatchQueueWidget() {
  const { data, isLoading } = useDispatchQueue();

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const metrics = [
    {
      label: "Pendentes",
      value: data.pendingJobs,
      icon: ArrowUpDown,
      color: data.pendingJobs > 10 ? "text-yellow-500" : "text-muted-foreground",
    },
    {
      label: "Escalados",
      value: data.escalatedJobs,
      icon: AlertTriangle,
      color: data.escalatedJobs > 0 ? "text-destructive" : "text-muted-foreground",
    },
    {
      label: "Espera Média",
      value: `${data.avgWaitMinutes}m`,
      icon: Clock,
      color: data.avgWaitMinutes > 10 ? "text-destructive" : data.avgWaitMinutes > 5 ? "text-yellow-500" : "text-muted-foreground",
    },
    {
      label: "Críticas (>15m)",
      value: data.criticalJobs,
      icon: AlertTriangle,
      color: data.criticalJobs > 0 ? "text-destructive animate-pulse" : "text-muted-foreground",
    },
    {
      label: "Agentes Online",
      value: data.availableAgents,
      icon: Users,
      color: data.availableAgents === 0 ? "text-destructive" : "text-emerald-500",
    },
    {
      label: "Taxa Sucesso",
      value: `${data.successRate}%`,
      icon: CheckCircle,
      color: data.successRate >= 80 ? "text-emerald-500" : data.successRate >= 50 ? "text-yellow-500" : "text-destructive",
    },
  ];

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Fila de Distribuição</h3>
        <span className="text-xs text-muted-foreground">Atualiza a cada 15s</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="flex flex-col items-center gap-1 rounded-lg border p-2 text-center"
          >
            <m.icon className={cn("h-4 w-4", m.color)} />
            <span className={cn("text-lg font-bold tabular-nums", m.color)}>
              {m.value}
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              {m.label}
            </span>
          </div>
        ))}
      </div>

      {/* Success rate bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Taxa de sucesso (24h)</span>
          <span>{data.successRate}%</span>
        </div>
        <Progress value={data.successRate} className="h-2" />
      </div>
    </div>
  );
}
