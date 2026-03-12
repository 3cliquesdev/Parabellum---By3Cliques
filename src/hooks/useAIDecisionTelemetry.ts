import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";

export interface AIDecisionEvent {
  id: string;
  entity_id: string;
  event_type: string;
  score: number | null;
  output_json: {
    reason?: string;
    exitType?: string;
    fallback_used?: boolean;
    articles_found?: number;
    hasFlowContext?: boolean;
  } | null;
  created_at: string;
}

export function useAIDecisionTelemetry(hoursBack = 24) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const since = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - hoursBack);
    return d.toISOString();
  }, [hoursBack]);

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ["ai-decision-telemetry", hoursBack],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_events")
        .select("id, entity_id, event_type, score, output_json, created_at")
        .like("event_type", "ai_decision_%")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setLastUpdated(new Date());
      return (data ?? []) as AIDecisionEvent[];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const kpis = useMemo(() => {
    const total = events.length;
    // Handoffs: strict_rag_handoff + confidence_flow_advance (both transfer to human)
    const handoffs = events.filter(e =>
      e.event_type.includes("handoff") || e.event_type.includes("confidence_flow_advance")
    ).length;
    // Fallbacks: fallback_phrase_detected + zero_confidence_cautious
    const fallbacks = events.filter(e =>
      e.event_type.includes("fallback_phrase") || e.event_type.includes("zero_confidence")
    ).length;
    // Violations: restriction_violation + anti_loop_max_fallbacks
    const violations = events.filter(e =>
      e.event_type.includes("restriction_violation") || e.event_type.includes("anti_loop")
    ).length;
    return { total, handoffs, fallbacks, violations };
  }, [events]);

  const typeBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach(e => {
      const shortType = e.event_type.replace("ai_decision_", "");
      // Normalize restriction_violation_* to single bucket
      const key = shortType.startsWith("restriction_violation") ? "restriction_violation" : shortType;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [events]);

  const hourlyData = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach(e => {
      const hour = e.created_at.slice(0, 13) + ":00";
      map[hour] = (map[hour] || 0) + 1;
    });
    return Object.entries(map)
      .map(([hour, count]) => ({ hour: hour.slice(11, 16), count }))
      .reverse();
  }, [events]);

  return { events, isLoading, refetch, kpis, typeBreakdown, hourlyData, lastUpdated };
}
