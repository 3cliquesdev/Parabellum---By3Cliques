import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KiwifyUnmappedOffer {
  kiwify_product_id: string;
  product_name: string;
  offer_id: string | null;
  offer_name: string | null;
  total_sales: number;
  total_revenue: number;
}

export function useKiwifyUnmappedOffers() {
  return useQuery({
    queryKey: ['kiwify-unmapped-offers'],
    queryFn: async () => {
      // Buscar ofertas únicas dos eventos Kiwify que ainda não estão mapeadas
      const { data: events, error } = await supabase
        .from('kiwify_events')
        .select('payload, offer_id')
        .in('event_type', ['paid', 'order_approved'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Agregar por offer_id e product_id
      const offerMap = new Map<string, KiwifyUnmappedOffer>();

      for (const event of events || []) {
        const payload = event.payload as any;
        const subscriptionOfferId = payload?.Subscription?.plan?.id;
        const subscriptionOfferName = payload?.Subscription?.plan?.name;
        const productId = payload?.Product?.product_id;
        const productName = payload?.Product?.product_name;
        const grossValue = (payload?.Commissions?.product_base_price || 0) / 100;

        // Usar Subscription.plan.id como offer_id principal
        const offerId = subscriptionOfferId || event.offer_id || productId;
        const offerName = subscriptionOfferName || productName;

        if (!offerId) continue;

        const key = offerId;
        const existing = offerMap.get(key);

        if (existing) {
          existing.total_sales++;
          existing.total_revenue += grossValue;
        } else {
          offerMap.set(key, {
            kiwify_product_id: productId || '',
            product_name: productName || '',
            offer_id: offerId,
            offer_name: offerName || null,
            total_sales: 1,
            total_revenue: grossValue,
          });
        }
      }

      // Buscar ofertas já mapeadas
      const { data: mappedOffers } = await supabase
        .from('product_offers')
        .select('offer_id');

      const mappedIds = new Set(mappedOffers?.map(o => o.offer_id) || []);

      // Filtrar apenas ofertas não mapeadas
      const unmapped = Array.from(offerMap.values())
        .filter(o => o.offer_id && !mappedIds.has(o.offer_id))
        .sort((a, b) => b.total_sales - a.total_sales);

      return unmapped;
    },
    staleTime: 60 * 1000, // 1 minuto
  });
}

export function useKiwifyOfferStats() {
  return useQuery({
    queryKey: ['kiwify-offer-stats'],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from('kiwify_events')
        .select('offer_id')
        .in('event_type', ['paid', 'order_approved']);

      if (error) throw error;

      const total = events?.length || 0;
      const withOfferId = events?.filter(e => e.offer_id).length || 0;
      const withoutOfferId = total - withOfferId;

      return {
        total,
        withOfferId,
        withoutOfferId,
        mappedPercentage: total > 0 ? Math.round((withOfferId / total) * 100) : 0,
      };
    },
    staleTime: 60 * 1000,
  });
}
