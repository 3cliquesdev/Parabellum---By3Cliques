import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProductOffer {
  id: string;
  product_id: string;
  offer_id: string;
  offer_name: string;
  price: number;
  source: string;
  source_type: 'afiliado' | 'organico' | 'comercial' | 'unknown';
  is_active: boolean;
  created_at: string;
}

// Hook para buscar ofertas de um produto
export const useProductOffers = (productId: string | null) => {
  return useQuery({
    queryKey: ["product-offers", productId],
    queryFn: async () => {
      if (!productId) return [];
      
      const { data, error } = await supabase
        .from("product_offers")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as ProductOffer[];
    },
    enabled: !!productId,
  });
};

// Hook para criar oferta
export const useCreateProductOffer = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (offer: {
      product_id: string;
      offer_id: string;
      offer_name: string;
      price: number;
      source?: string;
      source_type?: 'afiliado' | 'organico' | 'comercial' | 'unknown';
    }) => {
      // Buscar TODOS os registros existentes para esse offer_id (pode haver duplicatas)
      const { data: existingList, error: fetchError } = await supabase
        .from("product_offers")
        .select("id, product_id, created_at")
        .eq("offer_id", offer.offer_id)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      // Se existem registros
      if (existingList && existingList.length > 0) {
        const primary = existingList[0]; // Mais recente
        const duplicates = existingList.slice(1); // Resto são duplicatas

        // Limpar duplicatas se houver
        if (duplicates.length > 0) {
          const duplicateIds = duplicates.map(d => d.id);
          await supabase
            .from("product_offers")
            .delete()
            .in("id", duplicateIds);
        }

        // Se o registro principal já está no produto destino, não faz nada
        if (primary.product_id === offer.product_id) {
          return { 
            ...primary, 
            alreadyExists: true, 
            duplicatesRemoved: duplicates.length 
          };
        }

        // Move o registro principal para o novo produto
        const { data, error } = await supabase
          .from("product_offers")
          .update({ product_id: offer.product_id })
          .eq("id", primary.id)
          .select()
          .single();

        if (error) throw error;
        return { 
          ...data, 
          wasMoved: true, 
          duplicatesRemoved: duplicates.length 
        };
      }

      // Não existe, criar novo
      const { data, error } = await supabase
        .from("product_offers")
        .insert({
          product_id: offer.product_id,
          offer_id: offer.offer_id,
          offer_name: offer.offer_name,
          price: offer.price,
          source: offer.source || "kiwify",
          source_type: offer.source_type || "unknown",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["product-offers", variables.product_id] });
      queryClient.invalidateQueries({ queryKey: ["unmapped-kiwify-offers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["kiwify-subscriptions"] });
      
      const duplicatesMsg = data?.duplicatesRemoved 
        ? ` (${data.duplicatesRemoved} duplicata(s) removida(s))` 
        : '';

      if (data?.alreadyExists) {
        toast({
          title: "Oferta já vinculada",
          description: `Esta oferta já está vinculada a este produto.${duplicatesMsg}`,
        });
      } else if (data?.wasMoved) {
        toast({
          title: "Oferta movida",
          description: `A oferta foi movida para este produto.${duplicatesMsg}`,
        });
      } else {
        toast({
          title: "Oferta adicionada",
          description: "A oferta foi vinculada ao produto com sucesso.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar oferta",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// Hook para deletar oferta
export const useDeleteProductOffer = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (offerId: string) => {
      const { error } = await supabase
        .from("product_offers")
        .delete()
        .eq("id", offerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-offers"] });
      queryClient.invalidateQueries({ queryKey: ["kiwify-subscriptions"] });
      toast({
        title: "Oferta removida",
        description: "A oferta foi removida do produto.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover oferta",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// Hook para mover oferta para outro produto
export const useMoveProductOffer = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      offerId,
      newProductId,
      offerExternalId,
    }: {
      offerId: string;
      newProductId: string;
      offerExternalId?: string;
    }) => {
      // Ensure destination doesn't already have this offer_id (unique constraint)
      let offerIdToCheck = offerExternalId;

      if (!offerIdToCheck) {
        const { data: offerRow, error: offerError } = await supabase
          .from("product_offers")
          .select("offer_id")
          .eq("id", offerId)
          .single();

        if (offerError) throw offerError;
        offerIdToCheck = offerRow.offer_id;
      }

      const { data: existing, error: existingError } = await supabase
        .from("product_offers")
        .select("id")
        .eq("product_id", newProductId)
        .eq("offer_id", offerIdToCheck)
        .maybeSingle();

      if (existingError) throw existingError;
      
      // Se destino já tem essa oferta, apenas remove do produto atual (mescla)
      if (existing?.id) {
        const { error: deleteError } = await supabase
          .from("product_offers")
          .delete()
          .eq("id", offerId);

        if (deleteError) throw deleteError;
        return { merged: true };
      }

      // Caso contrário, move normalmente
      const { error } = await supabase
        .from("product_offers")
        .update({ product_id: newProductId })
        .eq("id", offerId);

      if (error) throw error;
      return { merged: false };
    },
    onSuccess: (result) => {
      // Invalida todas as queries relacionadas a ofertas e produtos
      queryClient.invalidateQueries({ queryKey: ["product-offers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["kiwify-subscriptions"] });
      toast({
        title: result?.merged ? "Oferta mesclada" : "Oferta movida",
        description: result?.merged 
          ? "O produto destino já tinha esta oferta. Removemos do produto atual."
          : "A oferta foi movida para o novo produto com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao mover oferta",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
