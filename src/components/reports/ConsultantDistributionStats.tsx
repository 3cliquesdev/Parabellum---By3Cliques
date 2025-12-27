import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserX, UserCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { DistributionStats } from "@/hooks/useConsultantDistributionReport";

interface ConsultantDistributionStatsProps {
  stats: DistributionStats | undefined;
  isLoading: boolean;
}

export function ConsultantDistributionStats({ stats, isLoading }: ConsultantDistributionStatsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-1 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Clientes Vinculados",
      value: stats?.total_linked || 0,
      description: `${stats?.avg_per_consultant || 0} média por consultor`,
      icon: UserCheck,
      className: "text-green-600",
    },
    {
      title: "Clientes Sem Consultor",
      value: stats?.total_unlinked || 0,
      description: "Aguardando distribuição",
      icon: UserX,
      className: stats?.total_unlinked ? "text-red-600" : "text-muted-foreground",
    },
    {
      title: "Consultores Ativos",
      value: stats?.total_consultants || 0,
      description: "Com acesso ao sistema",
      icon: Users,
      className: "text-blue-600",
    },
    {
      title: "Total de Clientes",
      value: (stats?.total_linked || 0) + (stats?.total_unlinked || 0),
      description: "Com status de cliente",
      icon: Users,
      className: "text-purple-600",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.className}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value.toLocaleString("pt-BR")}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
