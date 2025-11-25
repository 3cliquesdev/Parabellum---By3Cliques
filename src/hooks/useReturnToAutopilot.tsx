import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReturnToAutopilotParams {
  conversationId: string;
  contactId: string;
}

/**
 * Hook para devolver conversa para Autopilot (Copilot → Autopilot)
 * Útil quando humano resolve problema e quer que IA retome
 */
export function useReturnToAutopilot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ conversationId, contactId }: ReturnToAutopilotParams) => {
      console.log('[useReturnToAutopilot] Devolvendo para autopilot:', conversationId);

      // 1. Atualizar conversa para autopilot e remover assigned_to
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ 
          ai_mode: 'autopilot',
          assigned_to: null 
        })
        .eq('id', conversationId);

      if (updateError) throw updateError;

      // 2. Registrar interação de devolução
      const { error: interactionError } = await supabase
        .from('interactions')
        .insert({
          customer_id: contactId,
          type: 'note',
          content: `🤖 **Devolvido para Autopilot**\n\nConversa devolvida para atendimento automático da IA. O cliente será atendido pela IA até novo transbordo.`,
          channel: 'other',
          metadata: {
            return_to_autopilot: true,
            conversation_id: conversationId,
            timestamp: new Date().toISOString()
          }
        });

      if (interactionError) {
        console.error('[useReturnToAutopilot] Erro ao registrar interação:', interactionError);
      }

      return { conversationId };
    },
    onSuccess: ({ conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["ai-mode", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["customer-timeline"] });
      
      toast({
        title: "🤖 Devolvido para Autopilot",
        description: "A IA voltou a responder automaticamente nesta conversa.",
      });
    },
    onError: (error: Error) => {
      console.error('[useReturnToAutopilot] Erro:', error);
      toast({
        title: "Erro ao devolver para autopilot",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
