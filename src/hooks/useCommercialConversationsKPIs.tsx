import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KPIFilters {
  startDate: Date;
  endDate: Date;
  departmentId?: string;
  agentId?: string;
  status?: string;
  channel?: string;
}

export interface KPIData {
  total_conversations: number;
  total_open: number;
  total_closed: number;
  total_without_tag: number;
  avg_csat: number | null;
  avg_waiting_seconds: number | null;
  avg_duration_seconds: number | null;
}

const defaultKPIs: KPIData = {
  total_conversations: 0,
  total_open: 0,
  total_closed: 0,
  total_without_tag: 0,
  avg_csat: null,
  avg_waiting_seconds: null,
  avg_duration_seconds: null,
};

export function useCommercialConversationsKPIs(filters: KPIFilters) {
  return useQuery({
    queryKey: ["commercial-conversations-kpis", filters],
    queryFn: async () => {
      console.log('[KPIs] Calling with filters:', {
        p_start: filters.startDate.toISOString(),
        p_end: filters.endDate.toISOString(),
        p_department_id: filters.departmentId,
        p_agent_id: filters.agentId,
        p_status: filters.status,
        p_channel: filters.channel,
      });

      const { data, error } = await supabase.rpc("get_commercial_conversations_kpis", {
        p_start: filters.startDate.toISOString(),
        p_end: filters.endDate.toISOString(),
        p_department_id: filters.departmentId || null,
        p_agent_id: filters.agentId || null,
        p_status: filters.status || null,
        p_channel: filters.channel || null,
      });

      if (error) {
        console.error('[KPIs] RPC Error:', error);
        throw error;
      }
      
      console.log('[KPIs] Result:', data);
      return (data?.[0] || defaultKPIs) as KPIData;
    },
    staleTime: 30 * 1000,
  });
}
