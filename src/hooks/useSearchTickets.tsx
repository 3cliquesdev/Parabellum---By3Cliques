import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSearchTickets(searchTerm: string, excludeTicketId?: string) {
  return useQuery({
    queryKey: ["tickets", "search", searchTerm, excludeTicketId],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];

      // Normalizar busca por número de ticket
      let ticketNumberPattern = searchTerm;
      if (/^\d+$/.test(searchTerm)) {
        // Se for só números, adicionar zeros para completar 5 dígitos
        ticketNumberPattern = searchTerm.padStart(5, '0');
      }

      let query = supabase
        .from("tickets")
        .select(`
          id,
          ticket_number,
          subject,
          status,
          priority,
          created_at,
          customer:contacts(id, first_name, last_name, email),
          department:departments(id, name)
        `)
        .in("status", ["open", "in_progress", "waiting_customer"])
        .is("merged_to_ticket_id", null); // Excluir tickets já mesclados

      // Excluir o ticket atual
      if (excludeTicketId) {
        query = query.neq("id", excludeTicketId);
      }

      // Buscar por ID, assunto ou número do ticket
      const { data, error } = await query
        .or(`subject.ilike.%${searchTerm}%,ticket_number.ilike.%${ticketNumberPattern}%,id.eq.${searchTerm}`)
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: searchTerm.length >= 2,
  });
}