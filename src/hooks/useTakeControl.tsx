import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface TakeControlParams {
  conversationId: string;
  contactId: string;
}

/**
 * Hook para assumir controle de conversa (Autopilot → Copilot)
 * Muda ai_mode para 'copilot' e atribui conversa ao usuário atual
 */
export function useTakeControl() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ conversationId, contactId }: TakeControlParams) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      console.log('[useTakeControl] Assumindo controle da conversa:', conversationId);

      // 1. Atualizar conversa para copilot + atribuir ao usuário
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ 
          ai_mode: 'copilot',
          assigned_to: user.id 
        })
        .eq('id', conversationId);

      if (updateError) throw updateError;

      // 🔧 FIX: Verificar se a atualização foi aplicada (proteção contra race condition)
      const { data: updatedConv } = await supabase
        .from('conversations')
        .select('ai_mode')
        .eq('id', conversationId)
        .single();

      if (updatedConv?.ai_mode !== 'copilot') {
        console.warn('[useTakeControl] ⚠️ ai_mode não foi atualizado! Tentando novamente...');
        // Retry com força
        await supabase
          .from('conversations')
          .update({ ai_mode: 'copilot', assigned_to: user.id })
          .eq('id', conversationId);
      }

      console.log('[useTakeControl] ✅ Conversa atualizada para copilot:', updatedConv?.ai_mode);

      // 2. Buscar perfil do usuário para mensagem de sistema
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, job_title')
        .eq('id', user.id)
        .single();

      // FASE 3: Inserir mensagem de sistema no chat (visível para cliente)
      const { error: systemMsgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content: `O atendente **${profile?.full_name || 'Suporte'}** entrou na conversa.`,
          sender_type: 'system',
          sender_id: user.id,
          is_ai_generated: false
        });

      if (systemMsgError) {
        console.error('[useTakeControl] Erro ao criar mensagem de sistema:', systemMsgError);
      }

      // 3. Gerar nota interna via auto-handoff (opcional - pode ser feito manualmente)
      // Buscar últimas mensagens
      const { data: messages } = await supabase
        .from('messages')
        .select('content, sender_type, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (messages && messages.length > 0) {
        const lastMessages = messages.reverse().map(m => ({
          content: m.content,
          sender_type: m.sender_type as 'customer' | 'agent' | 'system',
          created_at: m.created_at
        }));

        // Chamar auto-handoff para gerar resumo
        await supabase.functions.invoke('auto-handoff', {
          body: { conversationId, lastMessages }
        });
      }

      // 4. Registrar interação de tomada de controle
      const { error: interactionError } = await supabase
        .from('interactions')
        .insert({
          customer_id: contactId,
          type: 'note',
          content: `👤 **Controle Assumido**\n\n${profile?.full_name || 'Atendente'} assumiu o controle da conversa. Modo mudado de Autopilot para Copilot (IA assistente).`,
          channel: 'other',
          metadata: {
            take_control: true,
            conversation_id: conversationId,
            user_id: user.id,
            timestamp: new Date().toISOString()
          }
        });

      if (interactionError) {
        console.error('[useTakeControl] Erro ao registrar interação:', interactionError);
      }

      return { conversationId };
    },
    onSuccess: ({ conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["ai-mode", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["customer-timeline"] });
      
      toast({
        title: "✋ Controle Assumido",
        description: "Você agora está no modo Copilot. A IA irá sugerir respostas para você.",
      });
    },
    onError: (error: Error) => {
      console.error('[useTakeControl] Erro:', error);
      toast({
        title: "Erro ao assumir controle",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
