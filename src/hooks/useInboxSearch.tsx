import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { InboxViewItem } from "@/hooks/useInboxView";

// UUID regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helpers para detecção de tipo de busca
function isUUID(term: string): boolean {
  return UUID_REGEX.test(term.trim());
}

function isEmail(term: string): boolean {
  return term.includes("@") && term.includes(".");
}

// Hex string de 6-8 chars (short_id / protocolo)
const SHORT_ID_REGEX = /^#?[0-9a-f]{6,8}$/i;

function isShortId(term: string): boolean {
  return SHORT_ID_REGEX.test(term.trim());
}

function isLikelyPhone(term: string): boolean {
  // Se contém 6+ dígitos, provavelmente é telefone
  const digits = term.replace(/\D/g, "");
  return digits.length >= 6;
}

function normalizePhone(term: string): string {
  // Remove tudo que não é dígito
  return term.replace(/\D/g, "");
}

// Ordenação client-side: open > pending > closed, depois por recência
function sortByStatusAndRecency(items: InboxViewItem[]): InboxViewItem[] {
  const statusPriority: Record<string, number> = {
    open: 0,
    pending: 1,
    closed: 2,
  };

  return [...items].sort((a, b) => {
    // Primeiro: status (open tem prioridade)
    const priorityA = statusPriority[a.status] ?? 1;
    const priorityB = statusPriority[b.status] ?? 1;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    // Segundo: mais recente primeiro
    const dateA = new Date(a.last_message_at || a.created_at).getTime();
    const dateB = new Date(b.last_message_at || b.created_at).getTime();
    return dateB - dateA;
  });
}

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
 * 🔧 MELHORIAS v2:
 * - Detecção automática de UUID (busca por conversation_id/contact_id)
 * - Normalização de telefone (remove formatação)
 * - Ordenação corrigida: open primeiro (client-side), depois por recência
 * - Limite aumentado para 200 para reduzir falsos negativos
 * 
 * @param searchTerm - Termo de busca (nome, email, telefone, UUID)
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
      
      console.log("[useInboxSearch] Iniciando busca:", searchLower);

      let data: InboxViewItem[] | null = null;
      let error: any = null;

      // 🔍 ESTRATÉGIA 0: Busca por short_id (protocolo #XXXXXXXX)
      if (isShortId(searchLower)) {
        const cleanId = searchLower.replace(/^#/, "").toLowerCase();
        console.log("[useInboxSearch] Modo: Short ID (protocolo)", cleanId);
        
        const result = await supabase
          .from("inbox_view")
          .select("*")
          .ilike("short_id", `${cleanId}%`)
          .order("last_message_at", { ascending: false })
          .limit(50);
        
        data = result.data;
        error = result.error;
      }
      // 🔍 ESTRATÉGIA 1: Busca por UUID (conversation_id ou contact_id)
      else if (isUUID(searchLower)) {
        console.log("[useInboxSearch] Modo: UUID");
        
        // Tentar encontrar por conversation_id primeiro
        const convResult = await supabase
          .from("inbox_view")
          .select("*")
          .eq("conversation_id", searchLower)
          .limit(1);
        
        if (convResult.data && convResult.data.length > 0) {
          data = convResult.data;
        } else {
          // Tentar por contact_id
          const contactResult = await supabase
            .from("inbox_view")
            .select("*")
            .eq("contact_id", searchLower)
            .order("last_message_at", { ascending: false })
            .limit(50); // Um contato pode ter várias conversas
          
          data = contactResult.data;
          error = contactResult.error;
        }
      }
      // 🔍 ESTRATÉGIA 2: Busca por email
      else if (isEmail(searchLower)) {
        console.log("[useInboxSearch] Modo: Email");
        
        const result = await supabase
          .from("inbox_view")
          .select("*")
          .ilike("contact_email", `%${searchLower}%`)
          .order("last_message_at", { ascending: false })
          .limit(200);
        
        data = result.data;
        error = result.error;
      }
      // 🔍 ESTRATÉGIA 3: Busca por telefone (normalizado)
      else if (isLikelyPhone(searchLower)) {
        console.log("[useInboxSearch] Modo: Telefone");
        
        const normalizedPhone = normalizePhone(searchLower);
        
        // Buscar pelo telefone normalizado
        // Também tentar sem o código do país (55) se presente
        let phonePatterns = [normalizedPhone];
        if (normalizedPhone.startsWith("55") && normalizedPhone.length > 10) {
          phonePatterns.push(normalizedPhone.substring(2)); // Sem o 55
        }
        
        // Construir OR para múltiplos padrões de telefone
        const orConditions = phonePatterns
          .map(p => `contact_phone.ilike.%${p}%`)
          .join(",");
        
        const result = await supabase
          .from("inbox_view")
          .select("*")
          .or(orConditions)
          .order("last_message_at", { ascending: false })
          .limit(200);
        
        data = result.data;
        error = result.error;
      }
      // 🔍 ESTRATÉGIA 4: Busca genérica (nome, email, telefone)
      else {
        console.log("[useInboxSearch] Modo: Texto genérico");
        
        // Query direta ao banco - apenas campos TEXT (UUID não suporta ILIKE)
        const result = await supabase
          .from("inbox_view")
          .select("*")
          .or(
            `contact_name.ilike.%${searchLower}%,` +
            `contact_email.ilike.%${searchLower}%,` +
            `contact_phone.ilike.%${searchLower}%`
          )
          .order("last_message_at", { ascending: false })
          .limit(200);
        
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error("[useInboxSearch] Erro:", error);
        throw error;
      }

      // 🔧 ORDENAÇÃO CLIENT-SIDE: open primeiro, depois por recência
      // Isso corrige o bug onde "closed" vinha antes de "open" alfabeticamente
      const sortedData = sortByStatusAndRecency(data || []);

      console.log("[useInboxSearch] Resultados:", sortedData.length, 
        "items. Status counts:", 
        sortedData.reduce((acc, item) => {
          acc[item.status] = (acc[item.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      );

      return sortedData as InboxViewItem[];
    },
    staleTime: 5000, // Cache por 5s
    enabled: !!user?.id && debouncedSearch.trim().length >= 2,
  });
}
