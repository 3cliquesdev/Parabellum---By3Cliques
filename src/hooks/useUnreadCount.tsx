import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// FASE 3: Hook para contagem de mensagens não lidas por conversa
export function useUnreadCount(conversationIds: string[]) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["unread-counts", conversationIds.sort().join(",")],
    queryFn: async () => {
      if (!conversationIds.length) return {};

      // Buscar mensagens não lidas (is_read=false, sender_type='contact')
      const { data, error } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", conversationIds)
        .eq("sender_type", "contact")
        .eq("is_read", false);

      if (error) throw error;

      // Agrupar contagem por conversation_id
      const counts: Record<string, number> = {};
      data?.forEach((msg) => {
        counts[msg.conversation_id] = (counts[msg.conversation_id] || 0) + 1;
      });

      return counts;
    },
    enabled: conversationIds.length > 0,
    staleTime: 10000, // 10 seconds
  });

  // Realtime subscription para novas mensagens
  useEffect(() => {
    if (!conversationIds.length) return;

    const channel = supabase
      .channel("unread-counts-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const msg = payload.new as any;
          if (msg && conversationIds.includes(msg.conversation_id)) {
            // Invalidar para recarregar contagens
            queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationIds, queryClient]);

  return query;
}

// Hook para marcar mensagens como lidas
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  const markAsRead = async (conversationId: string) => {
    const { error } = await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .eq("sender_type", "contact")
      .eq("is_read", false);

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
    }
  };

  return { markAsRead };
}
