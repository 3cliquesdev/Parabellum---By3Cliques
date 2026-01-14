import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type Message = Tables<"messages">;
type MessageInsert = TablesInsert<"messages">;

export function useMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      // FASE 4: Join com profiles para buscar nome/avatar do remetente
      // FASE 5: Join com media_attachments para buscar anexos (imagens, áudios, vídeos)
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
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as any[];
    },
    enabled: !!conversationId,
  });

  // Realtime subscription - usando padrão do useProfilesRealtime
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-realtime-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Todos eventos: INSERT, UPDATE, DELETE
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          console.log("[Realtime] Message changed:", payload.eventType, payload.new);
          const newMessage = payload.new as Message;
          const oldMessage = payload.old as Message;
          
          // ✨ MERGE OTIMISTA - Sem refetch, atualiza cache diretamente
          if (payload.eventType === 'INSERT') {
            queryClient.setQueryData(
              ["messages", conversationId],
              (old: any[] = []) => {
                // Verificar se já existe (optimistic ou real)
                const existsReal = old.some(m => m.id === newMessage.id);
                if (existsReal) return old;
                
                // Substituir mensagem temporária pela real
                const tempIndex = old.findIndex(m => 
                  m.id?.startsWith('temp-') && 
                  m.content === newMessage.content &&
                  m.sender_id === newMessage.sender_id
                );
                
                if (tempIndex !== -1) {
                  const updated = [...old];
                  updated[tempIndex] = { ...newMessage, status: 'sent' };
                  return updated;
                }
                
                // Nova mensagem (de outro usuário/sistema)
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
          
          // Atualizar sidebar com debounce (baixa prioridade)
          queryClient.invalidateQueries({ 
            queryKey: ["conversations"],
            refetchType: 'active'
          });
          queryClient.invalidateQueries({ 
            queryKey: ["conversation", conversationId],
            refetchType: 'active'
          });
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Messages channel status for ${conversationId}:`, status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

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
      const messageWithChannel = {
        ...message,
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

      const previousMessages = queryClient.getQueryData<any[]>(
        ["messages", newMessage.conversation_id]
      );

      const optimisticMessage = {
        id: `temp-${Date.now()}`,
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

    // Sincronizar após sucesso (não bloqueia UI)
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["messages", variables.conversation_id] 
      });
    },
  });
}
