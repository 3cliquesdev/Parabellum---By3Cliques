import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface FraudulentCustomer {
  customer_email: string;
  customer_name: string;
  customer_cpf: string;
  offer_id: string;
  offer_name: string;
  product_name: string;
  total_purchases: number;
  first_purchase: string;
  last_purchase: string;
  purchase_dates: string[];
  total_value: number;
  order_ids: string[];
}

export interface FraudStats {
  totalFraudulentCustomers: number;
  totalDuplicatePurchases: number;
  estimatedLostValue: number;
  fraudPercentage: number;
}

export interface FraudDetectionFilters {
  offerId?: string;
  maxValue?: number;
  startDate?: Date;
  endDate?: Date;
  minPurchases?: number;
}

export function useFraudDetection(filters: FraudDetectionFilters = {}) {
  const { minPurchases = 2, maxValue, offerId, startDate, endDate } = filters;

  return useQuery({
    queryKey: ['fraud-detection', filters],
    queryFn: async () => {
      // Buscar eventos de pagamento
      let query = supabase
        .from('kiwify_events')
        .select('payload, offer_id, created_at, order_id')
        .in('event_type', ['paid', 'order_approved'])
        .order('created_at', { ascending: false })
        .limit(5000);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data: events, error } = await query;

      if (error) throw error;

      // Agrupar compras por customer + offer
      const customerOfferMap = new Map<string, {
        customer_email: string;
        customer_name: string;
        customer_cpf: string;
        offer_id: string;
        offer_name: string;
        product_name: string;
        purchases: { date: string; value: number; order_id: string }[];
      }>();

      for (const event of events || []) {
        const payload = event.payload as any;
        const customerEmail = payload?.Customer?.email?.toLowerCase();
        const customerName = payload?.Customer?.full_name || 'N/A';
        const customerCpf = payload?.Customer?.CPF || 'N/A';
        const subscriptionOfferId = payload?.Subscription?.plan?.id;
        const subscriptionOfferName = payload?.Subscription?.plan?.name;
        const productId = payload?.Product?.product_id;
        const productName = payload?.Product?.product_name || 'N/A';
        const grossValue = (payload?.Commissions?.product_base_price || 0) / 100;
        const orderId = event.order_id || payload?.order_id;

        // Determinar offer_id
        const currentOfferId = subscriptionOfferId || event.offer_id || productId;
        const currentOfferName = subscriptionOfferName || productName;

        if (!customerEmail || !currentOfferId) continue;

        // Filtro por valor máximo
        if (maxValue && grossValue > maxValue) continue;

        // Filtro por offer específica
        if (offerId && currentOfferId !== offerId) continue;

        const key = `${customerEmail}|${currentOfferId}`;
        const existing = customerOfferMap.get(key);

        const purchaseDate = format(new Date(event.created_at), 'dd/MM/yyyy');

        if (existing) {
          // Verificar se já existe essa order_id (deduplicar)
          if (!existing.purchases.some(p => p.order_id === orderId)) {
            existing.purchases.push({
              date: purchaseDate,
              value: grossValue,
              order_id: orderId
            });
          }
        } else {
          customerOfferMap.set(key, {
            customer_email: customerEmail,
            customer_name: customerName,
            customer_cpf: customerCpf,
            offer_id: currentOfferId,
            offer_name: currentOfferName,
            product_name: productName,
            purchases: [{
              date: purchaseDate,
              value: grossValue,
              order_id: orderId
            }]
          });
        }
      }

      // Filtrar apenas clientes com múltiplas compras
      const fraudulentCustomers: FraudulentCustomer[] = [];
      let totalDuplicatePurchases = 0;
      let estimatedLostValue = 0;
      let totalLegitPurchases = 0;

      for (const [_, data] of customerOfferMap) {
        const purchaseCount = data.purchases.length;
        
        if (purchaseCount >= minPurchases) {
          // Ordenar por data
          const sortedPurchases = data.purchases.sort((a, b) => 
            new Date(a.date.split('/').reverse().join('-')).getTime() - 
            new Date(b.date.split('/').reverse().join('-')).getTime()
          );

          const duplicates = purchaseCount - 1; // Primeira compra é legítima
          const avgValue = data.purchases.reduce((sum, p) => sum + p.value, 0) / purchaseCount;
          
          totalDuplicatePurchases += duplicates;
          estimatedLostValue += duplicates * avgValue;

          fraudulentCustomers.push({
            customer_email: data.customer_email,
            customer_name: data.customer_name,
            customer_cpf: data.customer_cpf,
            offer_id: data.offer_id,
            offer_name: data.offer_name,
            product_name: data.product_name,
            total_purchases: purchaseCount,
            first_purchase: sortedPurchases[0].date,
            last_purchase: sortedPurchases[sortedPurchases.length - 1].date,
            purchase_dates: sortedPurchases.map(p => p.date),
            total_value: data.purchases.reduce((sum, p) => sum + p.value, 0),
            order_ids: sortedPurchases.map(p => p.order_id)
          });
        } else {
          totalLegitPurchases += purchaseCount;
        }
      }

      // Ordenar por quantidade de compras (mais grave primeiro)
      fraudulentCustomers.sort((a, b) => b.total_purchases - a.total_purchases);

      const stats: FraudStats = {
        totalFraudulentCustomers: fraudulentCustomers.length,
        totalDuplicatePurchases,
        estimatedLostValue,
        fraudPercentage: totalLegitPurchases > 0 
          ? Math.round((totalDuplicatePurchases / (totalDuplicatePurchases + totalLegitPurchases)) * 100) 
          : 0
      };

      return {
        customers: fraudulentCustomers,
        stats
      };
    },
    staleTime: 60 * 1000, // 1 minuto
  });
}

// Hook para buscar ofertas disponíveis para filtro
export function useKiwifyOffersList() {
  return useQuery({
    queryKey: ['kiwify-offers-list'],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from('kiwify_events')
        .select('payload, offer_id')
        .in('event_type', ['paid', 'order_approved'])
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) throw error;

      const offersMap = new Map<string, { id: string; name: string; value: number; count: number }>();

      for (const event of events || []) {
        const payload = event.payload as any;
        const subscriptionOfferId = payload?.Subscription?.plan?.id;
        const subscriptionOfferName = payload?.Subscription?.plan?.name;
        const productId = payload?.Product?.product_id;
        const productName = payload?.Product?.product_name;
        const grossValue = (payload?.Commissions?.product_base_price || 0) / 100;

        const offerId = subscriptionOfferId || event.offer_id || productId;
        const offerName = subscriptionOfferName || productName || 'Sem nome';

        if (!offerId) continue;

        const existing = offersMap.get(offerId);
        if (existing) {
          existing.count++;
        } else {
          offersMap.set(offerId, {
            id: offerId,
            name: offerName,
            value: grossValue,
            count: 1
          });
        }
      }

      return Array.from(offersMap.values())
        .sort((a, b) => b.count - a.count);
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
