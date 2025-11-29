import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UpsertGoalData {
  userId: string;
  month: number;
  year: number;
  targetValue: number;
  commissionRate?: number;
}

export function useUpsertGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpsertGoalData) => {
      console.log("🎯 useUpsertGoal: Upserting sales goal", data);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Check if goal exists
      const { data: existing } = await supabase
        .from("sales_goals")
        .select("id")
        .eq("assigned_to", data.userId)
        .eq("period_month", data.month)
        .eq("period_year", data.year)
        .eq("status", "active")
        .maybeSingle();

      if (existing) {
        // Update existing goal
        const { error } = await supabase
          .from("sales_goals")
          .update({
            target_value: data.targetValue,
            commission_rate: data.commissionRate || 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Create new goal
        const { error } = await supabase
          .from("sales_goals")
          .insert({
            title: `Meta ${data.month}/${data.year}`,
            goal_type: "individual",
            target_value: data.targetValue,
            period_month: data.month,
            period_year: data.year,
            assigned_to: data.userId,
            created_by: user.id,
            status: "active",
            commission_rate: data.commissionRate || 0,
            product_targets: [],
          });

        if (error) throw error;
      }

      console.log("✅ Sales goal upserted");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}
