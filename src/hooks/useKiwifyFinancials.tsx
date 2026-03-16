import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchProductMappings, getMappedProduct } from "@/lib/kiwifyProductMapping";

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
    totalGrossRevenue: number;
    commissionPercent: number;
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
  // Helper para formatar data local (evita problemas de timezone com toISOString)
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const startDateStr = startDate ? formatLocalDate(startDate) : null;
  const endDateStr = endDate ? formatLocalDate(endDate) : null;

  return useQuery({
    queryKey: ["kiwify-financials", startDateStr, endDateStr],
    queryFn: async () => {
      console.log("📊 useKiwifyFinancials: Buscando dados de kiwify_events", { startDateStr, endDateStr });

      // Buscar mapeamentos de produtos usando helper centralizado
      const { offerMap, productIdMap } = await fetchProductMappings();
      console.log(`📊 useKiwifyFinancials: Loaded ${offerMap.size} offer mappings + ${productIdMap.size} product_id mappings`);
      // Aplicar margem de 7 dias no created_at para otimização do banco
      // A filtragem precisa será feita em memória usando approved_date do payload
      const marginDays = 7;
      let createdAtStart: string | null = null;
      let createdAtEnd: string | null = null;

      if (startDate) {
        const marginStartDate = new Date(startDate);
        marginStartDate.setDate(marginStartDate.getDate() - marginDays);
        createdAtStart = marginStartDate.toISOString();
      }
      if (endDate) {
        const marginEndDate = new Date(endDate);
        marginEndDate.setDate(marginEndDate.getDate() + marginDays);
        createdAtEnd = marginEndDate.toISOString();
      }

      // Função para verificar se evento está dentro do período usando approved_date
      const isWithinDateRange = (payload: any): boolean => {
        if (!startDateStr || !endDateStr) return true;
        
        const approvedDate = payload?.approved_date;
        if (!approvedDate) return false;
        
        // approved_date vem como "2025-01-16 10:30:00" - extrair apenas a data
        const eventDateStr = approvedDate.split(' ')[0];
        return eventDateStr >= startDateStr && eventDateStr <= endDateStr;
      };

      // Primeiro, buscar a contagem total de eventos para saber quantas páginas precisamos
      let countQuery = supabase
        .from("kiwify_events")
        .select("id", { count: "exact", head: true })
        .in("event_type", ["paid", "order_approved"]);

      if (createdAtStart) countQuery = countQuery.gte("created_at", createdAtStart);
      if (createdAtEnd) countQuery = countQuery.lte("created_at", createdAtEnd);

      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error("❌ useKiwifyFinancials: Erro ao contar eventos:", countError);
        throw countError;
      }

      const totalEvents = count || 0;
      console.log(`📊 useKiwifyFinancials: Total de ${totalEvents} eventos para buscar (com margem)`);

      // Buscar todos os eventos com paginação (Supabase limita a 1000 por query)
      // Safety cap: máximo 50 páginas (50k registros)
      const pageSize = 1000;
      const maxPages = 50;
      const totalPages = Math.min(Math.ceil(totalEvents / pageSize), maxPages);
      const allEvents: any[] = [];

      for (let page = 0; page < totalPages; page++) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        let pageQuery = supabase
          .from("kiwify_events")
          .select("*")
          .in("event_type", ["paid", "order_approved"]);

        if (createdAtStart) pageQuery = pageQuery.gte("created_at", createdAtStart);
        if (createdAtEnd) pageQuery = pageQuery.lte("created_at", createdAtEnd);

        const { data: pageData, error: pageError } = await pageQuery.range(from, to);

        if (pageError) {
          console.error(`❌ useKiwifyFinancials: Erro na página ${page}:`, pageError);
          throw pageError;
        }

        if (pageData) {
          allEvents.push(...pageData);
        }

        console.log(`📊 useKiwifyFinancials: Página ${page + 1}/${totalPages} - ${pageData?.length || 0} eventos`);
      }

      console.log(`✅ useKiwifyFinancials: ${allEvents.length} eventos carregados (total bruto com margem)`);

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
        totalGrossRevenue: number;
      }>();

      events.forEach(event => {
        const payload = event.payload as KiwifyEventPayload;
        
        // 🆕 CORREÇÃO: Filtrar por approved_date em memória
        if (!isWithinDateRange(payload)) return;
        
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

        // Breakdown por produto - USAR MAPEAMENTO CENTRALIZADO
        const mappedProduct = getMappedProduct(payload, offerMap, productIdMap);
        const productName = mappedProduct.name;
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

        // 🆕 CORREÇÃO: Evolução mensal usando approved_date do payload
        const approvedDate = (payload as any)?.approved_date;
        const month = approvedDate ? approvedDate.substring(0, 7) : null; // YYYY-MM
        if (!month) return;
        
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
              totalGrossRevenue: 0,
            });
          }
          const affiliate = affiliateMap.get(key)!;
          affiliate.salesCount++;
          affiliate.totalCommission += affiliateCommission;
          affiliate.totalGrossRevenue += grossValue;
        }
      });

      const productBreakdown = Array.from(productMap.values()).map(p => ({
        ...p,
        marginPercent: p.grossRevenue > 0 ? (p.netRevenue / p.grossRevenue) * 100 : 0,
      }));

      const monthlyEvolution = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

      const topAffiliates = Array.from(affiliateMap.values())
        .map(a => ({
          ...a,
          commissionPercent: a.totalGrossRevenue > 0 ? (a.totalCommission / a.totalGrossRevenue) * 100 : 0,
        }))
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
