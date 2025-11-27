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
        (payload) => {
          console.log("New message received:", payload);
          queryClient.setQueryData(
            ["messages", conversationId],
            (old: Message[] | undefined) => {
              if (!old) return [payload.new as Message];
              return [...old, payload.new as Message];
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

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (message: MessageInsert & { status?: 'sending' | 'sent' | 'failed'; delivery_error?: string | null }) => {
      const { data, error } = await supabase
        .from("messages")
        .insert(message)
        .select()
        .single();

      if (error) throw error;

      // Update conversation's last_message_at
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", message.conversation_id);

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
