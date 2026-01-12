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

    // Se há equipe configurada para o pipeline, usa diretamente os membros do pipeline
    // Isso inclui TODAS as roles configuradas (consultant, manager, sales_rep, etc.)
    if (pipelineReps && pipelineReps.length > 0) {
      return pipelineReps
        .filter(rep => rep.profiles)
        .map(rep => ({
          id: rep.user_id,
          full_name: rep.profiles?.full_name || '',
          job_title: rep.profiles?.job_title || null,
          avatar_url: rep.profiles?.avatar_url || null,
          availability_status: rep.profiles?.availability_status || null,
        }));
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
