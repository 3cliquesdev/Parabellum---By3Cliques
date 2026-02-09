import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { InboxViewItem } from "@/hooks/useInboxView";

const QUERY_KEY = ["sla-exceeded-items"];

// SLA Thresholds (em milissegundos)
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

/**
 * Hook dedicado para buscar conversas com SLA Excedido (critical).
 * 
 * Critérios (cálculo DINÂMICO baseado em tempo):
 * - status = 'open'
 * - last_sender_type = 'contact' (cliente foi o último a falar)
 * - last_message_at < now() - 4 horas
 * 
 * Este hook garante que o filtro "SLA Excedido" seja:
 * 1. Consistente com o badge na sidebar (mesma query)
 * 2. Dinâmico (calcula com base em now(), não depende de campo estático)
 * 3. Determinístico (consulta direta ao banco)
 * 4. 100% read-only (nunca escreve no banco)
 * 
 * 🔒 CRÍTICO: NÃO usa inbox_view.sla_status (campo estático que nunca atualiza)
 * Em vez disso, calcula SLA dinamicamente: (now - last_message_at) >= 4h
 */
export function useSlaExceededItems(opts?: { enabled?: boolean; refetchInterval?: number }) {
  const { user } = useAuth();
  const enabled = opts?.enabled ?? true;
  const refetchInterval = opts?.refetchInterval ?? 60_000;

  return useQuery({
    queryKey: [...QUERY_KEY, user?.id],
    queryFn: async (): Promise<InboxViewItem[]> => {
      if (!user?.id) return [];

      // Calcular timestamp de 4 horas atrás
      const fourHoursAgo = new Date(Date.now() - FOUR_HOURS_MS).toISOString();

      console.log("[useSlaExceededItems] Fetching SLA critical items, threshold:", fourHoursAgo);

      const { data, error } = await supabase
        .from("inbox_view")
        .select("*")
        .eq("status", "open")
        .eq("last_sender_type", "contact")
        .lt("last_message_at", fourHoursAgo)
        .order("last_message_at", { ascending: true }) // Mais antigas primeiro (maior urgência)
        .limit(5000); // Consistente com outros hooks do inbox

      if (error) {
        console.error("[useSlaExceededItems] Error:", error);
        throw error;
      }

      console.log("[useSlaExceededItems] Found:", data?.length || 0, "SLA critical items");
      return (data || []) as InboxViewItem[];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval,
    enabled: enabled && !!user?.id,
  });
}
