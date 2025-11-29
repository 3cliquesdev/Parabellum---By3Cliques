import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SLAViolationStats {
  total_conversations: number;
  violations_count: number;
  violation_rate: number;
}

export function useSLAViolationStats(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['sla-violation-stats', startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<SLAViolationStats> => {
      // Get total conversations in date range
      const { data: allConversations, error: totalError } = await supabase
        .from('conversations')
        .select('id')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (totalError) throw totalError;

      // Get violations (alerts created in date range)
      const { data: violations, error: violationsError } = await supabase
        .from('sla_alerts')
        .select('id')
        .eq('alert_type', 'frt_violation')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (violationsError) throw violationsError;

      const total = allConversations?.length || 0;
      const violationsCount = violations?.length || 0;
      const violationRate = total > 0 ? (violationsCount / total) * 100 : 0;

      return {
        total_conversations: total,
        violations_count: violationsCount,
        violation_rate: Math.round(violationRate)
      };
    },
  });
}