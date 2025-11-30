import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que automaticamente dispara resposta da IA quando cliente envia mensagem
 * em conversas no modo Autopilot (fallback caso webhook não funcione)
 */
export function useAutopilotTrigger(conversationId: string | null) {
  // 🛡️ PROTEÇÃO ANTI-LOOP: Rastrear mensagens já processadas
  const processedMessageIds = useRef(new Set<string>());
  const lastTriggerRef = useRef<number>(0);

  useEffect(() => {
    if (!conversationId) return;

    console.log('[useAutopilotTrigger] Monitoring conversation:', conversationId);

    const channel = supabase
      .channel(`autopilot-trigger-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          const newMessage = payload.new as any;
          
          console.log('[useAutopilotTrigger] New message detected:', {
            id: newMessage.id,
            sender_type: newMessage.sender_type
          });
          
          // 🛡️ PROTEÇÃO 1: Não processar mensagens já processadas
          if (processedMessageIds.current.has(newMessage.id)) {
            console.log('[useAutopilotTrigger] ⏭️ Mensagem já processada, ignorando');
            return;
          }

          // 🛡️ PROTEÇÃO 2: Debounce de 2 segundos entre chamadas
          const now = Date.now();
          if (now - lastTriggerRef.current < 2000) {
            console.log('[useAutopilotTrigger] ⏸️ Debounce ativo - ignorando');
            return;
          }

          // Só processar mensagens de clientes
          if (newMessage.sender_type !== 'contact') {
            console.log('[useAutopilotTrigger] Ignoring non-contact message');
            return;
          }

          // ✅ FASE 1: Ignorar mensagens WhatsApp (já processadas pelo handle-whatsapp-event)
          if (newMessage.channel === 'whatsapp') {
            console.log('[useAutopilotTrigger] Ignorando mensagem WhatsApp - processada pelo backend');
            return;
          }

          // Marcar como processada
          processedMessageIds.current.add(newMessage.id);
          lastTriggerRef.current = now;

          // Limpar ID após 1 minuto para não acumular memória
          setTimeout(() => {
            processedMessageIds.current.delete(newMessage.id);
          }, 60000);

          // Buscar ai_mode
          const { data: conv, error } = await supabase
            .from('conversations')
            .select('ai_mode')
            .eq('id', conversationId)
            .single();

          if (error) {
            console.error('[useAutopilotTrigger] Error fetching conversation:', error);
            return;
          }

          console.log('[useAutopilotTrigger] Conversation mode:', conv?.ai_mode);

          // Trigger autopilot
          if (conv?.ai_mode === 'autopilot') {
            console.log('[useAutopilotTrigger] Triggering AI response...');
            
            try {
              const { data, error: invokeError } = await supabase.functions.invoke('ai-autopilot-chat', {
                body: {
                  conversationId,
                  customerMessage: newMessage.content
                }
              });

              if (invokeError) {
                console.error('[useAutopilotTrigger] Error invoking AI:', invokeError);
              } else {
                console.log('[useAutopilotTrigger] AI response triggered successfully:', data);
              }
            } catch (err) {
              console.error('[useAutopilotTrigger] Exception triggering AI:', err);
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[useAutopilotTrigger] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [conversationId]);
}
