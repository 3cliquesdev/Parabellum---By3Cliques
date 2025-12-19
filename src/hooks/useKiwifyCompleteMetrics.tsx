import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface KiwifyEventPayload {
  order_id?: string;
  order_status?: string;
  approved_date?: string; // Format: '2025-12-17 17:14'
  product_base_price?: number;
  product_name?: string;
  product_id?: string;
  subscription_status?: string;
  Customer?: {
    email?: string;
    full_name?: string;
  };
  Product?: {
    product_name?: string;
    product_id?: string;
  };
  Commissions?: {
    product_base_price?: number;
    my_commission?: number;
    funds_status?: string;
    kiwify_fee?: number;
    commissioned_stores?: Array<{
      type: string;
      value: number | string;
      email?: string;
      custom_name?: string;
    }>;
  };
  Subscription?: {
    charges?: {
      completed?: any[];
    };
    plan?: {
      id?: string;
      name?: string;
    };
  };
  purchase_number?: number;
}

interface ProductMetric {
  product_name: string;
  product_id: string;
  vendas: number;
  bruto: number;
  liquido: number;
  taxaKiwify: number;
  comissaoAfiliados: number;
}

interface OfferMetric {
  offer_id: string;
  offer_name: string;
  product_name: string;
  vendas: number;
  bruto: number;
  liquido: number;
}

interface UnmappedOffer {
  offer_id: string;
  offer_name: string;
  product_name: string;
  vendas: number;
  bruto: number;
}

interface StatusMetric {
  quantidade: number;
  valor: number;
}

interface AffiliateMetric {
  affiliateName: string;
  affiliateEmail: string;
  salesCount: number;
  totalCommission: number;
}

export interface KiwifyCompleteMetrics {
  vendasAprovadas: number;
  vendasNovas: number;
  renovacoes: number;
  receitaBruta: number;
  taxaKiwify: number;
  comissaoAfiliados: number;
  receitaLiquida: number;
  percentualTaxaKiwify: number;
  percentualComissao: number;
  percentualLiquido: number;
  reembolsos: StatusMetric;
  chargebacks: StatusMetric;
  reembolsosPendentes: StatusMetric;
  taxaChurn: number;
  aguardandoPagamento: StatusMetric;
  recusados: StatusMetric;
  cancelados: StatusMetric;
  porProduto: ProductMetric[];
  porOferta: OfferMetric[];
  ofertasNaoMapeadas: UnmappedOffer[];
  topAffiliates: AffiliateMetric[];
  totalEventos: number;
}

