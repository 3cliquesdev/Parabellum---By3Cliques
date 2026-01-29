import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAIStreamResponse } from './useAIStreamResponse';

/**
 * Hook que automaticamente dispara resposta da IA quando cliente envia mensagem
 * em conversas no modo Autopilot
 * 
 * UPGRADE v2: Usa streaming SSE para latência <1s (vs 5-20s síncrono)
 * - web_chat: usa streaming via ai-chat-stream
 * - whatsapp: continua usando ai-autopilot-chat (não suporta SSE)
 */
export function useAutopilotTrigger(conversationId: string | null) {
  // 🛡️ PROTEÇÃO ANTI-LOOP: Rastrear mensagens já processadas
  const processedMessageIds = useRef(new Set<string>());
  const lastTriggerRef = useRef<number>(0);
  
  // ✅ OTIMIZAÇÃO: Cache do ai_mode e channel para evitar query repetida
  const conversationCache = useRef<{ 
    mode: string | null; 
    channel: string | null;
    fetchedAt: number 
  } | null>(null);
  const CACHE_TTL = 10000; // 10 segundos

  // 🚀 Hook de streaming para web_chat
  const { triggerStream, isStreaming } = useAIStreamResponse(conversationId);

  // Callback para trigger síncrono (WhatsApp)
  const triggerSyncAutopilot = useCallback(async (customerMessage: string) => {
    if (!conversationId) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-autopilot-chat', {
        body: {
          conversationId,
          customerMessage
        }
      });

      if (error) {
        console.error('[useAutopilotTrigger] Error invoking AI:', error);
      } else {
        console.log('[useAutopilotTrigger] AI response triggered successfully:', data);
      }
    } catch (err) {
      console.error('[useAutopilotTrigger] Exception triggering AI:', err);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    console.log('[useAutopilotTrigger] Monitoring conversation:', conversationId);
    
    // Limpar cache quando conversationId mudar
    conversationCache.current = null;

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
            sender_type: newMessage.sender_type,
            channel: newMessage.channel
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

          // ✅ Ignorar mensagens WhatsApp (já processadas pelo handle-whatsapp-event)
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

          // ✅ OTIMIZAÇÃO: Usar cache se disponível e válido
          let aiMode: string | null = null;
          let convChannel: string | null = null;
          
          if (conversationCache.current && (now - conversationCache.current.fetchedAt) < CACHE_TTL) {
            aiMode = conversationCache.current.mode;
            convChannel = conversationCache.current.channel;
            console.log('[useAutopilotTrigger] Using cached data:', { aiMode, convChannel });
          } else {
            // Buscar do banco
            const { data: conv, error } = await supabase
              .from('conversations')
              .select('ai_mode, channel')
              .eq('id', conversationId)
              .single();

            if (error) {
              console.error('[useAutopilotTrigger] Error fetching conversation:', error);
              return;
            }

            aiMode = conv?.ai_mode || null;
            convChannel = conv?.channel || 'web_chat';
            // Atualizar cache
            conversationCache.current = { mode: aiMode, channel: convChannel, fetchedAt: now };
            console.log('[useAutopilotTrigger] Fetched and cached:', { aiMode, convChannel });
          }

          // Trigger autopilot
          if (aiMode === 'autopilot') {
            console.log('[useAutopilotTrigger] 🚀 Triggering AI response...');
            
            // 🚀 UPGRADE: Usar streaming para web_chat, síncrono para outros canais
            if (convChannel === 'web_chat') {
              console.log('[useAutopilotTrigger] ⚡ Using SSE streaming for web_chat');
              triggerStream(newMessage.content);
            } else {
              console.log('[useAutopilotTrigger] 📡 Using sync mode for:', convChannel);
              triggerSyncAutopilot(newMessage.content);
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[useAutopilotTrigger] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [conversationId, triggerStream, triggerSyncAutopilot]);

  return { isStreaming };
}
