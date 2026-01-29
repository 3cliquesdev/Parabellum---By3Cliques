import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type Message = Tables<"messages">;
type MessageInsert = TablesInsert<"messages">;

export function useMessages(conversationId: string | null) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  // 🛡️ PROTEÇÃO ANTI-DUPLICAÇÃO: Rastrear IDs já processados (30s window)
  const processedIdsRef = useRef(new Set<string>());
  
  // 🔄 REALTIME ROBUSTNESS: Rastrear estado de conexão e reconexão
  const reconnectAttemptsRef = useRef(0);
  const isConnectedRef = useRef(false);
  const lastMessageTimestampRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      // HISTÓRICO COMPLETO: Carregar TODAS as mensagens sem limite artificial
      // Supabase tem limite padrão de 1000 - removemos para preservar histórico
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          sender:profiles!sender_id(
            id,
            full_name,
            avatar_url,
            job_title
          ),
          media_attachments(
            id,
            storage_path,
            storage_bucket,
            mime_type,
            original_filename,
            file_size,
            status,
            waveform_data,
            duration_seconds
          )
        `)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(10000); // Limite alto para garantir histórico completo

      if (error) throw error;
      
      // Atualizar timestamp da última mensagem para catch-up
      if (data && data.length > 0) {
        lastMessageTimestampRef.current = data[data.length - 1].created_at;
      }
      
      return data as any[];
    },
    enabled: !!conversationId,
    // PRESERVAÇÃO DE HISTÓRICO: Manter cache por mais tempo para não perder mensagens
    staleTime: 1000 * 60 * 5, // 5 minutos - dados são considerados frescos
    gcTime: 1000 * 60 * 30, // 30 minutos - manter em cache mesmo após inativo
    refetchOnWindowFocus: true, // Recarregar ao voltar para a aba
    refetchOnReconnect: true, // Recarregar ao reconectar internet
    // 🔄 FALLBACK POLLING: Para quando Realtime falha no publicado
    // Não usar ref aqui - usar polling fixo de 5s como safety net
    refetchInterval: 5000, // Poll a cada 5s como backup do Realtime
  });

  // 🔄 CATCH-UP: Buscar mensagens perdidas após reconexão
  const runCatchUp = useCallback(async () => {
    if (!conversationId || !lastMessageTimestampRef.current) return;
    
    console.log(`[Realtime] 🔄 Running catch-up from ${lastMessageTimestampRef.current}`);
    
    try {
      const { data: newMessages, error } = await supabase
        .from("messages")
        .select(`
          *,
          sender:profiles!sender_id(id, full_name, avatar_url, job_title),
          media_attachments(id, storage_path, storage_bucket, mime_type, original_filename, file_size, status, waveform_data, duration_seconds)
        `)
        .eq("conversation_id", conversationId)
        .gt("created_at", lastMessageTimestampRef.current)
        .order("created_at", { ascending: true });
      
      if (error) {
        console.error("[Realtime] Catch-up error:", error);
        return;
      }
      
      if (newMessages && newMessages.length > 0) {
        console.log(`[Realtime] ✅ Catch-up found ${newMessages.length} new messages`);
        
        queryClient.setQueryData(
          ["messages", conversationId],
          (old: any[] = []) => {
            const existingIds = new Set(old.map(m => m.id));
            const newOnes = newMessages.filter(m => !existingIds.has(m.id));
            if (newOnes.length === 0) return old;
            
            // Marcar como processados
            newOnes.forEach(m => {
              processedIdsRef.current.add(m.id);
              setTimeout(() => processedIdsRef.current.delete(m.id), 30000);
            });
            
            return [...old, ...newOnes.map(m => ({ ...m, status: 'sent' }))];
          }
        );
        
        // Atualizar timestamp
        lastMessageTimestampRef.current = newMessages[newMessages.length - 1].created_at;
        
        // Atualizar inbox também
        const lastMsg = newMessages[newMessages.length - 1];
        queryClient.setQueriesData<any[]>(
          { queryKey: ["inbox-view"], exact: false },
          (prev = []) => {
            const updated = prev.map(item => 
              item.conversation_id === conversationId 
                ? { 
                    ...item, 
                    last_snippet: lastMsg.content?.slice(0, 100) || '',
                    last_message_at: lastMsg.created_at,
                    last_sender_type: lastMsg.sender_type,
                    updated_at: lastMsg.created_at,
                  } 
                : item
            );
            return [...updated].sort((a, b) => 
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            );
          }
        );
      }
    } catch (err) {
      console.error("[Realtime] Catch-up failed:", err);
    }
  }, [conversationId, queryClient]);

  // Realtime subscription - ROBUSTEZ PARA PUBLICADO
  useEffect(() => {
    if (!conversationId) return;

    // Limpar canal existente antes de criar novo (evita duplicação)
    if (channelRef.current) {
      console.log(`[Realtime] Removing existing channel for ${conversationId}`);
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      isConnectedRef.current = false;
    }

    const setupChannel = () => {
      const channel = supabase
        .channel(`messages-realtime-${conversationId}`, {
          config: {
            broadcast: { self: false },
            presence: { key: conversationId },
          },
        })
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          async (payload) => {
            const newMessage = payload.new as Message;
            const oldMessage = payload.old as Message;
            
            // 🛡️ PROTEÇÃO 1: Ignorar se já processado nesta sessão
            if (payload.eventType === 'INSERT' && processedIdsRef.current.has(newMessage.id)) {
              console.log('[Realtime] ⏭️ ID já processado, ignorando:', newMessage.id);
              return;
            }
            
            // Marcar como processado (limpar após 30s)
            if (payload.eventType === 'INSERT') {
              processedIdsRef.current.add(newMessage.id);
              setTimeout(() => processedIdsRef.current.delete(newMessage.id), 30000);
              
              // Atualizar timestamp
              if (newMessage.created_at) {
                lastMessageTimestampRef.current = newMessage.created_at;
              }
            }
            
            console.log("[Realtime] Message changed:", payload.eventType, newMessage?.id);
            
            // ✨ MERGE OTIMISTA - Sem refetch, atualiza cache diretamente
            if (payload.eventType === 'INSERT') {
              queryClient.setQueryData(
                ["messages", conversationId],
                (old: any[] = []) => {
                  // 1. Verificar se já existe por ID (evitar duplicatas)
                  const existingIndex = old.findIndex(m => m.id === newMessage.id);
                  
                  if (existingIndex !== -1) {
                    // Mensagem já existe - atualizar com dados do servidor
                    console.log('[Realtime] Atualizando mensagem existente:', newMessage.id);
                    const updated = [...old];
                    updated[existingIndex] = { 
                      ...updated[existingIndex], 
                      ...newMessage, 
                      status: 'sent' 
                    };
                    return updated;
                  }
                  
                  // 🛡️ PROTEÇÃO 2: Verificar mensagem pendente com mesmo conteúdo (race condition)
                  const pendingMatch = old.find(m => 
                    (m.status === 'sending' || m.status === 'streaming') &&
                    m.content === newMessage.content &&
                    Math.abs(new Date(m.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 5000
                  );
                  
                  if (pendingMatch) {
                    console.log('[Realtime] Reconciliando mensagem pendente:', pendingMatch.id, '→', newMessage.id);
                    return old.map(m => 
                      m.id === pendingMatch.id 
                        ? { ...m, ...newMessage, status: 'sent' } 
                        : m
                    );
                  }
                  
                  // 3. Verificar duplicata por external_id (wamid)
                  if (newMessage.external_id && old.some(m => m.external_id === newMessage.external_id)) {
                    console.log('[Realtime] Ignorando duplicata por external_id:', newMessage.external_id);
                    return old;
                  }
                  
                  // 4. Nova mensagem (outro usuário/cliente)
                  console.log('[Realtime] Nova mensagem:', newMessage.id);
                  return [...old, { ...newMessage, status: 'sent' }];
                }
              );
            } else if (payload.eventType === 'UPDATE') {
              queryClient.setQueryData(
                ["messages", conversationId],
                (old: any[] = []) => old.map(m => 
                  m.id === newMessage.id ? { ...m, ...newMessage } : m
                )
              );
            } else if (payload.eventType === 'DELETE' && oldMessage) {
              queryClient.setQueryData(
                ["messages", conversationId],
                (old: any[] = []) => old.filter(m => m.id !== oldMessage.id)
              );
            }
            
            // 🚨 INTERCEPTADOR DE FALLBACK (apenas para INSERT de IA)
            if (payload.eventType === 'INSERT' && newMessage.is_ai_generated) {
              const content = newMessage.content?.toLowerCase() || '';
              const fallbackPhrases = [
                'vou chamar um especialista',
                'transferir para um atendente',
                'não consegui registrar',
                'não tenho essa informação',
                'transferindo você',
                'chamar um atendente humano'
              ];
              
              const isFallbackMessage = fallbackPhrases.some(phrase => content.includes(phrase));
              
              if (isFallbackMessage) {
                console.log('🚨 [Frontend] Fallback detectado - Forçando handoff');
                try {
                  await supabase.functions.invoke('route-conversation', {
                    body: { conversationId }
                  });
                } catch (error) {
                  console.error('❌ [Frontend] Erro ao forçar handoff:', error);
                }
              }
            }
            
            // ✨ MERGE OTIMISTA NO INBOX - Só atualiza se a conversa ainda não foi atualizada pelo listener global
            // NOTA: O useInboxView.tsx também tem um listener global que atualiza snippets
            // Isso é redundante mas inofensivo - setQueriesData é idempotente com os mesmos dados
          }
        )
        .subscribe((status, err) => {
          console.log(`[Realtime] Messages channel status for ${conversationId}:`, status, err || '');
          
          if (status === 'SUBSCRIBED') {
            isConnectedRef.current = true;
            reconnectAttemptsRef.current = 0;
            console.log(`[Realtime] ✅ Connected to messages channel`);
            
            // Executar catch-up após reconexão bem-sucedida
            runCatchUp();
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            isConnectedRef.current = false;
            console.warn(`[Realtime] ⚠️ Channel disconnected, will use polling fallback`);
            
            // Forçar refetch imediato como fallback
            queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
          }
        });

      channelRef.current = channel;
    };

    setupChannel();

    // 🔄 HEARTBEAT: Verificar conexão a cada 30s e fazer catch-up se necessário
    const heartbeatInterval = setInterval(() => {
      if (isConnectedRef.current) {
        // Fazer catch-up preventivo para garantir sincronização
        runCatchUp();
      }
    }, 30000);

    return () => {
      console.log(`[Realtime] 🧹 Cleanup: Removing channel messages-realtime-${conversationId}`);
      clearInterval(heartbeatInterval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      isConnectedRef.current = false;
      // Limpar processedIds para esta conversa
      processedIdsRef.current.clear();
    };
  }, [conversationId, queryClient, runCatchUp]);

  return query;
}

// FASE 7: Tipo estendido para suportar is_internal
type SendMessageParams = MessageInsert & { 
  status?: 'sending' | 'sent' | 'failed'; 
  delivery_error?: string | null;
  is_internal?: boolean;
};

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (message: SendMessageParams) => {
      // Garantir ID estável gerado no cliente para evitar mismatch entre otimista e realtime
      // (impede troca de mensagens em envios rápidos)
      const ensuredId = (message as any).id || crypto.randomUUID();

      const messageWithChannel = {
        ...message,
        id: ensuredId,
        channel: message.channel || 'web_chat',
        is_internal: message.is_internal || false,
      };

      const { data, error } = await supabase
        .from("messages")
        .insert(messageWithChannel)
        .select()
        .single();

      if (error) throw error;

      if (!message.is_internal) {
        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", message.conversation_id);
      }

      return data;
    },

    // ✨ OPTIMISTIC UPDATE - Mensagem aparece INSTANTANEAMENTE
    onMutate: async (newMessage) => {
      await queryClient.cancelQueries({ 
        queryKey: ["messages", newMessage.conversation_id] 
      });

      // Mutar o objeto de variáveis para que mutationFn use o mesmo ID.
      // Isso é intencional: garante consistência entre cache otimista, insert e realtime.
      if (!(newMessage as any).id) {
        (newMessage as any).id = crypto.randomUUID();
      }

      const previousMessages = queryClient.getQueryData<any[]>(
        ["messages", newMessage.conversation_id]
      );

      const optimisticMessage = {
        id: (newMessage as any).id,
        conversation_id: newMessage.conversation_id,
        content: newMessage.content,
        sender_type: newMessage.sender_type,
        sender_id: newMessage.sender_id,
        is_ai_generated: false,
        is_internal: newMessage.is_internal || false,
        channel: newMessage.channel || 'web_chat',
        created_at: new Date().toISOString(),
        status: 'sending',
        media_attachments: [],
        sender: null,
      };

      queryClient.setQueryData(
        ["messages", newMessage.conversation_id],
        (old: any[] = []) => [...old, optimisticMessage]
      );

      return { previousMessages };
    },

    // Rollback em caso de erro
    onError: (error: Error, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ["messages", variables.conversation_id],
          context.previousMessages
        );
      }
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },

    // ✅ NÃO fazer invalidateQueries - realtime com merge otimista já atualiza tudo
    onSettled: () => {
      // Nada a fazer - mensagens são atualizadas via realtime
      // Inbox é atualizado via setQueriesData no handler de realtime
    },
  });
}
