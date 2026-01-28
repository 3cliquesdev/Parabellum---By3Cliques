import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook para encerrar múltiplas conversas de uma vez
 */
export function useBulkCloseConversations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (conversationIds: string[]) => {
      console.log('[useBulkCloseConversations] Encerrando:', conversationIds.length, 'conversas');

      if (conversationIds.length === 0) {
        throw new Error("Nenhuma conversa selecionada");
      }

      // Atualizar todas as conversas para closed
      const { error, count } = await supabase
        .from('conversations')
        .update({ 
          status: 'closed',
          closed_at: new Date().toISOString(),
          ai_mode: 'disabled' 
        })
        .in('id', conversationIds);

      if (error) throw error;

      return { closed: count || conversationIds.length };
    },
    onSuccess: ({ closed }) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-view"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-counts"] });
      
      toast({
        title: "Conversas Encerradas",
        description: `${closed} conversa(s) encerrada(s) com sucesso.`,
      });
    },
    onError: (error: Error) => {
      console.error('[useBulkCloseConversations] Erro:', error);
      toast({
        title: "Erro ao encerrar conversas",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
