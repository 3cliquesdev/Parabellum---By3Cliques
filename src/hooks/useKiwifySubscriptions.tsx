import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProductCategory = 'Associado Premium' | 'Shopee Creation' | 'Híbrido' | 'Uni 3 Cliques' | 'Outros';
export type SubscriptionStatus = 'active' | 'canceled' | 'ended' | 'all';

export interface SubscriptionData {
  id: string;
  orderId: string;
  startDate: string;
  productName: string;
  productCategory: ProductCategory;
  offerName: string;
  customerName: string;
  customerEmail: string;
  status: 'active' | 'canceled' | 'ended';
  grossValue: number;
  netValue: number;
  kiwifyFee: number;
  affiliateCommission: number;
}

export interface RefundData {
  orderId: string;
  customerEmail: string;
  customerName: string;
  productName: string;
  refundDate: string;
  originalDate: string;
  value: number;
}

export interface SubscriptionMetrics {
  // Métricas de clientes únicos
  totalAssinaturas: number; // Clientes únicos (emails distintos)
  
  // Métricas de vendas
  vendasBrutas: number; // Total de orders únicos
  vendasLiquidas: number; // Brutas - reembolsos
  reembolsos: RefundData[]; // Lista com data de cada reembolso
  
  // Métricas legadas (mantidas para compatibilidade)
  totalAtivas: number;
  totalCanceladas: number;
  faturamentoRecorrente: number;
  subscriptions: SubscriptionData[];
  byCategory: Record<ProductCategory, { ativas: number; canceladas: number; faturamento: number }>;
}

// Categorize product based on name
function categorizeProduct(productName: string): ProductCategory {
  const name = productName?.toLowerCase() || '';
  
  if (name.includes('uni3cliques') || name.includes('uni 3 cliques') || name.includes('uni3')) {
    return 'Uni 3 Cliques';
  }
  if (name.includes('híbrido') || name.includes('hibrido')) {
    return 'Híbrido';
  }
  if (name.includes('shopee creation') || name.includes('creation') || name.includes('shopee')) {
    return 'Shopee Creation';
  }
  if (name.includes('associado premium') || name.includes('sabr') || name.includes('premium')) {
    return 'Associado Premium';
  }
  
  return 'Outros';
}

// Parse subscription status from Kiwify event
function parseSubscriptionStatus(eventType: string, subscriptionStatus?: string): 'active' | 'canceled' | 'ended' {
  if (eventType === 'subscription_canceled' || subscriptionStatus === 'canceled') {
    return 'canceled';
  }
  if (subscriptionStatus === 'ended') {
    return 'ended';
  }
  return 'active';
}

