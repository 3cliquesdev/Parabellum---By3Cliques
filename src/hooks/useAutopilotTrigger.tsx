import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAIStreamResponse } from './useAIStreamResponse';

/**
 * Hook que automaticamente dispara resposta da IA quando cliente envia mensagem
 * em conversas no modo Autopilot
 * 
 * 🆕 REGRA ANTI-ALUCINAÇÃO v3:
 * - Sempre chama process-chat-flow PRIMEIRO
 * - Só dispara IA se aiNodeActive === true
 * - Sem AIResponseNode = IA NÃO RODA
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

  // ============================================================
  // 🆕 PROCESSO ANTI-ALUCINAÇÃO: Chamar process-chat-flow primeiro
  // ============================================================
  const processFlowFirst = useCallback(async (customerMessage: string): Promise<{
    useAI: boolean;
    aiNodeActive: boolean;
    flowContext?: any;
    response?: string;
  }> => {
    if (!conversationId) return { useAI: false, aiNodeActive: false };
    
    try {
      console.log('[useAutopilotTrigger] 🔄 Calling process-chat-flow first (Anti-Hallucination)');
      
      const { data, error } = await supabase.functions.invoke('process-chat-flow', {
        body: {
          conversationId,
          userMessage: customerMessage
        }
      });

      if (error) {
        console.error('[useAutopilotTrigger] Error calling process-chat-flow:', error);
        return { useAI: false, aiNodeActive: false };
      }

      console.log('[useAutopilotTrigger] 📋 process-chat-flow response:', {
        useAI: data?.useAI,
        aiNodeActive: data?.aiNodeActive,
        flowId: data?.flowId,
        reason: data?.reason
      });

      return {
        useAI: data?.useAI || false,
        aiNodeActive: data?.aiNodeActive || false,
        flowContext: data?.aiNodeActive ? {
          flow_id: data?.flowId || data?.masterFlowId,
          node_id: data?.nodeId,
          node_type: 'ai_response',
          allowed_sources: data?.allowedSources || ['kb', 'crm', 'tracking'],
          response_format: 'text_only',
          personaId: data?.personaId,
          kbCategories: data?.kbCategories,
          contextPrompt: data?.contextPrompt,
          // 🆕 FASE 1: Fallback obrigatório com default
          fallbackMessage: data?.fallbackMessage || 'No momento não tenho essa informação.',
          // 🆕 FASE 1: Novos campos de controle de comportamento
          objective: data?.objective,
          maxSentences: data?.maxSentences ?? 3,
          forbidQuestions: data?.forbidQuestions ?? true,
          forbidOptions: data?.forbidOptions ?? true,
          // 🆕 Flags de restrição de categoria
          forbidFinancial: data?.forbidFinancial ?? false,
          forbidCommercial: data?.forbidCommercial ?? false,
          forbidCancellation: data?.forbidCancellation ?? false,
          forbidSupport: data?.forbidSupport ?? false,
          forbidConsultant: data?.forbidConsultant ?? false,
          // 🆕 OTP verificado
          otpVerified: data?.otpVerified || false,
          // 🆕 Configuração de ticket
          ticketConfig: data?.ticketConfig || null,
        } : undefined,
        response: data?.response
      };
    } catch (err) {
      console.error('[useAutopilotTrigger] Exception calling process-chat-flow:', err);
      return { useAI: false, aiNodeActive: false };
    }
  }, [conversationId]);

  // Callback para trigger síncrono (WhatsApp) - agora com flow-first
  const triggerSyncAutopilot = useCallback(async (customerMessage: string, flowContext?: any) => {
    if (!conversationId) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-autopilot-chat', {
        body: {
          conversationId,
          customerMessage,
          // 🆕 Passar flow_context se disponível
          flow_context: flowContext
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

          // Só processar se em modo autopilot
          if (aiMode !== 'autopilot') {
            console.log('[useAutopilotTrigger] Not in autopilot mode:', aiMode);
            return;
          }

          // ============================================================
          // 🆕 REGRA ANTI-ALUCINAÇÃO: Chamar process-chat-flow PRIMEIRO
          // ============================================================
          console.log('[useAutopilotTrigger] 🔄 Applying Anti-Hallucination Rule...');
          const flowResult = await processFlowFirst(newMessage.content);

          // ⛔ Se não há AIResponseNode ativo, NÃO chamar IA
          if (!flowResult.useAI || !flowResult.aiNodeActive) {
            console.log('[useAutopilotTrigger] ⛔ No AIResponseNode active - AI will NOT run');
            return;
          }

          // ✅ AIResponseNode ativo - agora sim, chamar IA
          console.log('[useAutopilotTrigger] ✅ AIResponseNode active - triggering AI with flow_context');
          
          // 🚀 UPGRADE: Usar streaming para web_chat, síncrono para outros canais
          if (convChannel === 'web_chat') {
            console.log('[useAutopilotTrigger] ⚡ Using SSE streaming for web_chat');
            // TODO: Passar flow_context para streaming também
            triggerStream(newMessage.content);
          } else {
            console.log('[useAutopilotTrigger] 📡 Using sync mode for:', convChannel);
            triggerSyncAutopilot(newMessage.content, flowResult.flowContext);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[useAutopilotTrigger] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [conversationId, triggerStream, triggerSyncAutopilot, processFlowFirst]);

  return { isStreaming };
}
