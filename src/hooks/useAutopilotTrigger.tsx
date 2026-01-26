import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que automaticamente dispara resposta da IA quando cliente envia mensagem
 * em conversas no modo Autopilot (fallback caso webhook não funcione)
 * 
 * OTIMIZAÇÃO: Cache do ai_mode para evitar query a cada mensagem
 */
export function useAutopilotTrigger(conversationId: string | null) {
  // 🛡️ PROTEÇÃO ANTI-LOOP: Rastrear mensagens já processadas
  const processedMessageIds = useRef(new Set<string>());
  const lastTriggerRef = useRef<number>(0);
  
  // ✅ OTIMIZAÇÃO: Cache do ai_mode para evitar query repetida
  const aiModeCache = useRef<{ mode: string | null; fetchedAt: number } | null>(null);
  const AI_MODE_CACHE_TTL = 10000; // 10 segundos de cache (reduced from 60s to prevent stale mode issues)

  useEffect(() => {
    if (!conversationId) return;

    console.log('[useAutopilotTrigger] Monitoring conversation:', conversationId);
    
    // Limpar cache quando conversationId mudar
    aiModeCache.current = null;

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

          // ✅ OTIMIZAÇÃO: Usar cache do ai_mode se disponível e válido
          let aiMode: string | null = null;
          
          if (aiModeCache.current && (now - aiModeCache.current.fetchedAt) < AI_MODE_CACHE_TTL) {
            // Usar cache
            aiMode = aiModeCache.current.mode;
            console.log('[useAutopilotTrigger] Using cached ai_mode:', aiMode);
          } else {
            // Buscar do banco
            const { data: conv, error } = await supabase
              .from('conversations')
              .select('ai_mode')
              .eq('id', conversationId)
              .single();

            if (error) {
              console.error('[useAutopilotTrigger] Error fetching conversation:', error);
              return;
            }

            aiMode = conv?.ai_mode || null;
            // Atualizar cache
            aiModeCache.current = { mode: aiMode, fetchedAt: now };
            console.log('[useAutopilotTrigger] Fetched and cached ai_mode:', aiMode);
          }

          // Trigger autopilot
          if (aiMode === 'autopilot') {
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
