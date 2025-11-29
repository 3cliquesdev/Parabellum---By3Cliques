import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateCSGoalData {
  consultant_id: string;
  month: string;
  target_gmv: number;
  target_upsell: number;
  max_churn_rate: number;
  activation_count: number;
  bonus_amount: number;
}

export function useCreateCSGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCSGoalData) => {
      console.log("🎯 useCreateCSGoal: Creating CS goal", data);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: goal, error } = await supabase
        .from("cs_goals")
        .insert([{
          consultant_id: data.consultant_id,
          month: data.month,
          target_gmv: data.target_gmv,
          target_upsell: data.target_upsell,
          max_churn_rate: data.max_churn_rate,
          activation_count: data.activation_count,
          bonus_amount: data.bonus_amount,
          created_by: user.id,
        }])
        .select()
        .single();

      if (error) {
        console.error("❌ Error creating CS goal:", error);
        throw error;
      }

      console.log("✅ CS goal created:", goal);
      return goal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cs-goals"] });
      toast.success("Meta de CS criada com sucesso!");
    },
    onError: (error: Error) => {
      console.error("❌ Failed to create CS goal:", error);
      toast.error("Erro ao criar meta: " + error.message);
    },
  });
}
