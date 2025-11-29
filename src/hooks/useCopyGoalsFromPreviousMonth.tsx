import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CopyGoalsData {
  fromMonth: number;
  fromYear: number;
  toMonth: number;
  toYear: number;
}

export function useCopyGoalsFromPreviousMonth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CopyGoalsData) => {
      console.log("📋 Copying goals from previous month", data);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Fetch sales goals from previous month
      const { data: prevSalesGoals, error: salesError } = await supabase
        .from("sales_goals")
        .select("*")
        .eq("period_month", data.fromMonth)
        .eq("period_year", data.fromYear)
        .eq("status", "active");

      if (salesError) throw salesError;

      // Fetch CS goals from previous month
      const prevCSMonth = `${data.fromYear}-${String(data.fromMonth).padStart(2, '0')}-01`;
      const { data: prevCSGoals, error: csError } = await supabase
        .from("cs_goals")
        .select("*")
        .eq("month", prevCSMonth);

      if (csError) throw csError;

      let copiedCount = 0;

      // Copy sales goals
      if (prevSalesGoals && prevSalesGoals.length > 0) {
        const newSalesGoals = prevSalesGoals.map(goal => ({
          title: `Meta ${data.toMonth}/${data.toYear}`,
          goal_type: goal.goal_type,
          target_value: goal.target_value,
          period_month: data.toMonth,
          period_year: data.toYear,
          assigned_to: goal.assigned_to,
          department: goal.department,
          created_by: user.id,
          status: "active" as const,
          commission_rate: goal.commission_rate,
          product_targets: goal.product_targets || [],
        }));

        const { error } = await supabase
          .from("sales_goals")
          .insert(newSalesGoals);

        if (error) throw error;
        copiedCount += newSalesGoals.length;
      }

      // Copy CS goals
      if (prevCSGoals && prevCSGoals.length > 0) {
        const newCSMonth = `${data.toYear}-${String(data.toMonth).padStart(2, '0')}-01`;
        const newCSGoals = prevCSGoals.map(goal => ({
          consultant_id: goal.consultant_id,
          month: newCSMonth,
          target_gmv: goal.target_gmv,
          target_upsell: goal.target_upsell,
          max_churn_rate: goal.max_churn_rate,
          activation_count: goal.activation_count,
          bonus_amount: goal.bonus_amount,
          created_by: user.id,
        }));

        const { error } = await supabase
          .from("cs_goals")
          .insert(newCSGoals);

        if (error) throw error;
        copiedCount += newCSGoals.length;
      }

      console.log(`✅ Copied ${copiedCount} goals to new month`);
      return copiedCount;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["cs-goals"] });
      toast.success(`${count} metas copiadas com sucesso!`);
    },
    onError: (error: Error) => {
      console.error("❌ Failed to copy goals:", error);
      toast.error("Erro ao copiar metas: " + error.message);
    },
  });
}
