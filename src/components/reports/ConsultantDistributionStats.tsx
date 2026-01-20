import { Skeleton } from "@/components/ui/skeleton";
import { CompactMetricsGrid, type CompactMetric } from "@/components/ui/CompactMetricsGrid";
import { Users, UserX, UserCheck } from "lucide-react";
import type { DistributionStats } from "@/hooks/useConsultantDistributionReport";

interface ConsultantDistributionStatsProps {
  stats: DistributionStats | undefined;
  isLoading: boolean;
}

export function ConsultantDistributionStats({ stats, isLoading }: ConsultantDistributionStatsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  const totalClientes = (stats?.total_linked || 0) + (stats?.total_unlinked || 0);
  const percentVinculados = totalClientes > 0 
    ? ((stats?.total_linked || 0) / totalClientes * 100).toFixed(0) + "%"
    : "0%";
  const percentSemConsultor = totalClientes > 0 
    ? ((stats?.total_unlinked || 0) / totalClientes * 100).toFixed(0) + "%"
    : "0%";

  const metricsData: CompactMetric[] = [
    {
      title: "Clientes Vinculados",
      value: stats?.total_linked || 0,
      icon: UserCheck,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/30",
      percent: percentVinculados,
      percentColor: "green",
      subtext: `${stats?.avg_per_consultant || 0} média/consultor`,
      tooltip: "Clientes com consultor atribuído"
    },
    {
      title: "Clientes Sem Consultor",
      value: stats?.total_unlinked || 0,
      icon: UserX,
      color: stats?.total_unlinked ? "text-red-600" : "text-muted-foreground",
      bgColor: stats?.total_unlinked 
        ? "bg-red-100 dark:bg-red-900/30" 
        : "bg-muted/50",
      percent: percentSemConsultor,
      percentColor: stats?.total_unlinked ? "red" : "muted",
      subtext: "Aguardando distribuição",
      tooltip: "Clientes que ainda não têm consultor"
    },
    {
      title: "Consultores Ativos",
      value: stats?.total_consultants || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      subtext: "Com acesso ao sistema",
      tooltip: "Total de consultores ativos na plataforma"
    },
    {
      title: "Total de Clientes",
      value: totalClientes,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
      subtext: "Com status de cliente",
      tooltip: "Vinculados + Sem consultor"
    },
  ];

  return <CompactMetricsGrid metrics={metricsData} columns={4} />;
}
