import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TicketEvent {
  id: string;
  ticket_id: string;
  event_type: 'created' | 'assigned' | 'status_changed' | 'priority_changed' | 'comment_added' | 'transferred' | 'merged';
  actor_id: string | null;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, any>;
  created_at: string;
  actor?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

export function useTicketEvents(ticketId: string | undefined) {
  return useQuery({
    queryKey: ["ticket-events", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];

      const { data, error } = await supabase
        .from("ticket_events")
        .select(`
          *,
          actor:profiles!ticket_events_actor_id_fkey(
            id,
            full_name,
            avatar_url
          )
        `)
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as TicketEvent[];
    },
    enabled: !!ticketId,
  });
}
