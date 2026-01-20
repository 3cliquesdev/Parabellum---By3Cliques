import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatLocalDate, getDateTimeBoundaries } from "@/lib/dateUtils";

interface ChannelData {
  channel: string;
  color: string;
  deals: number;
  revenue: number;
  percentage: number;
}

interface SourceData {
  source: string;
  label: string;
  deals: number;
  revenue: number;
}

interface SalesRepData {
  repId: string | null;
  repName: string;
  deals: number;
  revenue: number;
  percentage: number;
  isOrganic: boolean;
}

interface WonDealsData {
  byChannel: ChannelData[];
  bySource: SourceData[];
  bySalesRep: SalesRepData[];
  totals: {
    totalDeals: number;
    totalRevenue: number;
    organicDeals: number;
    commercialDeals: number;
    affiliateDeals: number;
    recurringDeals: number;
  };
}

// Mapeamento de lead_source para categoria
const SOURCE_TO_CHANNEL: Record<string, { channel: string; color: string }> = {
  kiwify_direto: { channel: "Orgânico", color: "#8b5cf6" },
  kiwify_organic: { channel: "Orgânico", color: "#8b5cf6" },
  kiwify_checkout: { channel: "Orgânico", color: "#8b5cf6" },
  kiwify_recorrencia: { channel: "Recorrência", color: "#06b6d4" },
  kiwify_renovacao: { channel: "Recorrência", color: "#06b6d4" },
  whatsapp: { channel: "Comercial", color: "#3b82f6" },
  manual: { channel: "Comercial", color: "#3b82f6" },
  comercial: { channel: "Comercial", color: "#3b82f6" },
  afiliado: { channel: "Afiliados", color: "#f97316" },
  parceiro: { channel: "Afiliados", color: "#f97316" },
  affiliate: { channel: "Afiliados", color: "#f97316" },
  formulario: { channel: "Formulários", color: "#22c55e" },
  form: { channel: "Formulários", color: "#22c55e" },
  chat_widget: { channel: "Formulários", color: "#22c55e" },
  indicacao: { channel: "Indicação", color: "#ec4899" },
  referral: { channel: "Indicação", color: "#ec4899" },
};

const SOURCE_LABELS: Record<string, string> = {
  kiwify_direto: "Kiwify Direto",
  kiwify_organic: "Kiwify Orgânico",
  kiwify_checkout: "Kiwify Checkout",
  kiwify_recorrencia: "Recorrência",
  kiwify_renovacao: "Renovação",
  whatsapp: "WhatsApp",
  manual: "Manual",
  comercial: "Comercial",
  afiliado: "Afiliado",
  parceiro: "Parceiro",
  affiliate: "Affiliate",
  formulario: "Formulário",
  form: "Formulário",
  chat_widget: "Chat Widget",
  indicacao: "Indicação",
  referral: "Referral",
};

// Classifica canal considerando lead_source, affiliate_name e título (para recuperação)
function getChannelForDeal(deal: { 
  lead_source?: string | null; 
  is_organic_sale?: boolean | null;
  affiliate_name?: string | null;
  title?: string | null;
}): { channel: string; color: string } {
  const source = deal.lead_source?.toLowerCase().trim();
  const title = deal.title?.toLowerCase() || "";
  
  // PRIORIDADE 1: Fontes comerciais SEMPRE são Comercial (time de vendas)
  // Mesmo que is_organic_sale=false, se veio do time comercial, é Comercial
  if (source && ["whatsapp", "manual", "comercial", "webchat"].includes(source)) {
    return { channel: "Comercial", color: "#3b82f6" };
  }
  
  // PRIORIDADE 2: Recuperação (título começa com "Recuperação")
  if (title.startsWith("recuperação") || title.startsWith("recuperacao")) {
    return { channel: "Recuperação", color: "#a855f7" };
  }
  
  // PRIORIDADE 3: Recorrência
  if (source === "kiwify_recorrencia" || source === "kiwify_renovacao") {
    return { channel: "Recorrência", color: "#06b6d4" };
  }
  
  // PRIORIDADE 4: Se is_organic_sale = false E TEM affiliate_name → Afiliados
  // Só é afiliado se realmente tiver um afiliado identificado
  if (deal.is_organic_sale === false && deal.affiliate_name) {
    return { channel: "Afiliados", color: "#f97316" };
  }
  
  // PRIORIDADE 5: Orgânico (vendas diretas do produtor)
  if (source === "kiwify_direto" || source === "kiwify_organic" || source === "kiwify_checkout") {
    return { channel: "Orgânico", color: "#8b5cf6" };
  }
  
  // PRIORIDADE 6: Formulários
  if (source === "formulario" || source === "form" || source === "chat_widget") {
    return { channel: "Formulários", color: "#22c55e" };
  }
  
  // PRIORIDADE 7: Sem source definida
  if (!source) {
    // Se é afiliado confirmado (tem nome)
    if (deal.is_organic_sale === false && deal.affiliate_name) {
      return { channel: "Afiliados", color: "#f97316" };
    }
    return { channel: "Outros", color: "#6b7280" };
  }
  
  // Fallback para mapeamento existente
  return SOURCE_TO_CHANNEL[source] || { channel: "Outros", color: "#6b7280" };
}

function getSourceLabel(source: string | null): string {
  if (!source) return "Não identificado";
  const normalized = source.toLowerCase().trim();
  return SOURCE_LABELS[normalized] || source;
}

