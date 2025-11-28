import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AutomationROI {
  playbook_id: string;
  playbook_name: string;
  total_executions: number;
  completed_executions: number;
  revenue_generated: number;
  customers_converted: number;
  avg_time_to_convert: number;
  automation_rate: number;
  ai_cost_estimate: number;
  roi_percentage: number;
}

export function useAutomationROI() {
  return useQuery({
    queryKey: ["automation-roi"],
    queryFn: async () => {
      // Fetch all playbooks
      const { data: playbooks, error: playbooksError } = await supabase
        .from("onboarding_playbooks")
        .select("id, name, is_active")
        .eq("is_active", true);

      if (playbooksError) throw playbooksError;

      // Fetch execution stats and revenue for each playbook
      const roi: AutomationROI[] = await Promise.all(
        (playbooks || []).map(async (playbook) => {
          // Get execution stats
          const { data: executions } = await supabase
            .from("playbook_executions")
            .select("id, status, started_at, completed_at, contact_id")
            .eq("playbook_id", playbook.id);

          const totalExecutions = executions?.length || 0;
          const completedExecutions = executions?.filter(e => e.status === 'completed').length || 0;

          // Get revenue from deals won by contacts that went through this playbook
          const contactIds = executions?.map(e => e.contact_id) || [];
          const { data: deals } = contactIds.length > 0
            ? await supabase
                .from("deals")
                .select("value, status, contact_id")
                .in("contact_id", contactIds)
                .eq("status", "won")
            : { data: null };

          const revenueGenerated = deals && deals.length > 0
            ? (deals as Array<{ value: number | null }>).reduce((sum, d) => sum + (d.value || 0), 0)
            : 0;

          const customersConverted = deals?.length || 0;

          // Calculate average time to convert (from playbook start to deal won)
          const completedWithDates = executions?.filter(e => 
            e.status === 'completed' && e.started_at && e.completed_at
          ) || [];
          
          const avgDays = completedWithDates.length > 0
            ? completedWithDates.reduce((sum, e) => {
                const days = Math.floor(
                  (new Date(e.completed_at!).getTime() - new Date(e.started_at).getTime()) 
                  / (1000 * 60 * 60 * 24)
                );
                return sum + days;
              }, 0) / completedWithDates.length
            : 0;

          // Estimate AI cost (assuming $0.01 per execution step)
          const aiCostEstimate = totalExecutions * 0.10; // $0.10 per execution average

          // Calculate automation rate (% of executions that completed without human intervention)
          const automationRate = totalExecutions > 0 ? (completedExecutions / totalExecutions) * 100 : 0;

          // Calculate ROI percentage
          const roiPercentage = aiCostEstimate > 0 
            ? ((revenueGenerated - aiCostEstimate) / aiCostEstimate) * 100 
            : 0;

          return {
            playbook_id: playbook.id,
            playbook_name: playbook.name,
            total_executions: totalExecutions,
            completed_executions: completedExecutions,
            revenue_generated: revenueGenerated,
            customers_converted: customersConverted,
            avg_time_to_convert: Math.round(avgDays * 10) / 10,
            automation_rate: automationRate,
            ai_cost_estimate: aiCostEstimate,
            roi_percentage: roiPercentage,
          };
        })
      );

      return roi.sort((a, b) => b.revenue_generated - a.revenue_generated);
    },
  });
}
