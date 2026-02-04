import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ContactResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface SearchResponse {
  contacts: ContactResult[];
  error?: string;
}

/**
 * Hook otimizado para buscar contatos na criação de tickets.
 * Usa Edge Function com SERVICE_ROLE para bypassar RLS e evitar timeouts.
 */
export function useSearchContactsForTicket(searchTerm: string) {
  return useQuery({
    queryKey: ["contacts-for-ticket", searchTerm],
    queryFn: async (): Promise<ContactResult[]> => {
      if (!searchTerm || searchTerm.length < 2) {
        return [];
      }

      console.log(`[useSearchContactsForTicket] Searching: "${searchTerm}"`);

      const { data, error } = await supabase.functions.invoke<SearchResponse>(
        "search-contacts-for-ticket",
        {
          body: { searchTerm },
        }
      );

      if (error) {
        console.error("[useSearchContactsForTicket] Error:", error.message);
        // Return empty array instead of throwing to avoid UI errors
        return [];
      }

      if (data?.error) {
        console.error("[useSearchContactsForTicket] API Error:", data.error);
        return [];
      }

      console.log(`[useSearchContactsForTicket] Found ${data?.contacts?.length || 0} contacts`);
      return data?.contacts || [];
    },
    enabled: searchTerm.length >= 2,
    staleTime: 30_000, // Cache for 30 seconds
    gcTime: 60_000, // Keep in cache for 1 minute
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
}
