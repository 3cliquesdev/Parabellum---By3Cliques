import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RLHFMetrics {
  personaId: string;
  personaName: string;
  totalFeedbacks: number;
  positiveFeedbacks: number;
  negativeFeedbacks: number;
  approvalRate: number;
}

export const useRLHFMetrics = () => {
  return useQuery({
    queryKey: ["rlhf-metrics"],
    queryFn: async () => {
      // Fetch all feedbacks with persona info
      const { data: feedbacks, error } = await supabase
        .from("rlhf_feedback")
        .select(`
          *,
          ai_personas (
            id,
            name
          )
        `);

      if (error) throw error;

      // Group by persona and calculate metrics
      const metricsMap = new Map<string, RLHFMetrics>();

      feedbacks.forEach((feedback: any) => {
        const personaId = feedback.persona_id;
        const personaName = feedback.ai_personas?.name || "Unknown";

        if (!metricsMap.has(personaId)) {
          metricsMap.set(personaId, {
            personaId,
            personaName,
            totalFeedbacks: 0,
            positiveFeedbacks: 0,
            negativeFeedbacks: 0,
            approvalRate: 0,
          });
        }

        const metrics = metricsMap.get(personaId)!;
        metrics.totalFeedbacks++;

        if (feedback.feedback_type === "positive") {
          metrics.positiveFeedbacks++;
        } else {
          metrics.negativeFeedbacks++;
        }
      });

      // Calculate approval rates
      const metricsArray = Array.from(metricsMap.values()).map((metrics) => ({
        ...metrics,
        approvalRate:
          metrics.totalFeedbacks > 0
            ? Math.round((metrics.positiveFeedbacks / metrics.totalFeedbacks) * 100)
            : 0,
      }));

      // Sort by approval rate descending
      return metricsArray.sort((a, b) => b.approvalRate - a.approvalRate);
    },
  });
};
