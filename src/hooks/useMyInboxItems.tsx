import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { InboxViewItem } from "@/hooks/useInboxView";

const QUERY_KEY = ["my-inbox-items"];

/**
 * Hook dedicado para buscar conversas "Minhas" do usuário atual.
 * 
 * Critérios:
 * - assigned_to = user.id
 * - status != 'closed'
 * 
 * Este hook garante que o filtro "Minhas" seja:
 * 1. Determinístico (consulta direta ao banco)
 * 2. Não dependa de estado transitório do cache
 * 3. 100% read-only (nunca escreve no banco)
 * 
 * 🔒 INVIOLÁVEL: Este hook existe para resolver o bug de cache stale
 * onde rawInboxItems não era atualizado pelo realtime.
 * NÃO REMOVER ou simplificar para usar cache compartilhado!
 */
export function useMyInboxItems() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...QUERY_KEY, user?.id],
    queryFn: async (): Promise<InboxViewItem[]> => {
      if (!user?.id) return [];

      console.log("[useMyInboxItems] Fetching my conversations for user:", user.id);

      const { data, error } = await supabase
        .from("inbox_view")
        .select("*")
        .eq("assigned_to", user.id)
        .neq("status", "closed")
        .order("updated_at", { ascending: true }) // Mais antigas primeiro (maior prioridade)
        .limit(5000); // Consistente com outros hooks do inbox

      if (error) {
        console.error("[useMyInboxItems] Error:", error);
        throw error;
      }

      console.log("[useMyInboxItems] Found:", data?.length || 0, "items");
      return (data || []) as InboxViewItem[];
    },
    staleTime: 2000, // 2s para responsividade
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 30000, // Polling backup: 30s
    enabled: !!user?.id,
  });
}
