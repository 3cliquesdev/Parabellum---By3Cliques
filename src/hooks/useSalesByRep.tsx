import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";
import { formatLocalDate, getDateTimeBoundaries } from "@/lib/dateUtils";
import { fetchProductMappings } from "@/lib/kiwifyProductMapping";

export function useSalesByRep(startDate?: Date, endDate?: Date) {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  // Gerar chaves estáveis baseadas em data local (YYYY-MM-DD) para evitar problemas de timezone
  const startKey = startDate ? formatLocalDate(startDate) : undefined;
  const endKey = endDate ? formatLocalDate(endDate) : undefined;

  return useQuery({
    queryKey: ["sales-by-rep-v2", user?.id, role, startKey, endKey],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select("value, assigned_to, is_organic_sale, affiliate_commission, affiliate_name, lead_source, title, kiwify_offer_id, profiles!deals_assigned_to_fkey(full_name)")
        .eq("status", "won");

      // Aplicar filtro de data usando boundaries locais (timezone-safe)
      if (startDate && endDate) {
        const { startDateTime, endDateTime } = getDateTimeBoundaries(startDate, endDate);
        query = query.gte("closed_at", startDateTime).lte("closed_at", endDateTime);
      } else if (startDate) {
        query = query.gte("closed_at", `${formatLocalDate(startDate)}T00:00:00`);
      } else if (endDate) {
        query = query.lte("closed_at", `${formatLocalDate(endDate)}T23:59:59`);
      }

      // Sales rep vê apenas seus próprios dados
      if (role === "sales_rep" && user?.id) {
        query = query.eq("assigned_to", user.id);
      }

      const { data: deals, error } = await query;

      if (error) throw error;

      // ═══════════════════════════════════════════════════════════════════════════════
      // Buscar mapeamentos de ofertas comerciais
      // ═══════════════════════════════════════════════════════════════════════════════
      const { offerMap } = await fetchProductMappings();
      
      // Criar Set de offer_ids comerciais
      const comercialOfferIds = new Set<string>();
      offerMap.forEach((mapping, offerId) => {
        if (mapping.sourceType === 'comercial') {
          comercialOfferIds.add(offerId);
        }
      });

      // ═══════════════════════════════════════════════════════════════════════════════
      // REGRA DEFINITIVA (aprovada 21/01/2026):
      // COMERCIAL = Deal com vendedor atribuído (assigned_to preenchido)
      // Sem vendedor → classificar por: Oferta Comercial, Afiliado, Recorrência ou Orgânico
      // ═══════════════════════════════════════════════════════════════════════════════
      const salesByRep = new Map<
        string,
        { repName: string; totalSales: number; dealsCount: number }
      >();

      deals?.forEach((deal) => {
        let repId: string;
        let repName: string;

        if (deal.assigned_to) {
          // ═══════════════════════════════════════════════════════════════
          // COMERCIAL: Venda COM vendedor atribuído → Time Comercial
          // ═══════════════════════════════════════════════════════════════
          repId = deal.assigned_to;
          repName = (deal.profiles as any)?.full_name || "Vendedor";
        } else {
          // ═══════════════════════════════════════════════════════════════
          // SEM VENDEDOR: Classificar por tipo de venda automática
          // HIERARQUIA: Oferta Comercial > Recorrência > Afiliados > Orgânico
          // ═══════════════════════════════════════════════════════════════
          const source = (deal as any).lead_source?.toLowerCase().trim();
          
          // ═══════════════════════════════════════════════════════════════
          // PRIORIDADE 1: Comercial via Oferta (kiwify_offer_id mapeado como comercial)
          // Mesmo que seja recorrência, se a oferta é comercial, conta como comercial!
          // ═══════════════════════════════════════════════════════════════
          if ((deal as any).kiwify_offer_id && comercialOfferIds.has((deal as any).kiwify_offer_id)) {
            repId = "oferta_comercial";
            repName = "Oferta Comercial";
          }
          // PRIORIDADE 2: Recorrência (não-comercial)
          else if (source === "kiwify_recorrencia" || source === "kiwify_renovacao") {
            repId = "recurring_sales";
            repName = "Recorrência";
          }
          // PRIORIDADE 3: Afiliados (is_organic_sale=false + affiliate_name confirmado)
          else if (deal.is_organic_sale === false && (deal as any).affiliate_name) {
            repId = "affiliate_sales";
            repName = "Vendas Afiliados";
          }
          // PRIORIDADE 4: Orgânico (fallback)
          else {
            repId = "organic_sales";
            repName = "Vendas Orgânicas";
          }
        }

        if (!salesByRep.has(repId)) {
          salesByRep.set(repId, {
            repName,
            totalSales: 0,
            dealsCount: 0,
          });
        }

        const rep = salesByRep.get(repId)!;
        rep.totalSales += deal.value || 0;
        rep.dealsCount += 1;
      });

      // Converter para array e ordenar por valor
      return Array.from(salesByRep.values()).sort(
        (a, b) => b.totalSales - a.totalSales
      );
    },
    enabled: !roleLoading,
  });
}
