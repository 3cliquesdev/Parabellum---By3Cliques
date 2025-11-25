import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useOnboardingProgress(contactId: string | null) {
  return useQuery({
    queryKey: ["onboarding-progress", contactId],
    queryFn: async () => {
      if (!contactId) return {
        progress: 0,
        totalSteps: 0,
        completedSteps: 0,
        criticalPending: false,
      };

      const { data: steps, error } = await supabase
        .from("customer_journey_steps")
        .select("id, completed, is_critical")
        .eq("contact_id", contactId);

      if (error) throw error;

      const totalSteps = steps?.length || 0;
      const completedSteps = steps?.filter(s => s.completed).length || 0;
      const criticalPending = steps?.some(s => s.is_critical && !s.completed) || false;
      const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 100;

      return {
        progress,
        totalSteps,
        completedSteps,
        criticalPending,
      };
    },
    enabled: !!contactId,
  });
}
