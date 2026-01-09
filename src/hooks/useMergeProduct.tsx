import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MergeProductParams {
  sourceProductId: string;
  destinationProductId: string;
  convertExternalIdToOffer?: boolean;
}

export interface MergeProductPreview {
  offersCount: number;
  dealsCount: number;
  playbooksCount: number;
  boardMappingsCount: number;
  quoteItemsCount: number;
  playbookProductsCount: number;
  sourceExternalId: string | null;
}

export function useMergeProductPreview() {
  return useMutation({
    mutationFn: async (sourceProductId: string): Promise<MergeProductPreview> => {
      const [
        offersRes,
        dealsRes,
        playbooksRes,
        boardMappingsRes,
        quoteItemsRes,
        playbookProductsRes,
        productRes,
      ] = await Promise.all([
        supabase.from("product_offers").select("id", { count: "exact" }).eq("product_id", sourceProductId),
        supabase.from("deals").select("id", { count: "exact" }).eq("product_id", sourceProductId),
        supabase.from("onboarding_playbooks").select("id", { count: "exact" }).eq("product_id", sourceProductId),
        supabase.from("product_board_mappings").select("id", { count: "exact" }).eq("product_id", sourceProductId),
        supabase.from("quote_items").select("id", { count: "exact" }).eq("product_id", sourceProductId),
        supabase.from("playbook_products").select("id", { count: "exact" }).eq("product_id", sourceProductId),
        supabase.from("products").select("external_id").eq("id", sourceProductId).single(),
      ]);

      return {
        offersCount: offersRes.count ?? 0,
        dealsCount: dealsRes.count ?? 0,
        playbooksCount: playbooksRes.count ?? 0,
        boardMappingsCount: boardMappingsRes.count ?? 0,
        quoteItemsCount: quoteItemsRes.count ?? 0,
        playbookProductsCount: playbookProductsRes.count ?? 0,
        sourceExternalId: productRes.data?.external_id ?? null,
      };
    },
  });
}

export function useMergeProduct() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sourceProductId, destinationProductId, convertExternalIdToOffer }: MergeProductParams) => {
      // Get source product info for external_id conversion
      const { data: sourceProduct } = await supabase
        .from("products")
        .select("name, external_id, price")
        .eq("id", sourceProductId)
        .single();

      // 1. Move product_offers
      const { error: offersError } = await supabase
        .from("product_offers")
        .update({ product_id: destinationProductId })
        .eq("product_id", sourceProductId);
      if (offersError) throw new Error(`Erro ao mover ofertas: ${offersError.message}`);

      // 2. Move product_board_mappings
      const { error: mappingsError } = await supabase
        .from("product_board_mappings")
        .update({ product_id: destinationProductId })
        .eq("product_id", sourceProductId);
      if (mappingsError) throw new Error(`Erro ao mover mapeamentos: ${mappingsError.message}`);

      // 3. Move onboarding_playbooks
      const { error: playbooksError } = await supabase
        .from("onboarding_playbooks")
        .update({ product_id: destinationProductId })
        .eq("product_id", sourceProductId);
      if (playbooksError) throw new Error(`Erro ao mover playbooks: ${playbooksError.message}`);

      // 4. Move deals
      const { error: dealsError } = await supabase
        .from("deals")
        .update({ product_id: destinationProductId })
        .eq("product_id", sourceProductId);
      if (dealsError) throw new Error(`Erro ao mover deals: ${dealsError.message}`);

      // 5. Move playbook_products
      const { error: playbookProductsError } = await supabase
        .from("playbook_products")
        .update({ product_id: destinationProductId })
        .eq("product_id", sourceProductId);
      if (playbookProductsError) throw new Error(`Erro ao mover playbook_products: ${playbookProductsError.message}`);

      // 6. Move quote_items
      const { error: quoteItemsError } = await supabase
        .from("quote_items")
        .update({ product_id: destinationProductId })
        .eq("product_id", sourceProductId);
      if (quoteItemsError) throw new Error(`Erro ao mover quote_items: ${quoteItemsError.message}`);

      // 7. Convert external_id to offer if requested
      if (convertExternalIdToOffer && sourceProduct?.external_id) {
        // Check if offer with this ID already exists in destination
        const { data: existingOffer } = await supabase
          .from("product_offers")
          .select("id")
          .eq("product_id", destinationProductId)
          .eq("offer_id", sourceProduct.external_id)
          .maybeSingle();

        if (!existingOffer) {
          const { error: offerError } = await supabase.from("product_offers").insert({
            product_id: destinationProductId,
            offer_id: sourceProduct.external_id,
            offer_name: `${sourceProduct.name} (migrado)`,
            price: sourceProduct.price ?? 0,
            is_active: true,
          });
          if (offerError) throw new Error(`Erro ao criar oferta: ${offerError.message}`);
        }
      }

      // 8. Delete source product
      const { error: deleteError } = await supabase
        .from("products")
        .delete()
        .eq("id", sourceProductId);
      if (deleteError) throw new Error(`Erro ao excluir produto origem: ${deleteError.message}`);

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["onboarding_playbooks"] });
      toast({
        title: "Produtos unificados com sucesso",
        description: "Todas as referências foram transferidas e o produto origem foi excluído.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao unificar produtos",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
