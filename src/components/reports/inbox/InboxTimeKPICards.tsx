import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, UserCheck, ArrowRightLeft, Clock, Timer, Star } from "lucide-react";
import type { InboxTimeRow } from "@/hooks/useInboxTimeReport";

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

interface Props {
  data: InboxTimeRow[] | undefined;
  isLoading: boolean;
}

export function InboxTimeKPICards({ data, isLoading }: Props) {
  const kpi = data?.[0];

  const cards = [
    {
      label: "p50 1ª Resposta IA",
      value: formatDuration(kpi?.kpi_p50_ai_first_response ?? null),
      sub: `p90: ${formatDuration(kpi?.kpi_p90_ai_first_response ?? null)}`,
      icon: Bot,
      color: "text-blue-500",
    },
    {
      label: "% Resolvido sem Humano",
      value: kpi?.kpi_pct_resolved_no_human != null ? `${kpi.kpi_pct_resolved_no_human.toFixed(1)}%` : "—",
      icon: UserCheck,
      color: "text-green-500",
    },
    {
      label: "Tempo Médio IA→Handoff",
      value: formatDuration(kpi?.kpi_avg_ai_duration ?? null),
      icon: ArrowRightLeft,
      color: "text-orange-500",
    },
    {
      label: "Fila Média Humano",
      value: formatDuration(kpi?.kpi_avg_human_pickup ?? null),
      icon: Clock,
      color: "text-red-500",
    },
    {
      label: "Tempo Médio Humano→Resolução",
      value: formatDuration(kpi?.kpi_avg_human_resolution ?? null),
      icon: Timer,
      color: "text-purple-500",
    },
    {
      label: "CSAT Médio",
      value: kpi?.kpi_avg_csat != null ? kpi.kpi_avg_csat.toFixed(1) : "—",
      sub: kpi?.kpi_csat_response_rate != null ? `${kpi.kpi_csat_response_rate.toFixed(0)}% resp.` : undefined,
      icon: Star,
      color: "text-yellow-500",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((c) => (
        <Card key={c.label} className="p-4 space-y-1">
          <div className="flex items-center gap-2">
            <c.icon className={`h-4 w-4 ${c.color}`} />
            <span className="text-xs text-muted-foreground truncate">{c.label}</span>
          </div>
          <p className="text-xl font-bold">{c.value}</p>
          {c.sub && <p className="text-xs text-muted-foreground">{c.sub}</p>}
        </Card>
      ))}
    </div>
  );
}
