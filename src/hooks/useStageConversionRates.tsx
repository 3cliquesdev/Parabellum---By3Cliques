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

export function useStageConversionRates(pipelineId?: string) {
  return useQuery({
    queryKey: ["stage-conversion-rates", pipelineId],
    queryFn: async () => {
      // Determinar o pipeline a usar
      let targetPipelineId = pipelineId;
      
      if (!targetPipelineId) {
        const { data: defaultPipeline } = await supabase
          .from("pipelines")
          .select("id")
          .eq("is_default", true)
          .maybeSingle();
        
        if (defaultPipeline?.id) {
          targetPipelineId = defaultPipeline.id;
        } else {
          // Fallback: buscar o pipeline com mais deals
          const { data: pipelineStats } = await supabase
            .from("deals")
            .select("pipeline_id")
            .not("pipeline_id", "is", null);
          
          if (pipelineStats && pipelineStats.length > 0) {
            const pipelineCounts = pipelineStats.reduce((acc, deal) => {
              acc[deal.pipeline_id] = (acc[deal.pipeline_id] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            
            targetPipelineId = Object.entries(pipelineCounts)
              .sort(([, a], [, b]) => b - a)[0]?.[0];
          }
        }
      }

      // Get stages only from the target pipeline
      let stagesQuery = supabase
        .from("stages")
        .select("id, name, position")
        .order("position", { ascending: true });

      if (targetPipelineId) {
        stagesQuery = stagesQuery.eq("pipeline_id", targetPipelineId);
      }

      const { data: stages, error: stagesError } = await stagesQuery;

      if (stagesError) throw stagesError;

      // Get deals only from the target pipeline
      let dealsQuery = supabase
        .from("deals")
        .select("id, stage_id, status");

      if (targetPipelineId) {
        dealsQuery = dealsQuery.eq("pipeline_id", targetPipelineId);
      }

      const { data: deals, error: dealsError } = await dealsQuery;

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
