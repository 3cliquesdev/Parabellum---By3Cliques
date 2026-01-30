import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { InboxViewItem } from "@/hooks/useInboxView";

const QUERY_KEY = ["my-not-responded-inbox"];

/**
 * Hook dedicado para buscar conversas "Não respondidas" do usuário atual.
 * 
 * Critérios (alinhados com useInboxCounts para consistência do badge):
 * - assigned_to = user.id
 * - status = 'open'
 * - last_sender_type = 'contact'
 * 
 * Este hook garante que o filtro "Não respondidas" seja:
 * 1. Consistente com o badge na sidebar
 * 2. Determinístico (consulta direta ao banco)
 * 3. Não dependa de estado transitório do cache
 * 4. 100% read-only (nunca escreve no banco)
 */
export function useMyNotRespondedInboxItems() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...QUERY_KEY, user?.id],
    queryFn: async (): Promise<InboxViewItem[]> => {
      if (!user?.id) return [];

      console.log("[useMyNotRespondedInboxItems] Fetching not responded for user:", user.id);

      const { data, error } = await supabase
        .from("inbox_view")
        .select("*")
        .eq("assigned_to", user.id)
        .eq("status", "open")
        .eq("last_sender_type", "contact")
        .order("updated_at", { ascending: true }) // Mais antigas primeiro (maior prioridade)
        .limit(5000); // Consistente com outros hooks do inbox

      if (error) {
        console.error("[useMyNotRespondedInboxItems] Error:", error);
        throw error;
      }

      console.log("[useMyNotRespondedInboxItems] Found:", data?.length || 0, "items");
      return (data || []) as InboxViewItem[];
    },
    staleTime: 2000, // 2s para responsividade
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 30000, // Polling backup: 30s
    enabled: !!user?.id,
  });
}
