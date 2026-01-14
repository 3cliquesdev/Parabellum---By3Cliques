import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTicketsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("tickets-global-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
        },
        (payload) => {
          console.log("[Realtime] Ticket changed:", payload.new);
          
          // Queries principais de listagem
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
          queryClient.invalidateQueries({ queryKey: ["ticket-counts"] });
          
          // Query do ticket individual (para /support/:ticketId)
          const ticketId = (payload.new as any)?.id;
          if (ticketId) {
            queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
            queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticketId] });
            queryClient.invalidateQueries({ queryKey: ["ticket-events", ticketId] });
          }
          
          // Invalidar queries relacionadas usando predicate abrangente
          queryClient.invalidateQueries({
            predicate: (query) => {
              const key = query.queryKey[0];
              return typeof key === 'string' && (
                key.startsWith("ticket") ||
                key === "contact-tickets" ||
                key === "tickets-prefetch"
              );
            }
          });
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] Tickets channel status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
