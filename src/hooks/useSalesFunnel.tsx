import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

export function useSalesFunnel(pipelineId?: string) {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  return useQuery({
    queryKey: ["sales-funnel", pipelineId, user?.id, role],
    queryFn: async () => {
      // Se não tiver pipeline especificado, buscar o pipeline padrão (com mais deals)
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
          // Fallback: buscar o pipeline com mais deals abertos
          const { data: pipelineStats } = await supabase
            .from("deals")
            .select("pipeline_id")
            .eq("status", "open")
            .not("pipeline_id", "is", null);
          
          if (pipelineStats && pipelineStats.length > 0) {
            // Contar deals por pipeline
            const pipelineCounts = pipelineStats.reduce((acc, deal) => {
              acc[deal.pipeline_id] = (acc[deal.pipeline_id] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            
            // Pegar o pipeline com mais deals
            targetPipelineId = Object.entries(pipelineCounts)
              .sort(([, a], [, b]) => b - a)[0]?.[0];
          }
        }
      }

      let query = supabase
        .from("deals")
        .select("value, stage_id, stages(name, position)")
        .eq("status", "open");

      // Sempre filtrar por pipeline para evitar mistura de stages
      if (targetPipelineId) {
        query = query.eq("pipeline_id", targetPipelineId);
      }

      // Sales rep vê apenas seus próprios dados
      if (role === "sales_rep" && user?.id) {
        query = query.eq("assigned_to", user.id);
      }

      const { data: deals, error } = await query;

      if (error) throw error;

      // Agrupar por etapa
      const funnelByStage = new Map<
        string,
        {
          stageName: string;
          dealsCount: number;
          totalValue: number;
          position: number;
        }
      >();

      deals?.forEach((deal) => {
        const stage = deal.stages as any;
        const stageId = deal.stage_id || "no-stage";
        const stageName = stage?.name || "Sem etapa";
        const position = stage?.position || 999;

        if (!funnelByStage.has(stageId)) {
          funnelByStage.set(stageId, {
            stageName,
            dealsCount: 0,
            totalValue: 0,
            position,
          });
        }

        const stageData = funnelByStage.get(stageId)!;
        stageData.dealsCount += 1;
        stageData.totalValue += deal.value || 0;
      });

      // Converter para array e ordenar por posição
      return Array.from(funnelByStage.values()).sort(
        (a, b) => a.position - b.position
      );
    },
    enabled: !roleLoading,
  });
}
