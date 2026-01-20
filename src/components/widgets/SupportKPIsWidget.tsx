import { CompactMetricsGrid, type CompactMetric } from "@/components/ui/CompactMetricsGrid";
import { Clock, Timer, Star } from "lucide-react";
import { useSupportMetrics } from "@/hooks/useSupportMetrics";
import { Skeleton } from "@/components/ui/skeleton";

interface SupportKPIsWidgetProps {
  startDate: Date;
  endDate: Date;
}

export function SupportKPIsWidget({ startDate, endDate }: SupportKPIsWidgetProps) {
  const { data: metrics, isLoading } = useSupportMetrics(startDate, endDate);

  const formatTime = (minutes: number) => {
    if (minutes < 1) {
      return `${Math.round(minutes * 60)}s`;
    } else if (minutes < 60) {
      const mins = Math.floor(minutes);
      const secs = Math.round((minutes - mins) * 60);
      return `${mins}m ${secs}s`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return `${hours}h ${mins}m`;
    }
  };

  const getFRTStatus = (frt: number): { color: "green" | "yellow" | "red"; label: string } => {
    if (frt <= 5) return { color: "green", label: "✅ Excelente" };
    if (frt <= 10) return { color: "yellow", label: "⚠️ Bom" };
    return { color: "red", label: "🔴 Atenção" };
  };

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  const frtStatus = getFRTStatus(metrics?.avgFRT || 0);

  const supportMetrics: CompactMetric[] = [
    {
      title: "Tempo de 1ª Resposta (FRT)",
      value: formatTime(metrics?.avgFRT || 0),
      icon: Clock,
      color: frtStatus.color === "green" 
        ? "text-green-600" 
        : frtStatus.color === "yellow" 
          ? "text-yellow-600" 
          : "text-red-600",
      bgColor: frtStatus.color === "green"
        ? "bg-green-100 dark:bg-green-900/30"
        : frtStatus.color === "yellow"
          ? "bg-yellow-100 dark:bg-yellow-900/30"
          : "bg-red-100 dark:bg-red-900/30",
      subtext: frtStatus.label,
      tooltip: "Tempo médio até a primeira resposta do agente"
    },
    {
      title: "Tempo Médio Resolução (MTTR)",
      value: formatTime(metrics?.avgMTTR || 0),
      icon: Timer,
      color: "text-primary",
      bgColor: "bg-primary/10",
      subtext: "Tempo total até fechar ticket",
      tooltip: "Tempo médio desde abertura até resolução do ticket"
    },
    {
      title: "Satisfação (CSAT)",
      value: `${metrics?.avgCSAT ? metrics.avgCSAT.toFixed(1) : "0.0"}/5.0`,
      icon: Star,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
      subtext: `${metrics?.totalRatings || 0} avaliações`,
      tooltip: "Média de satisfação dos clientes após atendimento"
    },
  ];

  return <CompactMetricsGrid metrics={supportMetrics} columns={3} />;
}
