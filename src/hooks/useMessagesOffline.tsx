import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";

export function useMessagesOffline(conversationId: string | null) {
  const queryClient = useQueryClient();

  // 1. Buscar do IndexedDB (instantâneo, 0ms)
  const cachedMessages = useLiveQuery(
    () => conversationId 
      ? db.messages.where('conversation_id').equals(conversationId).sortBy('created_at')
      : Promise.resolve([]),
    [conversationId]
  );

  // 2. Sincronizar com Supabase em background
  const { data: serverMessages, error: serverError } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      try {
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

        if (error) {
          console.error('[useMessagesOffline] Erro ao buscar mensagens:', error);
          return null; // ✅ Retorna null ao invés de throw - fallback para cache
        }

        // Salvar no IndexedDB para próximo acesso offline
        if (data) {
          await db.messages.bulkPut(
            data.map(m => ({ 
              id: m.id,
              conversation_id: m.conversation_id,
              content: m.content,
              sender_type: m.sender_type,
              sender_id: m.sender_id || undefined,
              is_ai_generated: m.is_ai_generated || false,
              created_at: m.created_at,
              synced: true 
            }))
          );
        }

        return data;
      } catch (err) {
        console.error('[useMessagesOffline] Erro ao sincronizar:', err);
        return null; // ✅ Fallback para cache em caso de erro
      }
    },
    enabled: !!conversationId && navigator.onLine,
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
          queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  // 3. Retornar dados mais recentes (server > cache)
  return {
    messages: serverMessages ?? cachedMessages ?? [],
    isOffline: !navigator.onLine,
    hasError: !!serverError
  };
}

// Hook para mensagens pendentes na fila
export function usePendingMessages(conversationId: string | null) {
  return useLiveQuery(
    () => conversationId
      ? db.messageQueue
          .where('conversation_id').equals(conversationId)
          .and(m => m.status === 'pending' || m.status === 'sending')
          .toArray()
      : Promise.resolve([]),
    [conversationId]
  );
}
