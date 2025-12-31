import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StageConversion {
  stageId: string;
  stageName: string;
  position: number;
  totalDeals: number;
  convertedDeals: number;
  conversionRate: number;
}

export function useStageConversionRates() {
  return useQuery({
    queryKey: ["stage-conversion-rates"],
    queryFn: async () => {
      // Get all stages
      const { data: stages, error: stagesError } = await supabase
        .from("stages")
        .select("id, name, position")
        .order("position", { ascending: true });

      if (stagesError) throw stagesError;

      // Get all deals with their stage
      const { data: deals, error: dealsError } = await supabase
        .from("deals")
        .select("id, stage_id, status");

      if (dealsError) throw dealsError;

      // Calculate conversion rates
      const stageConversions: StageConversion[] = stages?.map((stage, index) => {
        const nextStage = stages[index + 1];
        
        // Deals that entered this stage
        const dealsInStage = deals?.filter(d => d.stage_id === stage.id).length || 0;
        
        // Deals that moved to next stage OR won (for last stage)
        let convertedDeals = 0;
        if (nextStage) {
          // Count deals in any stage after this one + won deals
          const laterStageIds = stages.slice(index + 1).map(s => s.id);
          convertedDeals = deals?.filter(d => 
            laterStageIds.includes(d.stage_id || '') || d.status === 'won'
          ).length || 0;
        } else {
          // Last stage: count won deals
          convertedDeals = deals?.filter(d => d.status === 'won').length || 0;
        }

        // Total that passed through this stage = current + later stages + won
        const laterStageIds = stages.slice(index + 1).map(s => s.id);
        const totalPassed = deals?.filter(d => 
          d.stage_id === stage.id || 
          laterStageIds.includes(d.stage_id || '') || 
          d.status === 'won'
        ).length || 0;

        const conversionRate = totalPassed > 0 
          ? Math.round((convertedDeals / totalPassed) * 100) 
          : 0;

        return {
          stageId: stage.id,
          stageName: stage.name,
          position: stage.position,
          totalDeals: dealsInStage,
          convertedDeals,
          conversionRate,
        };
      }) || [];

      return stageConversions;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