// Format date for comparison (YYYY-MM-DD)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useKiwifySubscriptions(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['kiwify-subscriptions', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<SubscriptionMetrics> => {
      console.log('[useKiwifySubscriptions] Fetching subscription data...');
      
      // Fetch paid events
      let paidQuery = supabase
        .from('kiwify_events')
        .select('*')
        .eq('event_type', 'paid')
        .order('created_at', { ascending: false });

      // Apply date filters with margin for approved_date filtering
      if (startDate) {
        const marginStart = new Date(startDate);
        marginStart.setDate(marginStart.getDate() - 7);
        paidQuery = paidQuery.gte('created_at', marginStart.toISOString());
      }
      if (endDate) {
        const marginEnd = new Date(endDate);
        marginEnd.setDate(marginEnd.getDate() + 7);
        paidQuery = paidQuery.lte('created_at', marginEnd.toISOString());
      }

      // Paginate to get all paid events
      const allPaidEvents: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore && page < 50) {
        const { data, error } = await paidQuery.range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          console.error('[useKiwifySubscriptions] Error fetching paid events:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allPaidEvents.push(...data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      console.log(`[useKiwifySubscriptions] Total paid events fetched: ${allPaidEvents.length}`);

      // Filter by approved_date within the selected period
      const startDateStr = startDate ? formatLocalDate(startDate) : null;
      const endDateStr = endDate ? formatLocalDate(endDate) : null;

      const filteredPaidEvents = allPaidEvents.filter(event => {
        const payload = event.payload as any;
        const approvedDate = payload?.approved_date;
        if (!approvedDate) return false;
        
        const approvedDateStr = approvedDate.split('T')[0];
        
        if (startDateStr && approvedDateStr < startDateStr) return false;
        if (endDateStr && approvedDateStr > endDateStr) return false;
        
        return true;
      });

      console.log(`[useKiwifySubscriptions] Filtered paid events by approved_date: ${filteredPaidEvents.length}`);

      // Dedupe by order_id (keep first occurrence)
      const uniqueOrdersMap = new Map<string, any>();
      for (const event of filteredPaidEvents) {
        const payload = event.payload as any;
        const orderId = payload?.order_id || payload?.OrderId;
        if (orderId && !uniqueOrdersMap.has(orderId)) {
          uniqueOrdersMap.set(orderId, event);
        }
      }

      const uniqueOrders = Array.from(uniqueOrdersMap.values());
      console.log(`[useKiwifySubscriptions] Unique orders: ${uniqueOrders.length}`);

      // Calculate unique customers (unique emails)
      const uniqueCustomerEmails = new Set<string>();
      for (const event of uniqueOrders) {
        const payload = event.payload as any;
        const email = payload?.Customer?.email || payload?.customer_email;
        if (email) {
          uniqueCustomerEmails.add(email.toLowerCase());
        }
      }

      console.log(`[useKiwifySubscriptions] Unique customers: ${uniqueCustomerEmails.size}`);

      // Fetch refund events for orders in the period
      const orderIds = Array.from(uniqueOrdersMap.keys());
      const refunds: RefundData[] = [];

      if (orderIds.length > 0) {
        // Fetch refunded events
        const { data: refundEvents, error: refundError } = await supabase
          .from('kiwify_events')
          .select('*')
          .eq('event_type', 'refunded');

        if (!refundError && refundEvents) {
          for (const refund of refundEvents) {
            const payload = refund.payload as any;
            const refundOrderId = payload?.order_id || payload?.OrderId;
            
            // Check if this refund is for an order in our period
            if (refundOrderId && uniqueOrdersMap.has(refundOrderId)) {
              const originalEvent = uniqueOrdersMap.get(refundOrderId);
              const originalPayload = originalEvent?.payload as any;
              
              refunds.push({
                orderId: refundOrderId,
                customerEmail: payload?.Customer?.email || payload?.customer_email || '',
                customerName: payload?.Customer?.full_name || payload?.customer_name || 'Cliente',
                productName: payload?.Product?.name || payload?.product_name || 'Produto',
                refundDate: refund.created_at,
                originalDate: originalPayload?.approved_date || originalEvent?.created_at || '',
                value: (payload?.product_base_price || 0) / 100,
              });
            }
          }
        }
      }

      console.log(`[useKiwifySubscriptions] Refunds found: ${refunds.length}`);

      // Process subscriptions for the table and category breakdown
      const subscriptionMap = new Map<string, SubscriptionData>();
      const processedOrderIds = new Set<string>();

      // Fetch subscription status events
      let statusQuery = supabase
        .from('kiwify_events')
        .select('*')
        .in('event_type', ['subscription_canceled', 'subscription_ended'])
        .order('created_at', { ascending: false });

      const { data: statusEvents } = await statusQuery;
      const statusByOrderId = new Map<string, string>();
      
      for (const event of statusEvents || []) {
        const payload = event.payload as any;
        const orderId = payload?.order_id || payload?.OrderId;
        const subscriptionId = payload?.Subscription?.id || payload?.subscription_id;
        const key = subscriptionId || orderId;
        
        if (key && !statusByOrderId.has(key)) {
          statusByOrderId.set(key, event.event_type);
        }
      }

      for (const event of uniqueOrders) {
        const payload = event.payload as any;
        if (!payload) continue;

        const orderId = payload.order_id || payload.OrderId;
        const subscriptionId = payload.Subscription?.id || payload.subscription_id;
        const uniqueKey = subscriptionId || orderId;
        
        if (!uniqueKey) continue;
        if (processedOrderIds.has(uniqueKey)) continue;
        processedOrderIds.add(uniqueKey);

        const productName = payload.Product?.name || payload.product_name || 'Produto não identificado';
        const grossValue = (payload.product_base_price || payload.Product?.price || 0) / 100;
        const myCommission = (payload.my_commission || 0) / 100;
        const kiwifyFee = (payload.kiwify_fee || 0) / 100;
        const affiliateCommission = (payload.affiliate_commission || 0) / 100;
        
        // Determine status
        let status: 'active' | 'canceled' | 'ended' = 'active';
        const statusEvent = statusByOrderId.get(uniqueKey);
        if (statusEvent === 'subscription_canceled') {
          status = 'canceled';
        } else if (statusEvent === 'subscription_ended') {
          status = 'ended';
        }

        // Check if refunded
        const isRefunded = refunds.some(r => r.orderId === orderId);
        if (isRefunded) {
          status = 'canceled';
        }
        
        const subscription: SubscriptionData = {
          id: uniqueKey,
          orderId: orderId || '',
          startDate: payload.approved_date || payload.created_at || event.created_at,
          productName,
          productCategory: categorizeProduct(productName),
          offerName: payload.Subscription?.plan?.name || payload.offer_name || 'Oferta padrão',
          customerName: payload.Customer?.full_name || payload.customer_name || 'Cliente',
          customerEmail: payload.Customer?.email || payload.customer_email || '',
          status,
          grossValue,
          netValue: myCommission,
          kiwifyFee,
          affiliateCommission,
        };

        subscriptionMap.set(uniqueKey, subscription);
      }

      // Convert to array and calculate metrics
      const subscriptions = Array.from(subscriptionMap.values());
      
      // Initialize category metrics
      const categories: ProductCategory[] = ['Associado Premium', 'Shopee Creation', 'Híbrido', 'Uni 3 Cliques', 'Outros'];
      const byCategory: Record<ProductCategory, { ativas: number; canceladas: number; faturamento: number }> = {} as any;
      
      for (const cat of categories) {
        byCategory[cat] = { ativas: 0, canceladas: 0, faturamento: 0 };
      }

      let totalAtivas = 0;
      let totalCanceladas = 0;
      let faturamentoRecorrente = 0;

      for (const sub of subscriptions) {
        const catMetrics = byCategory[sub.productCategory];
        
        if (sub.status === 'active') {
          totalAtivas++;
          catMetrics.ativas++;
          faturamentoRecorrente += sub.netValue;
          catMetrics.faturamento += sub.netValue;
        } else {
          totalCanceladas++;
          catMetrics.canceladas++;
        }
      }

      const result: SubscriptionMetrics = {
        // Novas métricas
        totalAssinaturas: uniqueCustomerEmails.size,
        vendasBrutas: uniqueOrders.length,
        vendasLiquidas: uniqueOrders.length - refunds.length,
        reembolsos: refunds,
        
        // Métricas legadas
        totalAtivas,
        totalCanceladas,
        faturamentoRecorrente,
        subscriptions,
        byCategory,
      };

      console.log(`[useKiwifySubscriptions] Final metrics:`, {
        totalAssinaturas: result.totalAssinaturas,
        vendasBrutas: result.vendasBrutas,
        vendasLiquidas: result.vendasLiquidas,
        reembolsos: result.reembolsos.length,
      });

      return result;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
