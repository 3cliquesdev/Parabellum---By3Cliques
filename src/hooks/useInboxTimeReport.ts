import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InboxTimeFilters {
  startDate: Date;
  endDate: Date;
  departmentId?: string;
  agentId?: string;
  status?: string;
  channel?: string;
  tagId?: string;
  transferred?: string; // "true" | "false" | ""
  search?: string;
}

export interface InboxTimeRow {
  conversation_id: string;
  short_id: string;
  channel: string;
  status: string;
  contact_name: string;
  contact_phone: string;
  assigned_agent_name: string;
  department_name: string;
  customer_first_msg_at: string | null;
  ai_first_msg_at: string | null;
  handoff_at: string | null;
  agent_first_msg_at: string | null;
  resolved_at: string | null;
  ai_first_response_sec: number | null;
  ai_duration_sec: number | null;
  time_to_handoff_sec: number | null;
  human_pickup_sec: number | null;
  human_resolution_sec: number | null;
  total_resolution_sec: number | null;
  csat_score: number | null;
  tags_all: string[];
  total_count: number;
  kpi_avg_ai_first_response: number | null;
  kpi_avg_ai_duration: number | null;
  kpi_avg_human_pickup: number | null;
  kpi_avg_human_resolution: number | null;
  kpi_avg_total_resolution: number | null;
  kpi_p50_ai_first_response: number | null;
  kpi_p90_ai_first_response: number | null;
  kpi_pct_resolved_no_human: number | null;
  kpi_avg_csat: number | null;
  kpi_csat_response_rate: number | null;
}

export function useInboxTimeReport(filters: InboxTimeFilters, page: number = 0, pageSize: number = 50) {
  const endExclusive = new Date(filters.endDate);
  endExclusive.setDate(endExclusive.getDate() + 1);

  return useQuery({
    queryKey: ["inbox-time-report", filters, page, pageSize],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_inbox_time_report" as any, {
        p_start: filters.startDate.toISOString(),
        p_end: endExclusive.toISOString(),
        p_department_id: filters.departmentId || null,
        p_agent_id: filters.agentId || null,
        p_status: filters.status || null,
        p_channel: filters.channel || null,
        p_tag_id: filters.tagId || null,
        p_transferred: filters.transferred || null,
        p_search: filters.search ? filters.search.replace(/^#/, '').trim() : null,
        p_limit: pageSize,
        p_offset: page * pageSize,
      } as any);

      if (error) throw error;
      return (data as InboxTimeRow[]) || [];
    },
  });
}
