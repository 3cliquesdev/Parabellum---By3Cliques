import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTicketById(ticketId: string | undefined) {
  return useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: async () => {
      if (!ticketId) throw new Error('Ticket ID is required');
      
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          customer:contacts(id, first_name, last_name, email, phone, avatar_url, company, address, city, state, zip_code),
          assigned_user:profiles!tickets_assigned_to_fkey(id, full_name, avatar_url),
          created_by_user:profiles!tickets_created_by_fkey(id, full_name, avatar_url),
          department:departments!tickets_department_id_fkey(id, name, color),
          requesting_department:departments!tickets_requesting_department_id_fkey(id, name, color),
          operation:ticket_operations(id, name, color),
          origin:ticket_origins!tickets_origin_id_fkey(id, name, color)
        `)
        .eq('id', ticketId)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Ticket not found');
      
      return data;
    },
    enabled: !!ticketId,
  });
}
