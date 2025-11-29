import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CSGoal {
  id: string;
  consultant_id: string;
  month: string;
  target_gmv: number;
  target_upsell: number;
  max_churn_rate: number;
  activation_count: number;
  bonus_amount: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useCSGoals(consultantId?: string, month?: string) {
  return useQuery({
    queryKey: ["cs-goals", consultantId, month],
    queryFn: async () => {
      console.log("📊 useCSGoals: Fetching CS goals", { consultantId, month });

      let query = supabase
        .from("cs_goals")
        .select("*")
        .order("month", { ascending: false });

      if (consultantId) {
        query = query.eq("consultant_id", consultantId);
      }

      if (month) {
        query = query.eq("month", month);
      }

      const { data, error } = await query;

      if (error) {
        console.error("❌ Error fetching CS goals:", error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} CS goals`);
      return data as CSGoal[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
