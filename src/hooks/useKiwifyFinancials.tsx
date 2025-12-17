import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KiwifyFinancialData {
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalKiwifyFees: number;
  totalAffiliateCommissions: number;
  productBreakdown: Array<{
    productName: string;
    salesCount: number;
    grossRevenue: number;
    netRevenue: number;
    kiwifyFee: number;
    affiliateCommission: number;
    marginPercent: number;
  }>;
  monthlyEvolution: Array<{
    month: string;
    grossRevenue: number;
    netRevenue: number;
    kiwifyFee: number;
    affiliateCommission: number;
  }>;
  topAffiliates: Array<{
    affiliateName: string;
    affiliateEmail: string;
    salesCount: number;
    totalCommission: number;
  }>;
}

interface KiwifyEventPayload {
  Product?: {
    product_name?: string;
    product_id?: string;
  };
  Commissions?: {
    product_base_price?: number;
    my_commission?: number;
    kiwify_fee?: number;
    commissioned_stores?: Array<{
      type: string;
      value: number;
      custom_name?: string;
      email?: string;
    }>;
  };
}

export function useKiwifyFinancials(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ["kiwify-financials", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      const start = startDate?.toISOString() || "2024-01-01";
      const end = endDate?.toISOString() || new Date().toISOString();

      console.log("📊 useKiwifyFinancials: Buscando dados de kiwify_events", { start, end });

      // Primeiro, buscar a contagem total de eventos para saber quantas páginas precisamos
      const { count, error: countError } = await supabase
        .from("kiwify_events")
        .select("*", { count: "exact", head: true })
        .in("event_type", ["paid", "order_approved"])
        .gte("created_at", start)
        .lte("created_at", end);

      if (countError) {
        console.error("❌ useKiwifyFinancials: Erro ao contar eventos:", countError);
        throw countError;
      }

      const totalEvents = count || 0;
      console.log(`📊 useKiwifyFinancials: Total de ${totalEvents} eventos para buscar`);

      // Buscar todos os eventos com paginação (Supabase limita a 1000 por query)
      const pageSize = 1000;
      const totalPages = Math.ceil(totalEvents / pageSize);
      const allEvents: any[] = [];

      for (let page = 0; page < totalPages; page++) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data: pageData, error: pageError } = await supabase
          .from("kiwify_events")
          .select("*")
          .in("event_type", ["paid", "order_approved"])
          .gte("created_at", start)
          .lte("created_at", end)
          .range(from, to);

        if (pageError) {
          console.error(`❌ useKiwifyFinancials: Erro na página ${page}:`, pageError);
          throw pageError;
        }

        if (pageData) {
          allEvents.push(...pageData);
        }

        console.log(`📊 useKiwifyFinancials: Página ${page + 1}/${totalPages} - ${pageData?.length || 0} eventos`);
      }

      console.log(`✅ useKiwifyFinancials: ${allEvents.length} eventos carregados (total bruto)`);

      // 🆕 CORREÇÃO 1: Buscar order_ids que foram reembolsados/chargebacks
      const { data: refundedEvents } = await supabase
        .from("kiwify_events")
        .select("payload")
        .in("event_type", ["refunded", "chargedback"]);

      const refundedOrderIds = new Set<string>();
      refundedEvents?.forEach(event => {
        const orderId = (event.payload as any)?.order_id;
        if (orderId) refundedOrderIds.add(orderId);
      });
      console.log(`📊 useKiwifyFinancials: ${refundedOrderIds.size} pedidos reembolsados/chargebacks excluídos`);

      // 🆕 CORREÇÃO 2: Deduplicar eventos por order_id (webhooks duplicados)
      const uniqueOrdersMap = new Map<string, any>();
      allEvents.forEach(event => {
        const orderId = (event.payload as any)?.order_id;
        if (!orderId) return;
        
        // Pular pedidos que foram reembolsados/chargebacks
        if (refundedOrderIds.has(orderId)) return;
        
        // Manter apenas o primeiro evento por order_id
        if (!uniqueOrdersMap.has(orderId)) {
          uniqueOrdersMap.set(orderId, event);
        }
      });

      const events = Array.from(uniqueOrdersMap.values());
      console.log(`✅ useKiwifyFinancials: ${events.length} pedidos únicos após deduplicação`);

      // Calcular totais a partir do payload dos eventos
      let totalGrossRevenue = 0;
      let totalNetRevenue = 0;
      let totalKiwifyFees = 0;
      let totalAffiliateCommissions = 0;

      const productMap = new Map<string, {
        productName: string;
        salesCount: number;
        grossRevenue: number;
        netRevenue: number;
        kiwifyFee: number;
        affiliateCommission: number;
      }>();

      const monthMap = new Map<string, {
        month: string;
        grossRevenue: number;
        netRevenue: number;
        kiwifyFee: number;
        affiliateCommission: number;
      }>();

      const affiliateMap = new Map<string, {
        affiliateName: string;
        affiliateEmail: string;
        salesCount: number;
        totalCommission: number;
      }>();

      events.forEach(event => {
        const payload = event.payload as KiwifyEventPayload;
        const commissions = payload?.Commissions;
        
        // Extrair valores financeiros do payload (em centavos → converter para reais)
        const grossValue = (commissions?.product_base_price || 0) / 100;
        const netValue = (commissions?.my_commission || commissions?.product_base_price || 0) / 100;
        const kiwifyFee = (commissions?.kiwify_fee || 0) / 100;
        
        // Extrair comissão do afiliado
        const affiliateData = commissions?.commissioned_stores?.find(s => s.type === 'affiliate');
        const affiliateCommission = (affiliateData?.value || 0) / 100;
        const affiliateName = affiliateData?.custom_name || null;
        const affiliateEmail = affiliateData?.email || null;

        // Acumular totais
        totalGrossRevenue += grossValue;
        totalNetRevenue += netValue;
        totalKiwifyFees += kiwifyFee;
        totalAffiliateCommissions += affiliateCommission;

        // Breakdown por produto
        const productName = payload?.Product?.product_name || "Produto não identificado";
        if (!productMap.has(productName)) {
          productMap.set(productName, {
            productName,
            salesCount: 0,
            grossRevenue: 0,
            netRevenue: 0,
            kiwifyFee: 0,
            affiliateCommission: 0,
          });
        }
        const productData = productMap.get(productName)!;
        productData.salesCount++;
        productData.grossRevenue += grossValue;
        productData.netRevenue += netValue;
        productData.kiwifyFee += kiwifyFee;
        productData.affiliateCommission += affiliateCommission;

        // Evolução mensal
        const month = new Date(event.created_at).toISOString().slice(0, 7); // YYYY-MM
        if (!monthMap.has(month)) {
          monthMap.set(month, {
            month,
            grossRevenue: 0,
            netRevenue: 0,
            kiwifyFee: 0,
            affiliateCommission: 0,
          });
        }
        const monthData = monthMap.get(month)!;
        monthData.grossRevenue += grossValue;
        monthData.netRevenue += netValue;
        monthData.kiwifyFee += kiwifyFee;
        monthData.affiliateCommission += affiliateCommission;

        // Top Afiliados
        if (affiliateName || affiliateEmail) {
          const key = affiliateEmail || affiliateName || "Sem identificação";
          if (!affiliateMap.has(key)) {
            affiliateMap.set(key, {
              affiliateName: affiliateName || "Nome não disponível",
              affiliateEmail: affiliateEmail || "Email não disponível",
              salesCount: 0,
              totalCommission: 0,
            });
          }
          const affiliate = affiliateMap.get(key)!;
          affiliate.salesCount++;
          affiliate.totalCommission += affiliateCommission;
        }
      });

      const productBreakdown = Array.from(productMap.values()).map(p => ({
        ...p,
        marginPercent: p.grossRevenue > 0 ? (p.netRevenue / p.grossRevenue) * 100 : 0,
      }));

      const monthlyEvolution = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

      const topAffiliates = Array.from(affiliateMap.values())
        .sort((a, b) => b.totalCommission - a.totalCommission);

      console.log("✅ useKiwifyFinancials: Dados calculados de kiwify_events", {
        totalGrossRevenue,
        totalNetRevenue,
        productsCount: productBreakdown.length,
        affiliatesCount: topAffiliates.length,
        eventsCount: events?.length || 0,
      });

      return {
        totalGrossRevenue,
        totalNetRevenue,
        totalKiwifyFees,
        totalAffiliateCommissions,
        productBreakdown,
        monthlyEvolution,
        topAffiliates,
      } as KiwifyFinancialData;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
