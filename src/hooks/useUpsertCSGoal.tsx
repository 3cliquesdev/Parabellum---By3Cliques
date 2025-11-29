import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UpsertCSGoalData {
  consultantId: string;
  month: string; // YYYY-MM-DD format
  targetGmv: number;
  targetUpsell: number;
  maxChurnRate?: number;
  activationCount?: number;
  bonusAmount?: number;
}

export function useUpsertCSGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpsertCSGoalData) => {
      console.log("🎯 useUpsertCSGoal: Upserting CS goal", data);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Check if goal exists
      const { data: existing } = await supabase
        .from("cs_goals")
        .select("id")
        .eq("consultant_id", data.consultantId)
        .eq("month", data.month)
        .maybeSingle();

      if (existing) {
        // Update existing goal
        const { error } = await supabase
          .from("cs_goals")
          .update({
            target_gmv: data.targetGmv,
            target_upsell: data.targetUpsell,
            max_churn_rate: data.maxChurnRate || 2.0,
            activation_count: data.activationCount || 0,
            bonus_amount: data.bonusAmount || 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Create new goal
        const { error } = await supabase
          .from("cs_goals")
          .insert({
            consultant_id: data.consultantId,
            month: data.month,
            target_gmv: data.targetGmv,
            target_upsell: data.targetUpsell,
            max_churn_rate: data.maxChurnRate || 2.0,
            activation_count: data.activationCount || 0,
            bonus_amount: data.bonusAmount || 0,
            created_by: user.id,
          });

        if (error) throw error;
      }

      console.log("✅ CS goal upserted");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cs-goals"] });
    },
  });
}
