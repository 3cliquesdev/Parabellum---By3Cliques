import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

function getChannelInfo(source: string | null): { channel: string; color: string } {
  if (!source) return { channel: "Outros", color: "#6b7280" };
  const normalized = source.toLowerCase().trim();
  return SOURCE_TO_CHANNEL[normalized] || { channel: "Outros", color: "#6b7280" };
}

function getSourceLabel(source: string | null): string {
  if (!source) return "Não identificado";
  const normalized = source.toLowerCase().trim();
  return SOURCE_LABELS[normalized] || source;
}

export function useWonDealsByChannel(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ["won-deals-by-channel", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<WonDealsData> => {
      // Buscar deals ganhos no período
      let query = supabase
        .from("deals")
        .select(`
          id,
          value,
          net_value,
          lead_source,
          assigned_to,
          is_organic_sale,
          closed_at,
          profiles:assigned_to (
            id,
            full_name
          )
        `)
        .eq("status", "won");

      // Filtrar por data de fechamento
      if (startDate) {
        query = query.gte("closed_at", startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("closed_at", endOfDay.toISOString());
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
        const { channel, color } = getChannelInfo(source);

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

        // Contadores por tipo
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
          // Vendas sem atribuição - agrupar por tipo
          const orgKey = channel === "Recorrência" ? "__recorrencia__" : 
                        channel === "Afiliados" ? "__afiliados__" :
                        "__organico__";
          const orgLabel = channel === "Recorrência" ? "Vendas Recorrência" :
                          channel === "Afiliados" ? "Vendas Afiliados" :
                          "Vendas Orgânicas";
          const existingOrg = salesRepMap.get(orgKey) || { 
            repName: orgLabel, 
            deals: 0, 
            revenue: 0,
            isOrganic: true 
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
