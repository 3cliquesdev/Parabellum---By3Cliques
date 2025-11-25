import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTicketComments(ticketId: string | null) {
  return useQuery({
    queryKey: ["ticket-comments", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];

      const { data, error } = await supabase
        .from("ticket_comments")
        .select(`
          *,
          created_by_user:profiles!ticket_comments_created_by_fkey(
            id,
            full_name,
            avatar_url
          )
        `)
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!ticketId,
  });
}
