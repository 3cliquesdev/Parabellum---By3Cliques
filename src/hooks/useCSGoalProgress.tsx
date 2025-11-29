import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CSGoalProgress {
  // Carteira Ativa (GMV)
  currentGMV: number;
  targetGMV: number;
  gmvPercentage: number;
  
  // Blindagem (Retenção)
  totalClients: number;
  churnedClients: number;
  retentionRate: number;
  
  // Expansão (Upsell)
  currentUpsell: number;
  targetUpsell: number;
  upsellPercentage: number;
  
  // Ativações
  currentActivations: number;
  targetActivations: number;
  activationsPercentage: number;
  
  // Bônus
  bonusAmount: number;
  bonusUnlocked: boolean;
  bonusRequirements: {
    gmvMet: boolean;
    retentionMet: boolean;
    upsellMet: boolean;
    activationsMet: boolean;
  };
}

export function useCSGoalProgress(consultantId: string, month: string) {
  return useQuery({
    queryKey: ["cs-goal-progress", consultantId, month],
    queryFn: async (): Promise<CSGoalProgress> => {
      console.log("📊 useCSGoalProgress: Calculating progress", { consultantId, month });

      // Fetch the goal
      const { data: goal, error: goalError } = await supabase
        .from("cs_goals")
        .select("*")
        .eq("consultant_id", consultantId)
        .eq("month", month)
        .maybeSingle();

      if (goalError) throw goalError;

      // If no goal exists, return empty progress
      if (!goal) {
        return {
          currentGMV: 0,
          targetGMV: 0,
          gmvPercentage: 0,
          totalClients: 0,
          churnedClients: 0,
          retentionRate: 100,
          currentUpsell: 0,
          targetUpsell: 0,
          upsellPercentage: 0,
          currentActivations: 0,
          targetActivations: 0,
          activationsPercentage: 0,
          bonusAmount: 0,
          bonusUnlocked: false,
          bonusRequirements: {
            gmvMet: false,
            retentionMet: false,
            upsellMet: false,
            activationsMet: false,
          },
        };
      }

      // Calculate date range for the month
      const monthDate = new Date(month);
      const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

      // 1. Calculate GMV (sum of all orders from consultant's clients in the month)
      const { data: clients } = await supabase
        .from("contacts")
        .select("id, total_ltv")
        .eq("consultant_id", consultantId)
        .eq("status", "customer");

      const currentGMV = clients?.reduce((sum, c) => sum + (c.total_ltv || 0), 0) || 0;
      const gmvPercentage = goal.target_gmv > 0 ? Math.min((currentGMV / goal.target_gmv) * 100, 100) : 0;

      // 2. Calculate Retention (churn rate)
      const totalClients = clients?.length || 0;
      const { data: churnedInMonth } = await supabase
        .from("contacts")
        .select("id")
        .eq("consultant_id", consultantId)
        .eq("status", "churned")
        .gte("updated_at", startOfMonth.toISOString())
        .lte("updated_at", endOfMonth.toISOString());

      const churnedClients = churnedInMonth?.length || 0;
      const churnRate = totalClients > 0 ? (churnedClients / totalClients) * 100 : 0;
      const retentionRate = 100 - churnRate;

      // 3. Calculate Upsell (won deals where customer already existed)
      const { data: upsellDeals } = await supabase
        .from("deals")
        .select("value")
        .eq("assigned_to", consultantId)
        .eq("status", "won")
        .gte("closed_at", startOfMonth.toISOString())
        .lte("closed_at", endOfMonth.toISOString());

      const currentUpsell = upsellDeals?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;
      const upsellPercentage = goal.target_upsell > 0 ? Math.min((currentUpsell / goal.target_upsell) * 100, 100) : 0;

      // 4. Calculate Activations (clients who went from onboarding to active and made 1 order)
      const { data: activations } = await supabase
        .from("contacts")
        .select("id")
        .eq("consultant_id", consultantId)
        .eq("status", "customer")
        .gte("created_at", startOfMonth.toISOString())
        .lte("created_at", endOfMonth.toISOString())
        .gt("total_ltv", 0);

      const currentActivations = activations?.length || 0;
      const activationsPercentage = goal.activation_count > 0 ? Math.min((currentActivations / goal.activation_count) * 100, 100) : 0;

      // 5. Check if bonus is unlocked
      const bonusRequirements = {
        gmvMet: gmvPercentage >= 100,
        retentionMet: churnRate <= goal.max_churn_rate,
        upsellMet: upsellPercentage >= 100,
        activationsMet: activationsPercentage >= 100,
      };

      const bonusUnlocked = Object.values(bonusRequirements).every(req => req);

      return {
        currentGMV,
        targetGMV: goal.target_gmv,
        gmvPercentage,
        totalClients,
        churnedClients,
        retentionRate,
        currentUpsell,
        targetUpsell: goal.target_upsell,
        upsellPercentage,
        currentActivations,
        targetActivations: goal.activation_count,
        activationsPercentage,
        bonusAmount: goal.bonus_amount,
        bonusUnlocked,
        bonusRequirements,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: !!consultantId && !!month,
  });
}