export function useKiwifyCompleteMetrics(startDate?: Date, endDate?: Date, minValue: number = 0) {
  return useQuery({
    queryKey: ['kiwify-complete-metrics', startDate?.toISOString(), endDate?.toISOString(), minValue],
    queryFn: async (): Promise<KiwifyCompleteMetrics> => {
      // Format dates for approved_date comparison (YYYY-MM-DD)
      const startDateStr = startDate ? startDate.toISOString().split('T')[0] : null;
      const endDateStr = endDate ? endDate.toISOString().split('T')[0] : null;
      
      // Fetch all events (we'll filter by approved_date in JS since it's in payload)
      const allEvents: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const query = supabase
          .from('kiwify_events')
          .select('event_type, payload, created_at')
          .range(page * pageSize, (page + 1) * pageSize - 1)
          .order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;
        
        if (data && data.length > 0) {
          allEvents.push(...data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      // Helper to check if event is within date range using ONLY approved_date from payload
      const isWithinDateRange = (payload: KiwifyEventPayload): boolean => {
        if (!startDateStr || !endDateStr) return true;
        
        const approvedDate = payload?.approved_date;
        if (!approvedDate) return false; // Excluir eventos sem approved_date
        
        // approved_date format: '2025-12-17 17:14' - extract just the date part
        const eventDateStr = approvedDate.split(' ')[0];
        
        // Compare strings: startDateStr <= eventDateStr <= endDateStr
        return eventDateStr >= startDateStr && eventDateStr <= endDateStr;
      };

      // Track order_ids to dedupe
      const approvedOrderIds = new Set<string>();
      const refundedOrderIds = new Set<string>();
      const chargebackOrderIds = new Set<string>();
      const refundRequestedOrderIds = new Set<string>();
      const waitingPaymentOrderIds = new Set<string>();
      const refusedOrderIds = new Set<string>();
      const canceledOrderIds = new Set<string>();

      // Separate events by type with deduplication
      const approvedEvents: any[] = [];
      const refundedEvents: any[] = [];
      const chargebackEvents: any[] = [];
      const refundRequestedEvents: any[] = [];
      const waitingPaymentEvents: any[] = [];
      const refusedEvents: any[] = [];
      const canceledEvents: any[] = [];

      for (const event of allEvents) {
        const payload = event.payload as KiwifyEventPayload;
        const orderId = payload?.order_id;
        
        if (!orderId) continue;
        
        // Filter by approved_date ONLY (actual sale date, not webhook reception date)
        if (!isWithinDateRange(payload)) continue;

        // Get value in reais for minValue filter (centavos / 100)
        const grossValueReais = Number(payload?.Commissions?.product_base_price || 0) / 100;
        
        // Filter by minimum value (in reais)
        if (minValue > 0 && grossValueReais < minValue) continue;

        switch (event.event_type) {
          case 'paid':
          case 'order_approved':
            if (!approvedOrderIds.has(orderId)) {
              approvedOrderIds.add(orderId);
              approvedEvents.push(event);
            }
            break;
          case 'refunded':
            if (!refundedOrderIds.has(orderId)) {
              refundedOrderIds.add(orderId);
              refundedEvents.push(event);
            }
            break;
          case 'chargedback':
            if (!chargebackOrderIds.has(orderId)) {
              chargebackOrderIds.add(orderId);
              chargebackEvents.push(event);
            }
            break;
          case 'refund_requested':
            if (!refundRequestedOrderIds.has(orderId)) {
              refundRequestedOrderIds.add(orderId);
              refundRequestedEvents.push(event);
            }
            break;
          case 'waiting_payment':
            if (!waitingPaymentOrderIds.has(orderId)) {
              waitingPaymentOrderIds.add(orderId);
              waitingPaymentEvents.push(event);
            }
            break;
          case 'refused':
            if (!refusedOrderIds.has(orderId)) {
              refusedOrderIds.add(orderId);
              refusedEvents.push(event);
            }
            break;
          case 'canceled':
            if (!canceledOrderIds.has(orderId)) {
              canceledOrderIds.add(orderId);
              canceledEvents.push(event);
            }
            break;
        }
      }

      // Remove approved orders that were later refunded or chargebacked
      const canceledApprovedOrderIds = new Set([...refundedOrderIds, ...chargebackOrderIds]);
      const finalApprovedEvents = approvedEvents.filter(e => {
        const orderId = (e.payload as KiwifyEventPayload)?.order_id;
        return orderId && !canceledApprovedOrderIds.has(orderId);
      });

      // Calculate metrics for approved sales
      let receitaBruta = 0;
      let receitaLiquida = 0;
      let taxaKiwify = 0;
      let comissaoAfiliados = 0;
      let vendasNovas = 0;
      let renovacoes = 0;

      const productMap = new Map<string, ProductMetric>();
      const affiliateMap = new Map<string, AffiliateMetric>();
      const offerMap = new Map<string, OfferMetric>();

      for (const event of finalApprovedEvents) {
        const payload = event.payload as KiwifyEventPayload;
        const commissions = payload?.Commissions;
        
        // Convert centavos to reais (divide by 100)
        const grossValue = Number(commissions?.product_base_price || 0) / 100;
        const netValue = Number(commissions?.my_commission || 0) / 100;
        const kiwifyFee = Number(commissions?.kiwify_fee || 0) / 100;
        // Extract affiliate commission from commissioned_stores array
        const affiliateStore = commissions?.commissioned_stores?.find(s => s.type === 'affiliate');
        const affiliateFee = Number(affiliateStore?.value || 0) / 100;
        
        receitaBruta += grossValue;
        receitaLiquida += netValue;
        taxaKiwify += kiwifyFee;
        comissaoAfiliados += affiliateFee;

        // Track affiliate data
        if (affiliateStore && affiliateFee > 0) {
          const affiliateName = affiliateStore.custom_name || 'Nome não disponível';
          const affiliateEmail = affiliateStore.email || 'Email não disponível';
          const key = affiliateEmail !== 'Email não disponível' ? affiliateEmail : affiliateName;
          
          if (!affiliateMap.has(key)) {
            affiliateMap.set(key, {
              affiliateName,
              affiliateEmail,
              salesCount: 0,
              totalCommission: 0
            });
          }
          const affiliate = affiliateMap.get(key)!;
          affiliate.salesCount++;
          affiliate.totalCommission += affiliateFee;
        }
        
        // Classify new vs renewal based on Subscription.charges.completed array
        const chargesCompleted = payload?.Subscription?.charges?.completed || [];
        const isRenewal = chargesCompleted.length > 1;
        
        if (isRenewal) {
          renovacoes++;
        } else {
          vendasNovas++;
        }

        // Product breakdown - use Product object path
        const productName = payload?.Product?.product_name || payload?.product_name || 'Produto Desconhecido';
        const productId = payload?.Product?.product_id || payload?.product_id || 'unknown';
        
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            product_name: productName,
            product_id: productId,
            vendas: 0,
            bruto: 0,
            liquido: 0,
            taxaKiwify: 0,
            comissaoAfiliados: 0
          });
        }
        
        const product = productMap.get(productId)!;
        product.vendas++;
        product.bruto += grossValue;
        product.liquido += netValue;
        product.taxaKiwify += kiwifyFee;
        product.comissaoAfiliados += affiliateFee;

        // Offer breakdown - use Subscription.plan.id or fallback
        const offerId = payload?.Subscription?.plan?.id || productId;
        const offerName = payload?.Subscription?.plan?.name || productName;
        
        if (!offerMap.has(offerId)) {
          offerMap.set(offerId, {
            offer_id: offerId,
            offer_name: offerName,
            product_name: productName,
            vendas: 0,
            bruto: 0,
            liquido: 0
          });
        }
        
        const offer = offerMap.get(offerId)!;
        offer.vendas++;
        offer.bruto += grossValue;
        offer.liquido += netValue;
      }

      // Calculate status metrics (in reais)
      const calculateStatusMetric = (events: any[]): StatusMetric => {
        let valor = 0;
        for (const event of events) {
          const payload = event.payload as KiwifyEventPayload;
          const grossValue = Number(payload?.Commissions?.product_base_price || 0) / 100;
          valor += grossValue;
        }
        return { quantidade: events.length, valor };
      };

      const reembolsos = calculateStatusMetric(refundedEvents);
      const chargebacks = calculateStatusMetric(chargebackEvents);
      const reembolsosPendentes = calculateStatusMetric(refundRequestedEvents);
      const aguardandoPagamento = calculateStatusMetric(waitingPaymentEvents);
      const recusados = calculateStatusMetric(refusedEvents);
      const cancelados = calculateStatusMetric(canceledEvents);

      // Calculate churn rate
      const totalCancelamentos = reembolsos.quantidade + chargebacks.quantidade;
      const totalVendasBase = finalApprovedEvents.length + totalCancelamentos;
      const taxaChurn = totalVendasBase > 0 ? (totalCancelamentos / totalVendasBase) * 100 : 0;

      // Calculate percentages
      const percentualTaxaKiwify = receitaBruta > 0 ? (taxaKiwify / receitaBruta) * 100 : 0;
      const percentualComissao = receitaBruta > 0 ? (comissaoAfiliados / receitaBruta) * 100 : 0;
      const percentualLiquido = receitaBruta > 0 ? (receitaLiquida / receitaBruta) * 100 : 0;

      const porProduto = Array.from(productMap.values()).sort((a, b) => b.bruto - a.bruto);
      const porOferta = Array.from(offerMap.values()).sort((a, b) => b.vendas - a.vendas);
      const topAffiliates = Array.from(affiliateMap.values()).sort((a, b) => b.salesCount - a.salesCount);

      // Fetch mapped offers to identify unmapped ones
      const { data: mappedOffers } = await supabase
        .from('product_offers')
        .select('offer_id');
      
      const mappedIds = new Set(mappedOffers?.map(o => o.offer_id) || []);
      
      const ofertasNaoMapeadas: UnmappedOffer[] = porOferta
        .filter(o => !mappedIds.has(o.offer_id))
        .map(o => ({
          offer_id: o.offer_id,
          offer_name: o.offer_name,
          product_name: o.product_name,
          vendas: o.vendas,
          bruto: o.bruto
        }));

      console.log('📊 Kiwify Metrics:', {
        totalEventos: allEvents.length,
        vendasAprovadas: finalApprovedEvents.length,
        receitaBruta: receitaBruta.toFixed(2),
        receitaLiquida: receitaLiquida.toFixed(2),
        taxaKiwify: taxaKiwify.toFixed(2)
      });

      return {
        vendasAprovadas: finalApprovedEvents.length,
        vendasNovas,
        renovacoes,
        receitaBruta,
        taxaKiwify,
        comissaoAfiliados,
        receitaLiquida,
        percentualTaxaKiwify,
        percentualComissao,
        percentualLiquido,
        reembolsos,
        chargebacks,
        reembolsosPendentes,
        taxaChurn,
        aguardandoPagamento,
        recusados,
        cancelados,
        porProduto,
        porOferta,
        ofertasNaoMapeadas,
        topAffiliates,
        totalEventos: allEvents.length
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
