import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Clock, Star, Tag, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { KPIData } from "@/hooks/useCommercialConversationsKPIs";

interface CommercialKPICardsProps {
  data: KPIData | undefined;
  isLoading: boolean;
  isError?: boolean;
  error?: Error | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function CommercialKPICards({ data, isLoading, isError, error }: CommercialKPICardsProps) {
  const kpis = [
    {
      label: "Total Conversas",
      value: data?.total_conversations || 0,
      icon: MessageSquare,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Abertas",
      value: data?.total_open || 0,
      icon: XCircle,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      label: "Fechadas",
      value: data?.total_closed || 0,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Sem Tag",
      value: data?.total_without_tag || 0,
      icon: Tag,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      label: "CSAT Médio",
      value: data?.avg_csat ? data.avg_csat.toFixed(1) : "-",
      icon: Star,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      suffix: data?.avg_csat ? "/5" : "",
    },
    {
      label: "Tempo Médio Espera",
      value: formatDuration(data?.avg_waiting_seconds || null),
      icon: Clock,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Duração Média",
      value: formatDuration(data?.avg_duration_seconds || null),
      icon: Clock,
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-600 dark:text-red-400 text-sm font-medium">
            Erro ao carregar KPIs. Por favor, tente novamente.
          </p>
        </div>
        {error?.message && (
          <p className="text-red-500 dark:text-red-500 text-xs mt-1 ml-7">{error.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-md ${kpi.bgColor}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <span className="text-xs text-muted-foreground truncate">{kpi.label}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{kpi.value}</span>
              {kpi.suffix && <span className="text-sm text-muted-foreground">{kpi.suffix}</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
