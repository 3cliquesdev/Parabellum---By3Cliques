import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook para reativar IA em múltiplas conversas de uma vez
 */
export function useBulkReactivateAI() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (conversationIds: string[]) => {
      console.log('[useBulkReactivateAI] Reativando IA em:', conversationIds.length, 'conversas');

      if (conversationIds.length === 0) {
        throw new Error("Nenhuma conversa selecionada");
      }

      // Atualizar todas as conversas para autopilot
      const { error, count } = await supabase
        .from('conversations')
        .update({ 
          ai_mode: 'autopilot',
          status: 'open',
          assigned_to: null 
        })
        .in('id', conversationIds);

      if (error) throw error;

      return { updated: count || conversationIds.length };
    },
    onSuccess: ({ updated }) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-view"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-counts"] });
      
      toast({
        title: "🤖 IA Reativada",
        description: `${updated} conversa(s) voltaram para atendimento automático.`,
      });
    },
    onError: (error: Error) => {
      console.error('[useBulkReactivateAI] Erro:', error);
      toast({
        title: "Erro ao reativar IA",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
