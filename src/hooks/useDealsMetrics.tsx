import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "react-day-picker";

interface DealsMetricsResult {
  created: number;
  createdValue: number;
  won: number;
  wonValue: number;
  lost: number;
  lostValue: number;
}

/**
 * Hook dedicado para métricas da página de Deals
 * 
 * Lógica de filtro:
 * - Criados: filtrado por created_at (quando o deal foi criado)
 * - Ganhos: filtrado por closed_at (quando o deal foi fechado como won)
 * - Perdidos: filtrado por closed_at (quando o deal foi fechado como lost)
 * 
 * Isso garante consistência com a página de Assinaturas que usa
 * a data do evento Kiwify (approved_date) para contagem de vendas.
 */
export function useDealsMetrics(pipelineId: string | undefined, dateRange?: DateRange) {
  return useQuery({
    queryKey: ["deals-metrics", pipelineId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<DealsMetricsResult> => {
      if (!pipelineId) {
        return { created: 0, createdValue: 0, won: 0, wonValue: 0, lost: 0, lostValue: 0 };
      }

      // Preparar boundaries de data
      const fromDate = dateRange?.from ? new Date(dateRange.from) : null;
      const toDate = dateRange?.to ? new Date(dateRange.to) : null;
      
      if (toDate) {
        toDate.setHours(23, 59, 59, 999);
      }

      // Query 1: Oportunidades CRIADAS no período (filtro por created_at)
      let createdQuery = supabase
        .from("deals")
        .select("id, value", { count: "exact" })
        .eq("pipeline_id", pipelineId);

      if (fromDate) {
        createdQuery = createdQuery.gte("created_at", fromDate.toISOString());
      }
      if (toDate) {
        createdQuery = createdQuery.lte("created_at", toDate.toISOString());
      }

      const { data: createdData, count: createdCount } = await createdQuery;

      // Query 2: Deals FECHADOS como WON no período (filtro por closed_at)
      let wonQuery = supabase
        .from("deals")
        .select("id, value")
        .eq("pipeline_id", pipelineId)
        .eq("status", "won");

      if (fromDate) {
        wonQuery = wonQuery.gte("closed_at", fromDate.toISOString());
      }
      if (toDate) {
        wonQuery = wonQuery.lte("closed_at", toDate.toISOString());
      }

      const { data: wonData } = await wonQuery;

      // Query 3: Deals FECHADOS como LOST no período (filtro por closed_at)
      let lostQuery = supabase
        .from("deals")
        .select("id, value")
        .eq("pipeline_id", pipelineId)
        .eq("status", "lost");

      if (fromDate) {
        lostQuery = lostQuery.gte("closed_at", fromDate.toISOString());
      }
      if (toDate) {
        lostQuery = lostQuery.lte("closed_at", toDate.toISOString());
      }

      const { data: lostData } = await lostQuery;

      // Calcular totais
      const createdValue = createdData?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;
      const wonValue = wonData?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;
      const lostValue = lostData?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;

      return {
        created: createdCount || 0,
        createdValue,
        won: wonData?.length || 0,
        wonValue,
        lost: lostData?.length || 0,
        lostValue,
      };
    },
    enabled: !!pipelineId,
    staleTime: 30 * 1000, // 30 segundos
  });
}
