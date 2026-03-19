import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isFeatureEnabled } from "@/config/features";

// Configuração para envio WhatsApp (Meta ou Evolution)
interface WhatsAppConfig {
  provider: 'meta' | 'evolution';
  instanceId: string;
  phoneNumber: string;
  media?: {
    type: 'image' | 'audio' | 'video' | 'document';
    url: string;
    filename?: string;
    mimeType?: string;
  };
}

interface SendInstantParams {
  conversationId: string;
  content: string;
  isInternal?: boolean;
  channel?: string;
  // NOVO: Config para WhatsApp (envio otimista)
  whatsappConfig?: WhatsAppConfig;
  // 🆕 Nome do remetente para exibir na mensagem
  senderName?: string;
}

/**
 * Hook para envio instantâneo de mensagens (Fire-and-Forget)
 * 
 * ENTERPRISE V2 UPGRADES:
 * - Usa MESMO UUID como id E client_message_id (Ajuste 1)
 * - Envia client_message_id para edge functions (Ajuste 2)
 * - Dedup trivial por ID único
 * 
 * FLUXO:
 * 1. Gera UUID único (usado como id E client_message_id)
 * 2. Adiciona ao cache React Query com status="sending" (INSTANTÂNEO)
 * 3. Limpa input imediatamente
 * 4. Persiste no banco EM BACKGROUND (não bloqueia UI)
 * 5. Para WhatsApp: Envia via edge function com client_message_id
 * 6. Edge function faz UPDATE com provider_message_id (wamid)
 * 7. Realtime propaga UPDATE com status delivered/read
 * 
 * LATÊNCIA PERCEBIDA: <100ms
 */
