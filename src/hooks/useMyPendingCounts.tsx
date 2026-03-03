import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface MyPendingCounts {
  inbox: number;
  tickets: number;
  deals: number;
}

export function useMyPendingCounts() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["my-pending-counts", user?.id],
    queryFn: async (): Promise<MyPendingCounts> => {
      if (!user?.id) {
        return { inbox: 0, tickets: 0, deals: 0 };
      }

      // Buscar contagem de inbox (conversas não lidas atribuídas ao usuário)
      const { count: inboxCount, error: inboxError } = await supabase
        .from("inbox_view")
        .select("conversation_id", { count: "exact", head: true })
        .eq("assigned_to", user.id)
        .gt("unread_count", 0);

      if (inboxError) {
        console.error("Erro ao buscar contagem de inbox:", inboxError);
      }

      // Buscar contagem de tickets pendentes atribuídos ao usuário
      const { count: ticketsCount, error: ticketsError } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", user.id)
        .not("status", "in", '("resolved","closed")');

      if (ticketsError) {
        console.error("Erro ao buscar contagem de tickets:", ticketsError);
      }

      // Buscar contagem de deals ativos atribuídos ao usuário
      const { count: dealsCount, error: dealsError } = await supabase
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", user.id)
        .not("status", "in", '("won","lost")');

      if (dealsError) {
        console.error("Erro ao buscar contagem de deals:", dealsError);
      }

      return {
        inbox: inboxCount || 0,
        tickets: ticketsCount || 0,
        deals: dealsCount || 0,
      };
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Backup: refetch a cada 30 segundos
    staleTime: 10000,
  });

  // Realtime subscriptions para atualização instantânea
  useEffect(() => {
    if (!user?.id) return;

    const inboxChannel = supabase
      .channel("inbox-badge-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inbox_view",
          filter: `assigned_to=eq.${user.id}`,
        },
        () => {
          query.refetch();
        }
      )
      .subscribe();

    const ticketsChannel = supabase
      .channel("tickets-badge-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: `assigned_to=eq.${user.id}`,
        },
        () => {
          query.refetch();
        }
      )
      .subscribe();

    const dealsChannel = supabase
      .channel("deals-badge-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deals",
          filter: `assigned_to=eq.${user.id}`,
        },
        () => {
          query.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(inboxChannel);
      supabase.removeChannel(ticketsChannel);
      supabase.removeChannel(dealsChannel);
    };
  }, [user?.id, query.refetch]);

  return query;
}
