import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

/**
 * Hook para buscar o modo AI atual de uma conversa e subscrevê-la em realtime
 */
export function useAIMode(conversationId: string | null) {
  const query = useQuery({
    queryKey: ["ai-mode", conversationId],
    queryFn: async () => {
      if (!conversationId) return null;

      const { data, error } = await supabase
        .from("conversations")
        .select("ai_mode")
        .eq("id", conversationId)
        .single();

      if (error) throw error;
      return data?.ai_mode as "autopilot" | "copilot" | "disabled" | "waiting_human" | null;
    },
    enabled: !!conversationId,
  });

  // Realtime subscription para mudanças no ai_mode
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`ai-mode-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('[useAIMode] Realtime update:', payload);
          // Invalidar query para refetch
          query.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return query;
}
