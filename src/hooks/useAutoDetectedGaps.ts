import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AutoDetectedGap {
  id: string;
  problem: string;
  solution: string;
  when_to_use: string | null;
  category: string | null;
  tags: string[];
  department_id: string | null;
  confidence_score: number | null;
  extracted_by: string | null;
  status: string;
  risk_level: string | null;
  created_at: string;
  department?: { id: string; name: string } | null;
}

/**
 * Hook para buscar gaps auto-detectados (knowledge_candidates com tag gap_detected)
 */
export function useAutoDetectedGaps(limit: number = 100) {
  return useQuery({
    queryKey: ["auto-detected-gaps", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_candidates")
        .select(`
          id,
          problem,
          solution,
          when_to_use,
          category,
          tags,
          department_id,
          confidence_score,
          extracted_by,
          status,
          risk_level,
          created_at,
          department:departments(id, name)
        `)
        .contains("tags", ["gap_detected"])
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as AutoDetectedGap[];
    },
    staleTime: 30_000,
  });
}

/**
 * Hook para contagem de gaps pendentes
 */
export function useAutoDetectedGapsCount() {
  return useQuery({
    queryKey: ["auto-detected-gaps-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("knowledge_candidates")
        .select("id", { count: "exact", head: true })
        .contains("tags", ["gap_detected"])
        .eq("status", "pending");

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 60_000,
  });
}

/**
 * Hook para dismiss/resolver um gap auto-detectado
 */
export function useDismissAutoGap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gapId: string) => {
      const { error } = await supabase
        .from("knowledge_candidates")
        .update({ status: "rejected" })
        .eq("id", gapId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-detected-gaps"] });
      queryClient.invalidateQueries({ queryKey: ["auto-detected-gaps-count"] });
      toast.success("Gap marcado como resolvido");
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });
}

/**
 * Hook para aprovar gap e transformar em artigo
 */
export function useApproveAutoGap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gapId: string) => {
      const { error } = await supabase
        .from("knowledge_candidates")
        .update({ status: "approved" })
        .eq("id", gapId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-detected-gaps"] });
      queryClient.invalidateQueries({ queryKey: ["auto-detected-gaps-count"] });
      toast.success("Gap aprovado");
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });
}

/**
 * Hook para disparar manualmente o detect-kb-gaps
 */
export function useTriggerGapDetection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("detect-kb-gaps", {
        body: {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auto-detected-gaps"] });
      queryClient.invalidateQueries({ queryKey: ["auto-detected-gaps-count"] });
      toast.success(`Detecção concluída: ${data?.gaps_detected || 0} gaps encontrados`);
    },
    onError: (err: Error) => {
      toast.error(`Erro na detecção: ${err.message}`);
    },
  });
}
