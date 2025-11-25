import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useContactTickets(contactId: string | null) {
  return useQuery({
    queryKey: ["contact-tickets", contactId],
    queryFn: async () => {
      if (!contactId) return [];

      const { data, error } = await supabase
        .from("tickets")
        .select(`
          *,
          assigned_user:profiles!tickets_assigned_to_fkey(
            id,
            full_name,
            avatar_url
          )
        `)
        .eq("customer_id", contactId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: !!contactId,
  });
}
