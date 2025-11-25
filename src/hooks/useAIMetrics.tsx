import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

export interface AIMetrics {
  feature_type: string;
  usage_count: number;
  unique_users: number;
  sentiment_breakdown: {
    critico?: number;
    neutro?: number;
    promotor?: number;
  };
}

export function useAIMetrics(startDate?: Date, endDate?: Date) {
  const { user } = useAuth();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["ai-metrics", startDate?.toISOString(), endDate?.toISOString(), user?.id, role],
    queryFn: async () => {
      if (!user) return [];

      const start = startDate || new Date(new Date().setDate(new Date().getDate() - 30));
      const end = endDate || new Date();

      // Sales rep sees only their own metrics
      const userId = role === 'sales_rep' ? user.id : null;

      const { data, error } = await supabase.rpc('get_ai_usage_metrics', {
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
        p_user_id: userId
      });

      if (error) throw error;
      return (data || []) as AIMetrics[];
    },
    enabled: !!user,
  });
}
