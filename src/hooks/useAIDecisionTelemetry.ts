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

export interface TransferEvent {
  id: string;
  entity_id: string;
  event_type: string;
  created_at: string;
  output_json: {
    from_ai_mode?: string;
    to_ai_mode?: string;
    from_dept?: string | null;
    to_dept?: string | null;
    agent_id?: string | null;
    reason?: string;
  } | null;
}

export const REASON_LABELS: Record<string, string> = {
  zero_confidence_cautious: "Confiança Zero",
  strict_rag_handoff: "RAG Estrito",
  confidence_flow_advance: "Handoff por Confiança",
  fallback_phrase_detected: "Frase de Fallback",
  restriction_violation: "Violação de Restrição",
  anti_loop_max_fallbacks: "Anti-Loop",
};

export const TRANSITION_LABELS: Record<string, string> = {
  state_transition_handoff_to_human: "Handoff → Humano",
  state_transition_assign_agent: "Atribuir Agente",
  state_transition_unassign_agent: "Desatribuir Agente",
  state_transition_engage_ai: "Engajar IA",
  state_transition_set_copilot: "Setar Copilot",
  state_transition_update_department: "Atualizar Dept",
  state_transition_close: "Encerrar",
};

export function useAIDecisionTelemetry(hoursBack = 24) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const since = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - hoursBack);
    return d.toISOString();
  }, [hoursBack]);

  // Query 1: ai_decision_* events
  const { data: events = [], isLoading, isError, error, refetch } = useQuery({
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

  // Query 2: state_transition_* events (transfers)
  const { data: transferEvents = [], isLoading: isLoadingTransfers } = useQuery({
    queryKey: ["ai-transfer-telemetry", hoursBack],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_events")
        .select("id, entity_id, event_type, output_json, created_at")
        .like("event_type", "state_transition_%")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return (data ?? []) as TransferEvent[];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // Query 3: ai_close_* events
  const { data: closeEvents = [], isLoading: isLoadingCloses } = useQuery({
    queryKey: ["ai-close-telemetry", hoursBack],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_events")
        .select("id, entity_id, event_type, output_json, created_at")
        .like("event_type", "ai_close_%")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return (data ?? []) as TransferEvent[];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const kpis = useMemo(() => {
    const total = events.length;
    const handoffs = events.filter(e =>
      e.event_type.includes("strict_rag") || e.event_type.includes("confidence_flow")
    ).length;
    const fallbacks = events.filter(e =>
      e.event_type.includes("fallback_phrase") || e.event_type.includes("zero_confidence")
    ).length;
    const violations = events.filter(e =>
      e.event_type.includes("restriction") || e.event_type.includes("anti_loop")
    ).length;
    return { total, handoffs, fallbacks, violations };
  }, [events]);

  // Transfer KPIs
  const transferKpis = useMemo(() => {
    const totalTransfers = transferEvents.length;
    const handoffsToHuman = transferEvents.filter(e => e.event_type === "state_transition_handoff_to_human").length;
    const deptChanges = transferEvents.filter(e => {
      const json = e.output_json as any;
      return json?.from_dept && json?.to_dept && json.from_dept !== json.to_dept;
    }).length;
    const sameDeptTransfers = transferEvents.filter(e => {
      const json = e.output_json as any;
      return json?.from_dept && json?.to_dept && json.from_dept === json.to_dept && 
             e.event_type === "state_transition_handoff_to_human";
    }).length;
    const closesWithoutTag = closeEvents.filter(e => 
      e.event_type === "ai_close_without_tag" || e.event_type === "ai_close_confirm_without_tag"
    ).length;
    const proactiveCloses = closeEvents.filter(e => e.event_type === "ai_close_proactive").length;

    return { totalTransfers, handoffsToHuman, deptChanges, sameDeptTransfers, closesWithoutTag, proactiveCloses };
  }, [transferEvents, closeEvents]);

  // Transfer type breakdown
  const transferBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    transferEvents.forEach(e => {
      const label = TRANSITION_LABELS[e.event_type] || e.event_type.replace("state_transition_", "");
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transferEvents]);

  const typeBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach(e => {
      const shortType = e.event_type.replace("ai_decision_", "");
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

  return {
    events,
    transferEvents,
    closeEvents,
    isLoading: isLoading || isLoadingTransfers || isLoadingCloses,
    isError,
    error,
    refetch,
    kpis,
    transferKpis,
    transferBreakdown,
    typeBreakdown,
    hourlyData,
    lastUpdated,
  };
}
