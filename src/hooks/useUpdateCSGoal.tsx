import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UpdateCSGoalData {
  id: string;
  target_gmv?: number;
  target_upsell?: number;
  max_churn_rate?: number;
  activation_count?: number;
  bonus_amount?: number;
}

export function useUpdateCSGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateCSGoalData) => {
      console.log("🎯 useUpdateCSGoal: Updating CS goal", data);

      const { id, ...updates } = data;

      const { data: goal, error } = await supabase
        .from("cs_goals")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("❌ Error updating CS goal:", error);
        throw error;
      }

      console.log("✅ CS goal updated:", goal);
      return goal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cs-goals"] });
      toast.success("Meta de CS atualizada com sucesso!");
    },
    onError: (error: Error) => {
      console.error("❌ Failed to update CS goal:", error);
      toast.error("Erro ao atualizar meta: " + error.message);
    },
  });
}
