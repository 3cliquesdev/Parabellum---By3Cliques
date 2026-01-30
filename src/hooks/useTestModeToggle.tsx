import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Hook para gerenciar o modo de teste individual por conversa
 * 
 * Quando is_test_mode = true:
 * - A IA responde nesta conversa mesmo que ai_global_enabled = false
 * - Permite testar fluxos e personas sem afetar outras conversas
 * 
 * Apenas admins/managers podem ativar o modo de teste
 */
export function useTestModeToggle(conversationId: string | null) {
  const queryClient = useQueryClient();

  // Query para buscar o estado atual do test mode
  const query = useQuery({
    queryKey: ["test-mode", conversationId],
    queryFn: async () => {
      if (!conversationId) return null;

      const { data, error } = await supabase
        .from("conversations")
        .select("is_test_mode")
        .eq("id", conversationId)
        .single();

      if (error) throw error;
      return data?.is_test_mode ?? false;
    },
    enabled: !!conversationId,
    staleTime: 30 * 1000, // 30 segundos
  });

  // Mutation para toggle do test mode
  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!conversationId) throw new Error("Conversation ID is required");

      const { error } = await supabase
        .from("conversations")
        .update({ is_test_mode: enabled })
        .eq("id", conversationId);

      if (error) throw error;
      return enabled;
    },
    onSuccess: (enabled) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["test-mode", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });

      toast.success(
        enabled
          ? "🧪 Modo Teste ativado - IA rodará nesta conversa"
          : "✅ Modo Teste desativado"
      );
    },
    onError: (error) => {
      console.error("[useTestModeToggle] Error:", error);
      toast.error("Erro ao alterar modo de teste");
    },
  });

  return {
    isTestMode: query.data ?? false,
    isLoading: query.isLoading,
    toggle: mutation.mutate,
    isPending: mutation.isPending,
  };
}
