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
      let query = supabase
        .from("deals")
        .select("value, stage_id, stages(name, position)")
        .eq("status", "open");

      // Filtrar por pipeline se especificado
      if (pipelineId) {
        query = query.eq("pipeline_id", pipelineId);
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
