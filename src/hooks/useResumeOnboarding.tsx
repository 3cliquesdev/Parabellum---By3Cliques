import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface JourneyStep {
  id: string;
  contact_id: string;
  step_name: string;
  position: number;
  completed: boolean;
  video_url?: string;
  rich_content?: string;
  attachments?: any;
  quiz_enabled?: boolean;
  quiz_question?: string;
  quiz_options?: any;
  quiz_correct_option?: string;
  quiz_passed?: boolean;
  video_completed?: boolean;
  is_critical: boolean;
  completed_at?: string;
  completed_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface ResumeData {
  currentStep: JourneyStep | null;
  nextStep: JourneyStep | null;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  allSteps: JourneyStep[];
}

export function useResumeOnboarding(contactId: string | null) {
  return useQuery({
    queryKey: ["resume-onboarding", contactId],
    queryFn: async (): Promise<ResumeData> => {
      if (!contactId) {
        return {
          currentStep: null,
          nextStep: null,
          progress: { completed: 0, total: 0, percentage: 0 },
          allSteps: [],
        };
      }

      const { data: steps, error } = await supabase
        .from("customer_journey_steps")
        .select("*")
        .eq("contact_id", contactId)
        .order("position", { ascending: true });

      if (error) throw error;

      const allSteps = (steps || []) as JourneyStep[];
      const completedSteps = allSteps.filter((s) => s.completed);
      const firstIncomplete = allSteps.find((s) => !s.completed);

      return {
        currentStep: firstIncomplete || allSteps[allSteps.length - 1] || null,
        nextStep: firstIncomplete || null,
        progress: {
          completed: completedSteps.length,
          total: allSteps.length,
          percentage:
            allSteps.length > 0
              ? Math.round((completedSteps.length / allSteps.length) * 100)
              : 0,
        },
        allSteps,
      };
    },
    enabled: !!contactId,
  });
}
