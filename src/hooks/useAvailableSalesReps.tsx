import { useMemo } from "react";
import { useSalesReps } from "@/hooks/useSalesReps";
import { usePipelineSalesReps } from "@/hooks/usePipelineSalesReps";

/**
 * Hook para obter vendedores disponíveis baseado no pipeline.
 * Se o pipeline tiver uma equipe configurada, retorna apenas esses vendedores.
 * Caso contrário, retorna todos os vendedores (fallback).
 */
export function useAvailableSalesReps(pipelineId?: string) {
  const { data: allSalesReps, isLoading: allLoading } = useSalesReps();
  const { data: pipelineReps, isLoading: pipelineLoading } = usePipelineSalesReps(pipelineId);

  const availableReps = useMemo(() => {
    // Se não há pipelineId, retorna todos os sales reps
    if (!pipelineId) {
      return allSalesReps || [];
    }

    // Se há equipe configurada para o pipeline, filtra APENAS sales_rep
    // Cruza os membros do pipeline com allSalesReps (que só contém role sales_rep)
    if (pipelineReps && pipelineReps.length > 0) {
      const pipelineUserIds = new Set(pipelineReps.map(r => r.user_id));
      return allSalesReps?.filter(rep => pipelineUserIds.has(rep.id)) || [];
    }

    // Fallback: retorna todos se não houver equipe configurada
    return allSalesReps || [];
  }, [pipelineId, pipelineReps, allSalesReps]);

  const hasPipelineTeam = !!(pipelineId && pipelineReps && pipelineReps.length > 0);
  const isLoading = allLoading || (pipelineId ? pipelineLoading : false);

  return {
    availableReps,
    hasPipelineTeam,
    isLoading,
    allSalesReps: allSalesReps || [],
    pipelineReps: pipelineReps || [],
  };
}
