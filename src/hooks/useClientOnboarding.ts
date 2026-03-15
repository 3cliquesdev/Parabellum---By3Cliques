import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface OnboardingStep {
  id: string;
  name: string;
  description: string | null;
  step_type: string | null;
  completed: boolean;
  completed_at: string | null;
  position: number;
  is_critical: boolean;
  form_id: string | null;
}

export interface OnboardingExecution {
  id: string;
  playbook_name: string;
  status: string;
  steps: OnboardingStep[];
  progress: number;
  completedCount: number;
  totalCount: number;
}

export function useClientOnboarding() {
  const { user } = useAuth();

  const contactQuery = useQuery({
    queryKey: ["portal-contact-id-onboarding", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data, error } = await supabase
        .from("contacts")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();
      if (error) throw error;
      return data?.id || null;
    },
    enabled: !!user?.email,
  });

  const contactId = contactQuery.data;

  const executionsQuery = useQuery({
    queryKey: ["client-onboarding-executions", contactId],
    queryFn: async () => {
      if (!contactId) return [];

      const { data: executions, error: exError } = await supabase
        .from("playbook_executions")
        .select(`
          id,
          status,
          playbook:onboarding_playbooks(name)
        `)
        .eq("contact_id", contactId)
        .in("status", ["running", "waiting_form"])
        .order("created_at", { ascending: false });

      if (exError) throw exError;
      if (!executions || executions.length === 0) return [];

      const results: OnboardingExecution[] = [];

      for (const exec of executions) {
        const { data: steps, error: stError } = await supabase
          .from("customer_journey_steps")
          .select("id, name, description, step_type, completed, completed_at, position, is_critical, form_id")
          .eq("contact_id", contactId)
          .order("position", { ascending: true });

        if (stError) throw stError;

        const allSteps = steps || [];
        const completedCount = allSteps.filter((s) => s.completed).length;
        const totalCount = allSteps.length;
        const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

        results.push({
          id: exec.id,
          playbook_name: (exec.playbook as any)?.name || "Onboarding",
          status: exec.status,
          steps: allSteps,
          progress,
          completedCount,
          totalCount,
        });
      }

      return results;
    },
    enabled: !!contactId,
  });

  return {
    executions: executionsQuery.data || [],
    isLoading: contactQuery.isLoading || executionsQuery.isLoading,
    error: contactQuery.error || executionsQuery.error,
    contactId,
  };
}
