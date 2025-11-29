import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CriticalClient {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  total_ltv: number;
  last_contact_date: string | null;
  consultant_name: string | null;
  consultant_avatar: string | null;
}

export function useCriticalClients() {
  return useQuery({
    queryKey: ["critical-clients"],
    queryFn: async () => {
      // Get clients with red health status and high LTV
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data: clients, error } = await supabase
        .from("contacts")
        .select(`
          *,
          consultant:profiles!contacts_consultant_id_fkey(full_name, avatar_url)
        `)
        .eq("status", "customer")
        .or(`last_contact_date.is.null,last_contact_date.lt.${fourteenDaysAgo.toISOString()}`)
        .order("total_ltv", { ascending: false, nullsFirst: false })
        .limit(10);

      if (error) throw error;

      return (clients || []).map((client) => ({
        id: client.id,
        first_name: client.first_name,
        last_name: client.last_name,
        avatar_url: client.avatar_url,
        email: client.email,
        phone: client.phone,
        total_ltv: client.total_ltv || 0,
        last_contact_date: client.last_contact_date,
        consultant_name: client.consultant?.full_name || null,
        consultant_avatar: client.consultant?.avatar_url || null,
      })) as CriticalClient[];
    },
    staleTime: 2 * 60 * 1000,
  });
}
