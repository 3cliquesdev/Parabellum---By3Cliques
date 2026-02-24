import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BulkCloseParams {
  conversationIds: string[];
  tagsRequired?: boolean;
}

/**
 * Hook para encerrar múltiplas conversas de uma vez
 * Respeita a exigência de tags de categoria "conversation" quando ativa
 */
export function useBulkCloseConversations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ conversationIds, tagsRequired }: BulkCloseParams) => {
      console.log('[useBulkCloseConversations] Encerrando:', conversationIds.length, 'conversas');

      if (conversationIds.length === 0) {
        throw new Error("Nenhuma conversa selecionada");
      }

      // Se tags obrigatórias, verificar quais conversas têm tags de categoria "conversation"
      if (tagsRequired) {
        const { data: taggedConversations, error: tagErr } = await supabase
          .from('conversation_tags')
          .select('conversation_id, tag:tags!inner(category)')
          .in('conversation_id', conversationIds)
          .eq('tag.category', 'conversation');

        if (tagErr) throw tagErr;

        const conversationsWithTags = new Set(
          (taggedConversations || []).map(ct => ct.conversation_id)
        );

        const missing = conversationIds.filter(id => !conversationsWithTags.has(id));

        if (missing.length > 0) {
          throw new Error(
            `${missing.length} conversa(s) não possuem tags de conversa obrigatórias. Adicione tags da categoria "conversa" antes de encerrar.`
          );
        }
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
