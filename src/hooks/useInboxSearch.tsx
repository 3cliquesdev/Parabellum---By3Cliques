import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { InboxViewItem } from "@/hooks/useInboxView";

/**
 * Hook dedicado para busca no Inbox - consulta DIRETA ao banco.
 * 
 * 🔒 CRÍTICO: Este hook existe porque a lista padrão do inbox
 * (useInboxView) usa limit(5000) + order(updated_at ASC), o que
 * significa que conversas RECENTES podem ficar fora do recorte.
 * 
 * Quando há busca ativa, precisamos ir DIRETO ao banco com uma
 * query própria, sem depender do array pré-carregado.
 * 
 * Ordenação dos resultados:
 * - status ASC: 'open' vem antes de 'closed' alfabeticamente
 * - last_message_at DESC: mais recentes primeiro dentro do status
 * 
 * @param searchTerm - Termo de busca (nome, email, telefone, ID)
 */
export function useInboxSearch(searchTerm: string) {
  const { user } = useAuth();
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  return useQuery({
    queryKey: ["inbox-search", debouncedSearch, user?.id],
    queryFn: async (): Promise<InboxViewItem[]> => {
      if (!debouncedSearch || debouncedSearch.trim().length < 2) {
        return [];
      }

      const searchLower = debouncedSearch.toLowerCase().trim();
      
      console.log("[useInboxSearch] Buscando no banco:", searchLower);

      // Query direta ao banco - SEM dependência do array pré-carregado
      // Ordenação: open primeiro (alfabeticamente), depois por recência
      const { data, error } = await supabase
        .from("inbox_view")
        .select("*")
        .or(
          `contact_name.ilike.%${searchLower}%,` +
          `contact_email.ilike.%${searchLower}%,` +
          `contact_phone.ilike.%${searchLower}%,` +
          `contact_id.ilike.%${searchLower}%,` +
          `conversation_id.ilike.%${searchLower}%`
        )
        .order("status", { ascending: true }) // 'open' vem antes de 'closed'
        .order("last_message_at", { ascending: false }) // Mais recentes primeiro
        .limit(100); // Limite razoável para resultados de busca

      if (error) {
        console.error("[useInboxSearch] Erro:", error);
        throw error;
      }

      console.log("[useInboxSearch] Resultados:", data?.length || 0, 
        "items. Status counts:", 
        data?.reduce((acc, item) => {
          acc[item.status] = (acc[item.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      );

      return (data || []) as InboxViewItem[];
    },
    staleTime: 5000, // Cache por 5s
    enabled: !!user?.id && debouncedSearch.trim().length >= 2,
  });
}
