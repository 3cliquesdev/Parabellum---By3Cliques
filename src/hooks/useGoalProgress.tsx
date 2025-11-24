import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GoalProgress {
  goalId: string;
  currentValue: number;
  targetValue: number;
  percentage: number;
  dealCount: number;
  milestonesAchieved: number[];
}

export function useGoalProgress(goalId: string, targetValue: number, month: number, year: number, assignedTo: string | null) {
  return useQuery({
    queryKey: ["goal-progress", goalId, month, year, assignedTo],
    queryFn: async () => {
      console.log("📈 useGoalProgress: Calculating progress", { goalId, month, year, assignedTo });

      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

      let query = supabase
        .from("deals")
        .select("value")
        .eq("status", "won")
        .gte("closed_at", startDate)
        .lte("closed_at", endDate);

      // Filter by assigned user if individual goal
      if (assignedTo) {
        query = query.eq("assigned_to", assignedTo);
      }

      const { data: deals, error } = await query;

      if (error) {
        console.error("❌ Error fetching deals for progress:", error);
        throw error;
      }

      // Calculate total value
      const currentValue = deals?.reduce((sum, deal) => sum + Number(deal.value || 0), 0) || 0;
      const percentage = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;

      // Determine which milestones have been achieved
      const milestonesAchieved: number[] = [];
      if (percentage >= 25) milestonesAchieved.push(25);
      if (percentage >= 50) milestonesAchieved.push(50);
      if (percentage >= 75) milestonesAchieved.push(75);
      if (percentage >= 100) milestonesAchieved.push(100);

      // Update milestone achievements in database
      for (const milestone of milestonesAchieved) {
        await supabase
          .from("goal_milestones")
          .upsert({
            goal_id: goalId,
            milestone_percentage: milestone,
            achieved_at: new Date().toISOString(),
          }, {
            onConflict: "goal_id,milestone_percentage",
            ignoreDuplicates: false,
          });
      }

      const progress: GoalProgress = {
        goalId,
        currentValue,
        targetValue,
        percentage: Math.round(percentage),
        dealCount: deals?.length || 0,
        milestonesAchieved,
      };

      console.log("✅ Goal progress calculated:", progress);
      return progress;
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}