export function useSendMessageInstant() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  
  // 🆕 Verificar se Enterprise V2 está ativo
  const isEnterpriseV2 = isFeatureEnabled('INBOX_ENTERPRISE_V2');

  const sendInstant = useCallback((params: SendInstantParams): string => {
    const { 
      conversationId, 
      content, 
      isInternal = false, 
      channel = 'web_chat',
      whatsappConfig,
      senderName
    } = params;
    
    // 📊 OBSERVABILIDADE: Timestamp para medir latência
    const t0 = performance.now();
    
    // 🆕 ENTERPRISE V2: UM SÓ UUID (id === client_message_id)
    // Isso simplifica dedup e permite retry com mesmo ID
    const messageId = crypto.randomUUID();
    
    // 🆕 Usar nome do perfil do usuário logado (profile.full_name é a fonte correta)
    const effectiveSenderName = senderName || profile?.full_name || user?.user_metadata?.full_name || null;
    
    console.log('[SendInstant] 📤 Enviando:', {
      t0_ms: Math.round(t0),
      messageId,
      client_message_id: isEnterpriseV2 ? messageId : undefined,
      conversationId: conversationId.slice(0, 8),
      contentLength: content.length,
      isInternal,
      channel,
      hasWhatsApp: !!whatsappConfig,
      whatsappProvider: whatsappConfig?.provider,
      senderName: effectiveSenderName,
      enterpriseV2: isEnterpriseV2,
    });
    
    const optimisticMessage = {
      id: messageId,
      client_message_id: isEnterpriseV2 ? messageId : undefined, // 🆕 MESMO UUID
      conversation_id: conversationId,
      content: content,
      sender_type: 'user' as const,
      sender_id: user?.id || null,
      is_ai_generated: false,
      is_internal: isInternal,
      channel: channel,
      created_at: new Date().toISOString(),
      status: 'sending',
      media_attachments: [],
      sender: user ? {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email || 'Você',
        avatar_url: null,
        job_title: null,
      } : null,
    };

    // 2. ATUALIZAR CACHE ANTES DE QUALQUER OPERAÇÃO ASYNC
    // Isso faz a mensagem aparecer INSTANTANEAMENTE na UI
    queryClient.setQueryData(
      ["messages", conversationId],
      (old: any[] = []) => [...old, optimisticMessage]
    );

    // 2.1 ATUALIZAR inbox_view IMEDIATAMENTE para reordenar a lista
    // Isso faz a conversa subir para o topo da lista instantaneamente
    const nowISO = new Date().toISOString();
    queryClient.setQueriesData(
      { queryKey: ["inbox-view"], exact: false },
      (prev: any[] = []) => {
        const updated = prev.map(item => 
          item.conversation_id === conversationId 
            ? { 
                ...item, 
                last_snippet: content.slice(0, 100),
                last_message_at: nowISO,
                last_sender_type: 'user',
                updated_at: nowISO,
              } 
            : item
        );
        // Ordenar por updated_at DESC para mover conversa pro topo (não mutar)
        return [...updated].sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      }
    );

    // 3. FIRE-AND-FORGET: Processamento em background usando queueMicrotask
    // Isso garante que a UI seja atualizada ANTES da operação de rede
    queueMicrotask(async () => {
      const t1 = performance.now();
      let whatsappSuccess = false;
      let whatsappExternalId: string | null = null;
      let whatsappError: string | null = null;
      
      try {
        // Capturar o content EXATO no momento do envio (closure segura)
        const contentToSend = content;
        
        // ============================================
        // 3.1 WHATSAPP: Enviar via edge function PRIMEIRO
        // ============================================
        if (whatsappConfig) {
          const t_whatsapp_start = performance.now();
          
          try {
            if (whatsappConfig.provider === 'meta') {
              // Meta WhatsApp Cloud API
              console.log('[SendInstant] 📲 Meta WhatsApp - Enviando em background...');
              
              const metaPayload: Record<string, unknown> = {
                instance_id: whatsappConfig.instanceId,
                phone_number: whatsappConfig.phoneNumber,
                conversation_id: conversationId,
                skip_db_save: true, // Frontend faz o insert
                client_message_id: isEnterpriseV2 ? messageId : undefined, // 🆕 ENVIAR PARA RECONCILIAÇÃO
                sender_name: effectiveSenderName || undefined, // 🆕 Nome do agente para prefixar mensagem
              };

              // Adicionar conteúdo (texto ou mídia)
              if (whatsappConfig.media) {
                metaPayload.media = {
                  type: whatsappConfig.media.type,
                  url: whatsappConfig.media.url,
                  caption: contentToSend || undefined,
                  filename: whatsappConfig.media.filename,
                  mime_type: whatsappConfig.media.mimeType,
                };
              } else {
                metaPayload.message = contentToSend;
              }
              
              const { data: metaResponse, error: metaError } = await supabase.functions.invoke('send-meta-whatsapp', {
                body: metaPayload
              });
              
              if (metaError) throw new Error(metaError.message || 'Meta WhatsApp failed');
              
              whatsappSuccess = true;
              whatsappExternalId = metaResponse?.message_id || null;
              
              console.log('[SendInstant] ✅ Meta WhatsApp enviado:', {
                latency_ms: Math.round(performance.now() - t_whatsapp_start),
                external_id: whatsappExternalId,
              });
              
            } else if (whatsappConfig.provider === 'evolution') {
              // Evolution API (legacy)
              console.log('[SendInstant] 📲 Evolution API - Enviando em background...');
              
              const evolutionPayload: Record<string, unknown> = {
                instance_id: whatsappConfig.instanceId,
                phone_number: whatsappConfig.phoneNumber,
                use_queue: false, // Envio direto, sem fila
                skip_db_save: true, // Frontend faz o insert
              };

              // Adicionar conteúdo (texto ou mídia)
              if (whatsappConfig.media) {
                evolutionPayload.media_url = whatsappConfig.media.url;
                evolutionPayload.media_type = whatsappConfig.media.type;
                evolutionPayload.media_filename = whatsappConfig.media.filename;
                evolutionPayload.message = contentToSend || '';
              } else {
                evolutionPayload.message = contentToSend;
              }
              
              const { error: evolutionError } = await supabase.functions.invoke('send-whatsapp-message', {
                body: evolutionPayload
              });
              
              if (evolutionError) throw new Error(evolutionError.message || 'Evolution API failed');
              
              whatsappSuccess = true;
              
              console.log('[SendInstant] ✅ Evolution API enviado:', {
                latency_ms: Math.round(performance.now() - t_whatsapp_start),
              });
            }
          } catch (error) {
            whatsappError = error instanceof Error ? error.message : 'WhatsApp send failed';
            console.error('[SendInstant] ❌ WhatsApp falhou:', whatsappError);
            // Continua para salvar no banco com status 'failed'
          }
        }

        // ============================================
        // 3.2 PERSISTIR NO BANCO
        // ============================================
        // Base payload com campos obrigatórios
        const basePayload = {
          id: messageId,
          client_message_id: isEnterpriseV2 ? messageId : null, // 🆕 MESMO UUID
          conversation_id: conversationId,
          content: contentToSend,
          sender_type: 'user' as const,
          sender_id: user?.id || null,
          is_internal: isInternal,
          channel: channel as 'web_chat' | 'whatsapp' | 'email',
          // Campos condicionais
          status: (whatsappConfig && !whatsappSuccess) ? 'failed' as const : undefined,
          delivery_error: (whatsappConfig && !whatsappSuccess) ? whatsappError : undefined,
          external_id: whatsappExternalId || undefined,
          metadata: whatsappExternalId ? {
            whatsapp_provider: whatsappConfig?.provider,
            sent_via: 'sendInstant',
          } : undefined,
        };
        
        const { data: insertedMessage, error: insertError } = await supabase
          .from("messages")
          .insert([basePayload])
          .select()
          .single();

        if (insertError) throw insertError;
        
        const t2 = performance.now();

        // ✅ ACK EXPLÍCITO: Atualizar cache com dados confirmados + metadata
        const finalStatus = whatsappConfig 
          ? (whatsappSuccess ? 'sent' : 'failed')
          : 'sent';

        queryClient.setQueryData(
          ["messages", conversationId],
          (old: any[] = []) => old.map(m => 
            m.id === messageId ? { 
              ...m, 
              ...insertedMessage, 
              status: finalStatus,
              // ACK metadata para debugging
              _ack: { 
                timestamp: new Date().toISOString(),
                messageId: insertedMessage.id,
                dbLatency_ms: Math.round(t2 - t1),
                whatsappSuccess,
                whatsappExternalId,
              }
            } : m
          )
        );
        
        console.log('[SendInstant] ✅ Persistido:', {
          messageId,
          dbLatency_ms: Math.round(t2 - t1),
          totalLatency_ms: Math.round(t2 - t0),
          whatsappSuccess,
          finalStatus,
        });

        // Update last_message_at (também em background, não bloqueia)
        if (!isInternal) {
          supabase
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", conversationId)
            .then(({ error }) => {
              if (error) console.error('[SendInstant] Failed to update last_message_at:', error);
            });

          // 🆕 AUTO-ASSIGN: Se agente enviou mensagem sem clicar "Assumir",
          // auto-atribuir a conversa via RPC segura (SECURITY DEFINER)
          supabase
            .rpc('auto_assign_on_send', { p_conversation_id: conversationId })
            .then(({ data, error }) => {
              if (error) {
                console.error('[SendInstant] auto_assign_on_send error:', error);
                return;
              }
              const result = data as { assigned: boolean; assigned_to?: string; previous_ai_mode?: string } | null;
              if (result?.assigned) {
                console.log('[SendInstant] ✅ Auto-assigned conversa:', {
                  conversationId: conversationId.slice(0, 8),
                  previous_ai_mode: result.previous_ai_mode,
                });

                // 🛡️ CANCELAR FLOW STATES RESIDUAIS para evitar que IA retome controle
                supabase
                  .from('chat_flow_states')
                  .update({ status: 'cancelled', completed_at: new Date().toISOString() })
                  .eq('conversation_id', conversationId)
                  .in('status', ['waiting_input', 'active', 'in_progress'])
                  .then(({ error: flowError }) => {
                    if (flowError) {
                      console.error('[SendInstant] Erro ao cancelar flow states:', flowError);
                    } else {
                      console.log('[SendInstant] 🛡️ Flow states residuais cancelados');
                      queryClient.invalidateQueries({ queryKey: ["active-flow-state", conversationId] });
                    }
                  });

                // Atualizar caches para refletir mudança
                queryClient.invalidateQueries({ queryKey: ["conversations"] });
                queryClient.invalidateQueries({ queryKey: ["ai-mode", conversationId] });
                queryClient.invalidateQueries({ queryKey: ["inbox-view"] });
              }
            });
        }

        // Se WhatsApp falhou, mostrar toast
        if (whatsappConfig && !whatsappSuccess) {
          toast({
            title: "Falha no envio WhatsApp",
            description: whatsappError || 'Erro desconhecido',
            variant: "destructive",
          });
        }

      } catch (error) {
        const t2 = performance.now();
        const errorMessage = error instanceof Error ? error.message : 'Unknown';
        const isRlsError = errorMessage.toLowerCase().includes('row-level security') ||
                          errorMessage.toLowerCase().includes('rls');
        
        console.error('[SendInstant] ❌ Falha:', {
          messageId,
          error: errorMessage,
          isRlsError,
          latency_ms: Math.round(t2 - t1),
        });
        
        // Marcar como falhou no cache (NÃO remover - manter visível com status failed)
        queryClient.setQueryData(
          ["messages", conversationId],
          (old: any[] = []) => old.map(m => 
            m.id === messageId ? { 
              ...m, 
              status: 'failed',
              delivery_error: isRlsError 
                ? 'Sem permissão para enviar nesta conversa'
                : errorMessage,
            } : m
          )
        );
        
        // Toast com mensagem específica para erro de RLS
        if (isRlsError) {
          toast({
            title: "Sem permissão para enviar",
            description: "Você precisa assumir esta conversa antes de enviar mensagens. Clique em 'Assumir' ou peça a um gestor.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro ao enviar mensagem",
            description: errorMessage,
            variant: "destructive",
          });
        }
      }
    });

    // RETORNA IMEDIATAMENTE - não aguarda persistência
    return messageId;
  }, [queryClient, user, profile, toast, isEnterpriseV2]);

  // Função para reenviar mensagens que falharam
  const retrySend = useCallback(async (messageId: string, conversationId: string) => {
    const messages = queryClient.getQueryData<any[]>(["messages", conversationId]) || [];
    const failedMessage = messages.find(m => m.id === messageId && m.status === 'failed');
    
    if (!failedMessage) return;

    // Atualizar status para sending
    queryClient.setQueryData(
      ["messages", conversationId],
      (old: any[] = []) => old.map(m => 
        m.id === messageId ? { ...m, status: 'sending' } : m
      )
    );

    try {
      const { error } = await supabase
        .from("messages")
        .insert([{
          id: messageId,
          conversation_id: conversationId,
          content: failedMessage.content,
          sender_type: 'user' as const,
          sender_id: user?.id || null,
          is_internal: failedMessage.is_internal || false,
          channel: (failedMessage.channel || 'web_chat') as 'web_chat' | 'whatsapp' | 'email',
        }]);

      if (error) throw error;

      queryClient.setQueryData(
        ["messages", conversationId],
        (old: any[] = []) => old.map(m => 
          m.id === messageId ? { ...m, status: 'sent' } : m
        )
      );

      toast({
        title: "Mensagem reenviada",
        description: "A mensagem foi enviada com sucesso.",
      });

    } catch (error) {
      queryClient.setQueryData(
        ["messages", conversationId],
        (old: any[] = []) => old.map(m => 
          m.id === messageId ? { ...m, status: 'failed' } : m
        )
      );

      toast({
        title: "Falha ao reenviar",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive",
      });
    }
  }, [queryClient, user, toast]);

  return { sendInstant, retrySend };
}
