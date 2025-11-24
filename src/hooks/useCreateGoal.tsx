import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateGoalData {
  title: string;
  description?: string;
  goal_type: "individual" | "team" | "company";
  target_value: number;
  period_month: number;
  period_year: number;
  assigned_to?: string;
  department?: string;
}

export function useCreateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateGoalData) => {
      console.log("🎯 useCreateGoal: Creating goal", data);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: goal, error } = await supabase
        .from("sales_goals")
        .insert([{
          title: data.title,
          description: data.description,
          goal_type: data.goal_type,
          target_value: data.target_value,
          period_month: data.period_month,
          period_year: data.period_year,
          assigned_to: data.assigned_to || null,
          department: (data.department as any) || null,
          created_by: user.id,
          status: "active",
        }])
        .select()
        .single();

      if (error) {
        console.error("❌ Error creating goal:", error);
        throw error;
      }

      // Create milestone records for tracking
      const milestones = [25, 50, 75, 100];
      for (const milestone of milestones) {
        await supabase.from("goal_milestones").insert({
          goal_id: goal.id,
          milestone_percentage: milestone,
        });
      }

      console.log("✅ Goal created:", goal);
      return goal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Meta criada com sucesso!");
    },
    onError: (error: Error) => {
      console.error("❌ Failed to create goal:", error);
      toast.error("Erro ao criar meta: " + error.message);
    },
  });
}
