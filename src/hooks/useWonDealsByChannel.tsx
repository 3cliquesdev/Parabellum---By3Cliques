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

interface CommercialBreakdownItem {
  channel: string;
  icon: string;
  deals: number;
  revenue: number;
  color: string;
}

interface CommercialBreakdown {
  whatsapp: CommercialBreakdownItem;
  manual: CommercialBreakdownItem;
  webchat: CommercialBreakdownItem;
  recuperacao: CommercialBreakdownItem;
  formularios: CommercialBreakdownItem;
}

interface KiwifyBreakdownItem {
  channel: string;
  icon: string;
  deals: number;
  revenue: number;
  color: string;
}

interface KiwifyBreakdown {
  afiliados: KiwifyBreakdownItem;
  recorrencia: KiwifyBreakdownItem;
  organico: KiwifyBreakdownItem;
}

interface WonDealsData {
  byChannel: ChannelData[];
  bySource: SourceData[];
  bySalesRep: SalesRepData[];
  commercialBreakdown: CommercialBreakdown;
  kiwifyBreakdown: KiwifyBreakdown;
  totals: {
    totalDeals: number;
    totalRevenue: number;
    organicDeals: number;
    commercialDeals: number;
    affiliateDeals: number;
    recurringDeals: number;
    recuperacaoDeals: number;
    formulariosDeals: number;
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

// ═══════════════════════════════════════════════════════════════════════════════
// REGRA DEFINITIVA (aprovada 21/01/2026):
// COMERCIAL = Deal com vendedor atribuído (assigned_to preenchido)
// Sem vendedor → classificar por: Afiliado, Recorrência ou Orgânico
// ═══════════════════════════════════════════════════════════════════════════════
function getChannelForDeal(deal: { 
  lead_source?: string | null; 
  is_organic_sale?: boolean | null;
  affiliate_name?: string | null;
  title?: string | null;
  assigned_to?: string | null;
}): { channel: string; color: string } {
  
  // ═══════════════════════════════════════════════════════════════
  // REGRA PRINCIPAL: Se tem vendedor atribuído → COMERCIAL
  // ═══════════════════════════════════════════════════════════════
  if (deal.assigned_to) {
    return { channel: "Comercial", color: "#3b82f6" };
  }
  
  // ═══════════════════════════════════════════════════════════════
  // SEM VENDEDOR - Classificar por tipo de venda automática
  // ═══════════════════════════════════════════════════════════════
  
  const source = deal.lead_source?.toLowerCase().trim();
  
  // Recorrência
  if (source === "kiwify_recorrencia" || source === "kiwify_renovacao") {
    return { channel: "Recorrência", color: "#06b6d4" };
  }
  
  // Afiliados (is_organic_sale=false + affiliate_name confirmado)
  if (deal.is_organic_sale === false && deal.affiliate_name) {
    return { channel: "Afiliados", color: "#f97316" };
  }
  
  // Orgânico (vendas diretas sem vendedor)
  return { channel: "Orgânico", color: "#8b5cf6" };
}

function getSourceLabel(source: string | null): string {
  if (!source) return "Não identificado";
  const normalized = source.toLowerCase().trim();
  return SOURCE_LABELS[normalized] || source;
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ⚠️ LÓGICA TRAVADA - VALIDADA EM 20/01/2026 ⚠️
 * 
 * NÃO ALTERAR esta lógica de filtro sem:
 * 1. Comparar resultados com useDealsCounts (KPI do topo)
 * 2. Validar paridade: Widget "Quem Ganhou" = KPI "Deals Ganhos"
 * 3. Aprovar com o usuário antes de aplicar
 * 
 * REGRA DEFINITIVA (aprovada pelo usuário):
 * - Deals Ganhos/Perdidos: Filtrar por closed_at (data do FECHAMENTO)
 * - Deals Criados/Abertos: Filtrar por created_at (data da CRIAÇÃO)
 * 
 * Baseline 15/01/2026: 240 deals ganhos (fechados nesse dia)
 * ════════════════════════════════════════════════════════════════════════════
 */
export function useWonDealsByChannel(startDate?: Date, endDate?: Date) {
  // Gerar chaves estáveis baseadas em data local (YYYY-MM-DD) para evitar problemas de timezone
  const startKey = startDate ? formatLocalDate(startDate) : undefined;
  const endKey = endDate ? formatLocalDate(endDate) : undefined;

  return useQuery({
    queryKey: ["won-deals-by-channel-v3", startKey, endKey],
    staleTime: 60 * 1000, // Cache de 60 segundos
    refetchOnWindowFocus: false, // Evitar spam de requests
    retry: 3, // Retry em caso de falha de rede
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Backoff exponencial
    placeholderData: (previousData) => previousData, // Manter dados anteriores durante falha
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

      // ⚠️ LÓGICA TRAVADA: Filtrar por closed_at (data de FECHAMENTO do deal)
      // Aprovado pelo usuário em 20/01/2026 - baseline: 240 deals em 15/01/2026
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
      let recuperacaoDeals = 0;
      let formulariosDeals = 0;

      // Breakdown detalhado do Comercial
      const commercialBreakdown: CommercialBreakdown = {
        whatsapp: { channel: "WhatsApp", icon: "📱", deals: 0, revenue: 0, color: "#25D366" },
        manual: { channel: "Manual", icon: "✋", deals: 0, revenue: 0, color: "#3b82f6" },
        webchat: { channel: "Webchat", icon: "💬", deals: 0, revenue: 0, color: "#8b5cf6" },
        recuperacao: { channel: "Recuperação", icon: "🔄", deals: 0, revenue: 0, color: "#a855f7" },
        formularios: { channel: "Formulários", icon: "📋", deals: 0, revenue: 0, color: "#22c55e" },
      };

      // Breakdown detalhado do Kiwify (canais não-comerciais)
      const kiwifyBreakdown: KiwifyBreakdown = {
        afiliados: { channel: "Afiliados", icon: "🤝", deals: 0, revenue: 0, color: "#f97316" },
        recorrencia: { channel: "Recorrência", icon: "🔄", deals: 0, revenue: 0, color: "#06b6d4" },
        organico: { channel: "Orgânico", icon: "🎯", deals: 0, revenue: 0, color: "#8b5cf6" },
      };

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
        // Nota: Recuperação e Formulários agora são contados como Comercial no gráfico
        // mas mantemos os contadores individuais para o breakdown detalhado
        if (channel === "Orgânico") {
          organicDeals++;
          kiwifyBreakdown.organico.deals++;
          kiwifyBreakdown.organico.revenue += revenue;
        } else if (channel === "Comercial") {
          commercialDeals++;
        } else if (channel === "Afiliados") {
          affiliateDeals++;
          kiwifyBreakdown.afiliados.deals++;
          kiwifyBreakdown.afiliados.revenue += revenue;
        } else if (channel === "Recorrência") {
          recurringDeals++;
          kiwifyBreakdown.recorrencia.deals++;
          kiwifyBreakdown.recorrencia.revenue += revenue;
        }

        // Preencher breakdown comercial APENAS para deals COM vendedor
        if (deal.assigned_to) {
          const sourceNorm = (deal.lead_source || "").toLowerCase().trim();
          const titleNorm = (deal.title || "").toLowerCase();
          
          if (sourceNorm === "whatsapp") {
            commercialBreakdown.whatsapp.deals++;
            commercialBreakdown.whatsapp.revenue += revenue;
          } else if (sourceNorm === "manual" || sourceNorm === "comercial") {
            commercialBreakdown.manual.deals++;
            commercialBreakdown.manual.revenue += revenue;
          } else if (sourceNorm === "webchat") {
            commercialBreakdown.webchat.deals++;
            commercialBreakdown.webchat.revenue += revenue;
          } else if (titleNorm.startsWith("recuperação") || titleNorm.startsWith("recuperacao") || titleNorm.startsWith("winback")) {
            commercialBreakdown.recuperacao.deals++;
            commercialBreakdown.recuperacao.revenue += revenue;
            recuperacaoDeals++;
          } else if (sourceNorm === "formulario" || sourceNorm === "form" || sourceNorm === "chat_widget") {
            commercialBreakdown.formularios.deals++;
            commercialBreakdown.formularios.revenue += revenue;
            formulariosDeals++;
          } else {
            // Outros canais com vendedor → Manual/Outros
            commercialBreakdown.manual.deals++;
            commercialBreakdown.manual.revenue += revenue;
          }
        }

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
        commercialBreakdown,
        kiwifyBreakdown,
        totals: {
          totalDeals,
          totalRevenue,
          organicDeals,
          commercialDeals,
          affiliateDeals,
          recurringDeals,
          recuperacaoDeals,
          formulariosDeals,
        },
      };
    },
    enabled: true,
  });
}
