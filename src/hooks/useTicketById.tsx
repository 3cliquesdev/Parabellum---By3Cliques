import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TICKET_SELECT } from "@/lib/select-fields";

export function useTicketById(ticketId: string | undefined) {
  return useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: async ({ signal }) => {
      if (!ticketId) throw new Error('Ticket ID is required');
      
      const { data, error } = await supabase
        .from('tickets')
        .select(TICKET_SELECT)
        .eq('id', ticketId)
        .abortSignal(signal)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Ticket not found');
      
      return data;
    },
    enabled: !!ticketId,
    staleTime: 60_000,
  });
}
