import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface KiwifyEventPayload {
  order_id?: string;
  order_status?: string;
  product_base_price?: number;
  product_name?: string;
  product_id?: string;
  subscription_status?: string;
  Customer?: {
    email?: string;
    full_name?: string;
  };
  Commissions?: {
    product_base_price?: number;
    my_commission?: number;
    funds_status?: string;
    kiwify_fee?: number;
    affiliate_commission?: number;
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

interface StatusMetric {
  quantidade: number;
  valor: number;
}

export interface KiwifyCompleteMetrics {
  // VENDAS
  vendasAprovadas: number;
  vendasNovas: number;
  renovacoes: number;
  
  // RECEITAS
  receitaBruta: number;
  taxaKiwify: number;
  comissaoAfiliados: number;
  receitaLiquida: number;
  
  // PERCENTUAIS
  percentualTaxaKiwify: number;
  percentualComissao: number;
  percentualLiquido: number;
  
  // CANCELAMENTOS / CHURN
  reembolsos: StatusMetric;
  chargebacks: StatusMetric;
  reembolsosPendentes: StatusMetric;
  taxaChurn: number;
  
  // PAGAMENTOS PENDENTES
  aguardandoPagamento: StatusMetric;
  recusados: StatusMetric;
  cancelados: StatusMetric;
  
  // POR PRODUTO
  porProduto: ProductMetric[];
  
  // RESUMO GERAL
  totalEventos: number;
}

export function useKiwifyCompleteMetrics(startDate?: Date, endDate?: Date, minValue: number = 0) {
  return useQuery({
    queryKey: ['kiwify-complete-metrics', startDate?.toISOString(), endDate?.toISOString(), minValue],
    queryFn: async (): Promise<KiwifyCompleteMetrics> => {
      // Build date filter
      let dateFilter = '';
      if (startDate && endDate) {
        const startISO = startDate.toISOString();
        const endISO = endDate.toISOString();
        dateFilter = `and.created_at.gte.${startISO},and.created_at.lte.${endISO}`;
      }

      // Fetch all events for the period
      const allEvents: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('kiwify_events')
          .select('event_type, payload, created_at')
          .range(page * pageSize, (page + 1) * pageSize - 1)
          .order('created_at', { ascending: false });

        if (startDate && endDate) {
          query = query.gte('created_at', startDate.toISOString())
                       .lte('created_at', endDate.toISOString());
        }

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

      // Separate events by type
      const approvedEvents: any[] = [];
      const refundedEvents: any[] = [];
      const chargebackEvents: any[] = [];
      const refundRequestedEvents: any[] = [];
      const waitingPaymentEvents: any[] = [];
      const refusedEvents: any[] = [];
      const canceledEvents: any[] = [];

      // Track order_ids to dedupe
      const approvedOrderIds = new Set<string>();
      const refundedOrderIds = new Set<string>();
      const chargebackOrderIds = new Set<string>();
      const refundRequestedOrderIds = new Set<string>();
      const waitingPaymentOrderIds = new Set<string>();
      const refusedOrderIds = new Set<string>();
      const canceledOrderIds = new Set<string>();

      for (const event of allEvents) {
        const payload = event.payload as KiwifyEventPayload;
        const orderId = payload?.order_id;
        const grossValue = Number(payload?.Commissions?.product_base_price || payload?.product_base_price || 0);
        
        // Filter by minimum value
        if (grossValue < minValue) continue;

        switch (event.event_type) {
          case 'paid':
          case 'order_approved':
            if (orderId && !approvedOrderIds.has(orderId)) {
              approvedOrderIds.add(orderId);
              approvedEvents.push(event);
            }
            break;
          case 'refunded':
            if (orderId && !refundedOrderIds.has(orderId)) {
              refundedOrderIds.add(orderId);
              refundedEvents.push(event);
            }
            break;
          case 'chargedback':
            if (orderId && !chargebackOrderIds.has(orderId)) {
              chargebackOrderIds.add(orderId);
              chargebackEvents.push(event);
            }
            break;
          case 'refund_requested':
            if (orderId && !refundRequestedOrderIds.has(orderId)) {
              refundRequestedOrderIds.add(orderId);
              refundRequestedEvents.push(event);
            }
            break;
          case 'waiting_payment':
            if (orderId && !waitingPaymentOrderIds.has(orderId)) {
              waitingPaymentOrderIds.add(orderId);
              waitingPaymentEvents.push(event);
            }
            break;
          case 'refused':
            if (orderId && !refusedOrderIds.has(orderId)) {
              refusedOrderIds.add(orderId);
              refusedEvents.push(event);
            }
            break;
          case 'canceled':
            if (orderId && !canceledOrderIds.has(orderId)) {
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

      // Track customer emails for new vs renewal classification
      const customerPurchaseCounts = new Map<string, number>();

      // Calculate metrics for approved sales
      let receitaBruta = 0;
      let receitaLiquida = 0;
      let taxaKiwify = 0;
      let comissaoAfiliados = 0;
      let vendasNovas = 0;
      let renovacoes = 0;

      // Product breakdown
      const productMap = new Map<string, ProductMetric>();

      for (const event of finalApprovedEvents) {
        const payload = event.payload as KiwifyEventPayload;
        const commissions = payload?.Commissions;
        
        const grossValue = Number(commissions?.product_base_price || payload?.product_base_price || 0);
        const netValue = Number(commissions?.my_commission || 0);
        const kiwifyFee = Number(commissions?.kiwify_fee || 0);
        const affiliateFee = Number(commissions?.affiliate_commission || 0);
        
        receitaBruta += grossValue;
        receitaLiquida += netValue;
        taxaKiwify += kiwifyFee;
        comissaoAfiliados += affiliateFee;
        
        // Classify new vs renewal based on purchase_number or customer email count
        const purchaseNumber = payload?.purchase_number || 1;
        const customerEmail = payload?.Customer?.email?.toLowerCase() || '';
        
        if (customerEmail) {
          const currentCount = customerPurchaseCounts.get(customerEmail) || 0;
          customerPurchaseCounts.set(customerEmail, currentCount + 1);
          
          if (purchaseNumber > 1 || currentCount > 0) {
            renovacoes++;
          } else {
            vendasNovas++;
          }
        } else {
          vendasNovas++;
        }

        // Product breakdown
        const productName = payload?.product_name || 'Produto Desconhecido';
        const productId = payload?.product_id || 'unknown';
        
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
      }

      // Calculate status metrics
      const calculateStatusMetric = (events: any[]): StatusMetric => {
        let valor = 0;
        for (const event of events) {
          const payload = event.payload as KiwifyEventPayload;
          const grossValue = Number(payload?.Commissions?.product_base_price || payload?.product_base_price || 0);
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

      // Calculate churn rate (refunds + chargebacks / total approved * 100)
      const totalCancelamentos = reembolsos.quantidade + chargebacks.quantidade;
      const totalVendasBase = finalApprovedEvents.length + totalCancelamentos;
      const taxaChurn = totalVendasBase > 0 
        ? (totalCancelamentos / totalVendasBase) * 100 
        : 0;

      // Calculate percentages
      const percentualTaxaKiwify = receitaBruta > 0 ? (taxaKiwify / receitaBruta) * 100 : 0;
      const percentualComissao = receitaBruta > 0 ? (comissaoAfiliados / receitaBruta) * 100 : 0;
      const percentualLiquido = receitaBruta > 0 ? (receitaLiquida / receitaBruta) * 100 : 0;

      // Sort products by gross revenue
      const porProduto = Array.from(productMap.values())
        .sort((a, b) => b.bruto - a.bruto);

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
        totalEventos: allEvents.length
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
}