export function useWonDealsByChannel(startDate?: Date, endDate?: Date) {
  // Gerar chaves estáveis baseadas em data local (YYYY-MM-DD) para evitar problemas de timezone
  const startKey = startDate ? formatLocalDate(startDate) : undefined;
  const endKey = endDate ? formatLocalDate(endDate) : undefined;

  return useQuery({
    queryKey: ["won-deals-by-channel", startKey, endKey],
    queryFn: async (): Promise<WonDealsData> => {
      // Buscar deals ganhos no período
      let query = supabase
        .from("deals")
        .select(`
          id,
          title,
          value,
          net_value,
          lead_source,
          assigned_to,
          is_organic_sale,
          affiliate_name,
          closed_at,
          profiles:assigned_to (
            id,
            full_name
          )
        `)
        .eq("status", "won");

      // Filtrar por data de fechamento usando boundaries locais (timezone-safe)
      if (startDate && endDate) {
        const { startDateTime, endDateTime } = getDateTimeBoundaries(startDate, endDate);
        query = query.gte("closed_at", startDateTime).lte("closed_at", endDateTime);
      } else if (startDate) {
        query = query.gte("closed_at", `${formatLocalDate(startDate)}T00:00:00`);
      } else if (endDate) {
        query = query.lte("closed_at", `${formatLocalDate(endDate)}T23:59:59`);
      }

      const { data: deals, error } = await query;

      if (error) throw error;

      // Agrupar por canal
      const channelMap = new Map<string, { deals: number; revenue: number; color: string }>();
      const sourceMap = new Map<string, { deals: number; revenue: number }>();
      const salesRepMap = new Map<string, { 
        repName: string; 
        deals: number; 
        revenue: number; 
        isOrganic: boolean 
      }>();

      let organicDeals = 0;
      let commercialDeals = 0;
      let affiliateDeals = 0;
      let recurringDeals = 0;

      (deals || []).forEach((deal) => {
        const revenue = deal.net_value || deal.value || 0;
        const source = deal.lead_source;
        // Usa nova função que considera is_organic_sale
        const { channel, color } = getChannelForDeal(deal);

        // Agrupa por canal
        const existing = channelMap.get(channel) || { deals: 0, revenue: 0, color };
        channelMap.set(channel, {
          deals: existing.deals + 1,
          revenue: existing.revenue + revenue,
          color,
        });

        // Agrupa por source original
        const sourceKey = source || "unknown";
        const existingSource = sourceMap.get(sourceKey) || { deals: 0, revenue: 0 };
        sourceMap.set(sourceKey, {
          deals: existingSource.deals + 1,
          revenue: existingSource.revenue + revenue,
        });

        // Contadores por tipo (usando classificação correta)
        if (channel === "Orgânico") organicDeals++;
        else if (channel === "Comercial") commercialDeals++;
        else if (channel === "Afiliados") affiliateDeals++;
        else if (channel === "Recorrência") recurringDeals++;

        // Agrupa por vendedor
        const profile = deal.profiles as { id: string; full_name: string } | null;
        if (deal.assigned_to && profile) {
          const repKey = deal.assigned_to;
          const existingRep = salesRepMap.get(repKey) || { 
            repName: profile.full_name || "Sem nome", 
            deals: 0, 
            revenue: 0,
            isOrganic: false 
          };
          salesRepMap.set(repKey, {
            ...existingRep,
            deals: existingRep.deals + 1,
            revenue: existingRep.revenue + revenue,
          });
        } else {
          // Vendas sem atribuição - agrupar por tipo (usando canal já classificado corretamente)
          const orgKey = channel === "Recorrência" ? "__recorrencia__" : 
                        channel === "Afiliados" ? "__afiliados__" :
                        "__organico__";
          const orgLabel = channel === "Recorrência" ? "Vendas Recorrência" :
                          channel === "Afiliados" ? "Vendas Afiliados" :
                          "Vendas Diretas"; // Renomeado de "Vendas Orgânicas" para clareza
          const existingOrg = salesRepMap.get(orgKey) || { 
            repName: orgLabel, 
            deals: 0, 
            revenue: 0,
            isOrganic: channel !== "Afiliados" // Afiliados não são "orgânicos"
          };
          salesRepMap.set(orgKey, {
            ...existingOrg,
            deals: existingOrg.deals + 1,
            revenue: existingOrg.revenue + revenue,
          });
        }
      });

      const totalDeals = deals?.length || 0;
      const totalRevenue = (deals || []).reduce((sum, d) => sum + (d.net_value || d.value || 0), 0);

      // Formata resultado por canal
      const byChannel: ChannelData[] = Array.from(channelMap.entries())
        .map(([channel, data]) => ({
          channel,
          color: data.color,
          deals: data.deals,
          revenue: data.revenue,
          percentage: totalDeals > 0 ? (data.deals / totalDeals) * 100 : 0,
        }))
        .sort((a, b) => b.deals - a.deals);

      // Formata resultado por source
      const bySource: SourceData[] = Array.from(sourceMap.entries())
        .map(([source, data]) => ({
          source,
          label: getSourceLabel(source),
          deals: data.deals,
          revenue: data.revenue,
        }))
        .sort((a, b) => b.deals - a.deals);

      // Formata resultado por vendedor
      const bySalesRep: SalesRepData[] = Array.from(salesRepMap.entries())
        .map(([repId, data]) => ({
          repId: repId.startsWith("__") ? null : repId,
          repName: data.repName,
          deals: data.deals,
          revenue: data.revenue,
          percentage: totalDeals > 0 ? (data.deals / totalDeals) * 100 : 0,
          isOrganic: data.isOrganic,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      return {
        byChannel,
        bySource,
        bySalesRep,
        totals: {
          totalDeals,
          totalRevenue,
          organicDeals,
          commercialDeals,
          affiliateDeals,
          recurringDeals,
        },
      };
    },
    enabled: true,
    staleTime: 1000 * 60 * 2,
  });
}
