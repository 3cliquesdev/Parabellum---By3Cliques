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
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          sender:profiles!sender_id(
            id,
            full_name,
            avatar_url,
            job_title
          )
        `)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as any[];
    },
    enabled: !!conversationId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          console.log("New message received:", payload);
          const newMessage = payload.new as Message;
          
          // 🚨 FASE 2: INTERCEPTADOR DE FALLBACK NO FRONTEND
          if (newMessage.is_ai_generated) {
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
              console.log('🚨 [Frontend] Fallback detectado na mensagem da IA - Forçando handoff');
              
              try {
                // 1. Forçar route-conversation
                const { error: routeError } = await supabase.functions.invoke('route-conversation', {
                  body: { conversationId }
                });
                
                if (!routeError) {
                  console.log('✅ [Frontend] Handoff forçado via interceptador');
                  
                  // 2. Invalidar queries para atualizar UI
                  queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
                  queryClient.invalidateQueries({ queryKey: ["conversations"] });
                } else {
                  console.error('❌ [Frontend] Erro ao forçar handoff:', routeError);
                }
              } catch (error) {
                console.error('❌ [Frontend] Exceção ao forçar handoff:', error);
              }
            }
          }
          
          queryClient.setQueryData(
            ["messages", conversationId],
            (old: Message[] | undefined) => {
              if (!old) return [newMessage];
              return [...old, newMessage];
            }
          );

          // Update conversation's last_message_at
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }
      )
      .subscribe();

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
      // ✅ FASE 2: Garantir canal para mensagens Web Chat
      // ✅ FASE 7: Suporte a is_internal
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

      // Update conversation's last_message_at (apenas se não for nota interna)
      if (!message.is_internal) {
        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", message.conversation_id);
      }

      return data;
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
