import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UnmappedOffer {
  plan_id: string;
  plan_name: string;
  kiwify_product_id?: string;
  kiwify_product_name?: string;
  detected_source_type: 'afiliado' | 'organico';
  event_count: number;
  total_revenue: number;
}

export function useUnmappedOffers() {
  return useQuery({
    queryKey: ["unmapped-kiwify-offers"],
    queryFn: async (): Promise<UnmappedOffer[]> => {
      // Query the view we created
      const { data, error } = await supabase
        .from("unmapped_kiwify_offers")
        .select("*")
        .order("event_count", { ascending: false });

      if (error) {
        console.error("[useUnmappedOffers] Error:", error);
        throw error;
      }

      return (data || []) as UnmappedOffer[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Hook para buscar todas as ofertas mapeadas (para lookup)
// Agora suporta lookup por offer_id E por kiwify_product_id
export function useAllProductOffers() {
  return useQuery({
    queryKey: ["all-product-offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_offers")
        .select(`
          id,
          product_id,
          offer_id,
          kiwify_product_id,
          offer_name,
          source_type,
          products:product_id (
            id,
            name
          )
        `)
        .eq("is_active", true);

      if (error) throw error;

      // Create maps for quick lookup by offer_id AND kiwify_product_id
      const offerMap = new Map<string, { 
        productId: string; 
        productName: string; 
        offerName: string;
        sourceType: string;
      }>();

      const productIdMap = new Map<string, { 
        productId: string; 
        productName: string; 
        offerName: string;
        sourceType: string;
      }>();

      for (const offer of data || []) {
        const mappingData = {
          productId: offer.product_id,
          productName: (offer.products as any)?.name || 'Produto',
          offerName: offer.offer_name || '',
          sourceType: offer.source_type || 'unknown',
        };

        // Map by offer_id
        if (offer.offer_id) {
          offerMap.set(offer.offer_id, mappingData);
        }

        // Also map by kiwify_product_id for fallback
        if (offer.kiwify_product_id) {
          productIdMap.set(offer.kiwify_product_id, mappingData);
        }
      }

      return { offerMap, productIdMap };
    },
    staleTime: 5 * 60 * 1000,
  });
}
