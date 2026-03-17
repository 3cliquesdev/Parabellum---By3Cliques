import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ReportFilters {
  startDate: Date;
  endDate: Date;
  departmentId?: string;
  agentId?: string;
  status?: string;
  channel?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ReportRow {
  short_id: string;
  conversation_id: string;
  status: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_organization: string | null;
  created_at: string;
  closed_at: string | null;
  waiting_time_seconds: number | null;
  duration_seconds: number | null;
  assigned_agent_name: string | null;
  participants: string | null;
  department_name: string | null;
  interactions_count: number;
  origin: string;
  csat_score: number | null;
  csat_comment: string | null;
  ticket_id: string | null;
  bot_flow: string | null;
  tags_all: string[] | null;
  last_conversation_tag: string | null;
  first_customer_message: string | null;
  waiting_after_assignment_seconds: number | null;
  total_count: number;
}

export function useCommercialConversationsReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ["commercial-conversations-report", filters],
    queryFn: async () => {
      // +1 dia exclusivo para capturar o dia final completo (RPC usa < p_end)
      const endExclusive = new Date(filters.endDate);
      endExclusive.setDate(endExclusive.getDate() + 1);
      endExclusive.setHours(0, 0, 0, 0);

      console.log('[Report] Calling with filters:', {
        p_start: filters.startDate.toISOString(),
        p_end: endExclusive.toISOString(),
        p_end_original: filters.endDate.toISOString(),
        p_department_id: filters.departmentId,
        p_agent_id: filters.agentId,
        p_status: filters.status,
        p_channel: filters.channel,
        p_search: filters.search,
        p_limit: filters.limit,
        p_offset: filters.offset,
      });

      const { data, error } = await supabase.rpc("get_commercial_conversations_report", {
        p_start: filters.startDate.toISOString(),
        p_end: endExclusive.toISOString(),
        p_department_id: filters.departmentId || null,
        p_agent_id: filters.agentId || null,
        p_status: filters.status || null,
        p_channel: filters.channel || null,
        p_search: filters.search || null,
        p_limit: filters.limit || 50,
        p_offset: filters.offset || 0,
      });

      if (error) {
        console.error('[Report] RPC Error:', error);
        throw error;
      }
      
      console.log('[Report] Result count:', data?.length);
      return (data || []) as ReportRow[];
    },
    staleTime: 30 * 1000,
  });
}
