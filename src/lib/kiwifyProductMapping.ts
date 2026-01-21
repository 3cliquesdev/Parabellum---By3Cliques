/**
 * Unified Kiwify Product Mapping Helper
 * Centralizes the logic for mapping Kiwify payloads to internal products.
 * Supports mapping by offer_id (primary) and kiwify_product_id (fallback).
 */

import { supabase } from "@/integrations/supabase/client";

export interface ProductMapping {
  productName: string;
  category: string;
  sourceType: 'organico' | 'afiliado' | 'comercial';
}

export interface ProductMappingMaps {
  offerMap: Map<string, ProductMapping>;
  productIdMap: Map<string, ProductMapping>;
}

/**
 * Fetches all active product_offers and creates Maps for O(1) lookups
 */
export async function fetchProductMappings(): Promise<ProductMappingMaps> {
  const { data: offerMappings, error } = await supabase
    .from('product_offers')
    .select(`
      offer_id,
      kiwify_product_id,
      source_type,
      products:product_id (
        name
      )
    `)
    .eq('is_active', true);

  // Tratamento de erro: lançar exceção para que o React Query faça retry
  if (error) {
    console.error('[fetchProductMappings] Erro ao carregar mapeamentos:', error);
    throw new Error(`Falha ao carregar mapeamentos de produtos: ${error.message}`);
  }

  // Log de warning se não houver mapeamentos (mas não erro)
  if (!offerMappings || offerMappings.length === 0) {
    console.warn('[fetchProductMappings] ⚠️ Nenhum mapeamento encontrado na tabela product_offers');
  } else {
    console.log(`[fetchProductMappings] ✅ Carregados ${offerMappings.length} mapeamentos de ofertas`);
  }

  const offerMap = new Map<string, ProductMapping>();
  const productIdMap = new Map<string, ProductMapping>();

  for (const mapping of offerMappings || []) {
    const productName = (mapping.products as any)?.name;
    if (!productName) continue;

    const sourceType = (mapping.source_type as 'organico' | 'afiliado' | 'comercial') || 'organico';

    const mappingData: ProductMapping = { 
      productName, 
      category: productName, // Categoria = nome do produto mapeado
      sourceType
    };

    // Map by offer_id (primary)
    if (mapping.offer_id) {
      offerMap.set(mapping.offer_id, mappingData);
    }

    // Map by kiwify_product_id (fallback)
    if (mapping.kiwify_product_id) {
      productIdMap.set(mapping.kiwify_product_id, mappingData);
    }
  }

  return { offerMap, productIdMap };
}

/**
 * Categoriza produto baseado no nome (fallback quando não mapeado)
 */
export function categorizeProduct(productName: string): string {
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

/**
 * Gets the mapped product name and category from a Kiwify payload.
 * Priority:
 * 1. offer_id (Subscription.plan.id or Product.product_offer_id)
 * 2. kiwify_product_id (Product.product_id)
 * 3. Fallback: use Kiwify's own product name + category inference
 */
export function getMappedProduct(
  payload: any,
  offerMap: Map<string, ProductMapping>,
  productIdMap: Map<string, ProductMapping>
): { name: string; category: string } {
  // 1. Tentar por offer_id (prioridade)
  const offerId = payload?.Subscription?.plan?.id || payload?.Product?.product_offer_id;
  if (offerId && offerMap.has(offerId)) {
    const mapped = offerMap.get(offerId)!;
    return { name: mapped.productName, category: mapped.category };
  }

  // 2. Tentar por kiwify_product_id (fallback)
  const productId = payload?.Product?.product_id;
  if (productId && productIdMap.has(productId)) {
    const mapped = productIdMap.get(productId)!;
    return { name: mapped.productName, category: mapped.category };
  }

  // 3. Fallback: usar nome do Kiwify COMO categoria (não "Outros")
  // ⚠️ LÓGICA TRAVADA: Mostrar nome original para produtos não mapeados
  const kiwifyName = 
    payload?.Subscription?.plan?.name ||
    payload?.Product?.product_offer_name ||
    payload?.Product?.product_name ||  // ✅ product_name (correto)
    payload?.Product?.name ||           // fallback legacy
    payload?.product_name ||            // fallback root
    'Produto não identificado';

  return {
    name: kiwifyName,
    category: kiwifyName  // ✅ Usar nome original como categoria, não "Outros"
  };
}

/**
 * Checks if a Kiwify payload is mapped to an internal product
 */
export function isMapped(
  payload: any,
  offerMap: Map<string, ProductMapping>,
  productIdMap: Map<string, ProductMapping>
): boolean {
  const offerId = payload?.Subscription?.plan?.id || payload?.Product?.product_offer_id;
  if (offerId && offerMap.has(offerId)) return true;

  const productId = payload?.Product?.product_id;
  if (productId && productIdMap.has(productId)) return true;

  return false;
}

/**
 * Get the mapped product with sourceType for attribution analysis.
 * Returns sourceType from product_offers table for accurate channel attribution.
 */
export function getMappedProductWithSourceType(
  payload: any,
  offerMap: Map<string, ProductMapping>,
  productIdMap: Map<string, ProductMapping>
): { name: string; category: string; sourceType: 'organico' | 'afiliado' | 'comercial' } {
  const offerId = payload?.Subscription?.plan?.id || payload?.Product?.product_offer_id;
  if (offerId && offerMap.has(offerId)) {
    const mapped = offerMap.get(offerId)!;
    return { name: mapped.productName, category: mapped.category, sourceType: mapped.sourceType };
  }

  const productId = payload?.Product?.product_id;
  if (productId && productIdMap.has(productId)) {
    const mapped = productIdMap.get(productId)!;
    return { name: mapped.productName, category: mapped.category, sourceType: mapped.sourceType };
  }

  // Fallback: unmapped = organic
  return { name: 'Produto não mapeado', category: 'Outros', sourceType: 'organico' };
}
