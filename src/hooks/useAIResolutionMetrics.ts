import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";

export interface ResolutionMetrics {
  total_closed: number;
  ai_resolved: number;
  human_resolved: number;
  mixed_resolved: number;
  human_handoff: number;
  unclassified: number;
  ai_resolution_rate: number;
  human_rate: number;
  handoff_rate: number;
}

export interface DailyResolution {
  day: string;
  ai_resolved: number;
  human: number;
  handoff: number;
  total: number;
}

export interface HandoffReason {
  reason: string;
  count: number;
}

export function useAIResolutionMetrics(daysBack = 30) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - daysBack);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [daysBack]);

  const { data: metrics, isLoading: metricsLoading, isError: metricsError, refetch: refetchMetrics } = useQuery({
    queryKey: ["ai-resolution-metrics", daysBack],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_ai_resolution_metrics", {
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw error;
      setLastUpdated(new Date());
      const row = Array.isArray(data) ? data[0] : data;
      return {
        total_closed: Number(row?.total_closed ?? 0),
        ai_resolved: Number(row?.ai_resolved ?? 0),
        human_resolved: Number(row?.human_resolved ?? 0),
        mixed_resolved: Number(row?.mixed_resolved ?? 0),
        human_handoff: Number(row?.human_handoff ?? 0),
        unclassified: Number(row?.unclassified ?? 0),
        ai_resolution_rate: Number(row?.ai_resolution_rate ?? 0),
        human_rate: Number(row?.human_rate ?? 0),
        handoff_rate: Number(row?.handoff_rate ?? 0),
      } as ResolutionMetrics;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: dailyData = [], isLoading: dailyLoading, refetch: refetchDaily } = useQuery({
    queryKey: ["ai-resolution-daily", daysBack],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_ai_resolution_daily", {
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw error;
      return (data ?? []) as DailyResolution[];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Buscar motivos de handoff dos ai_events
  const { data: handoffEvents = [], isLoading: handoffLoading, refetch: refetchHandoff } = useQuery({
    queryKey: ["ai-handoff-reasons", daysBack],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_events")
        .select("event_type, output_json")
        .like("event_type", "ai_decision_%")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const handoffReasons = useMemo((): HandoffReason[] => {
    const map: Record<string, number> = {};
    handoffEvents.forEach((e: any) => {
      const reason = (e.output_json?.reason as string) || e.event_type.replace("ai_decision_", "");
      map[reason] = (map[reason] || 0) + 1;
    });
    return Object.entries(map)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }, [handoffEvents]);

  const donutData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: "IA resolveu", value: metrics.ai_resolved, color: "#22c55e" },
      { name: "Humano", value: metrics.human_resolved + metrics.mixed_resolved, color: "#3b82f6" },
      { name: "Handoff", value: metrics.human_handoff, color: "#f59e0b" },
      { name: "Não classificado", value: metrics.unclassified, color: "#94a3b8" },
    ].filter(d => d.value > 0);
  }, [metrics]);

  const refetch = () => { refetchMetrics(); refetchDaily(); refetchHandoff(); };

  return {
    metrics,
    dailyData,
    handoffReasons,
    donutData,
    isLoading: metricsLoading || dailyLoading || handoffLoading,
    isError: metricsError,
    refetch,
    lastUpdated,
  };
}
