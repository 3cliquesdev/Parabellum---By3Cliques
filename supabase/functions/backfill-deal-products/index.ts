import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log('[backfill-deal-products] Iniciando backfill de dados históricos...');

    // 1. Buscar todos os product_offers com offer_id
    const { data: offers, error: offersError } = await supabaseClient
      .from('product_offers')
      .select('offer_id, product_id, products!inner(external_id)');

    if (offersError) {
      console.error('[backfill-deal-products] Erro ao buscar offers:', offersError);
      throw offersError;
    }

    console.log(`[backfill-deal-products] ${offers?.length || 0} ofertas encontradas`);

    // 2. Criar mapeamento kiwify_product_id -> product_id
    const kiwifyToProductMap = new Map<string, string>();
    
    for (const offer of offers || []) {
      kiwifyToProductMap.set(offer.offer_id, offer.product_id);
      // Também adicionar external_id se existir
      const product = offer.products as any;
      if (product?.external_id) {
        kiwifyToProductMap.set(product.external_id, offer.product_id);
      }
    }

    console.log(`[backfill-deal-products] Mapeamento criado com ${kiwifyToProductMap.size} entradas`);

    // 3. Buscar deals sem product_id
    const { data: deals, error: dealsError } = await supabaseClient
      .from('deals')
      .select('id, title, contact_id')
      .is('product_id', null);

    if (dealsError) {
      console.error('[backfill-deal-products] Erro ao buscar deals:', dealsError);
      throw dealsError;
    }

    console.log(`[backfill-deal-products] ${deals?.length || 0} deals sem product_id encontrados`);

    let updatedCount = 0;
    const updatedDeals = [];

    // 4. Para cada deal, buscar interactions e tentar mapear
    for (const deal of deals || []) {
      const { data: interactions, error: interError } = await supabaseClient
        .from('interactions')
        .select('metadata')
        .eq('customer_id', deal.contact_id)
        .not('metadata', 'is', null);

      if (interError) {
        console.error(`[backfill-deal-products] Erro ao buscar interactions do deal ${deal.id}:`, interError);
        continue;
      }

      // Verificar se alguma interaction tem kiwify_product_id mapeado
      for (const interaction of interactions || []) {
        const metadata = interaction.metadata as any;
        const kiwifyProductId = metadata?.kiwify_product_id;

        if (kiwifyProductId && kiwifyToProductMap.has(kiwifyProductId)) {
          const productId = kiwifyToProductMap.get(kiwifyProductId);

          // Atualizar deal
          const { error: updateError } = await supabaseClient
            .from('deals')
            .update({ product_id: productId })
            .eq('id', deal.id);

          if (updateError) {
            console.error(`[backfill-deal-products] Erro ao atualizar deal ${deal.id}:`, updateError);
          } else {
            updatedCount++;
            updatedDeals.push({
              deal_id: deal.id,
              deal_title: deal.title,
              kiwify_product_id: kiwifyProductId,
              product_id: productId,
            });
            console.log(`[backfill-deal-products] ✅ Deal ${deal.id} atualizado com product_id ${productId}`);
            break; // Já atualizou, próximo deal
          }
        }
      }
    }

    console.log(`[backfill-deal-products] ✅ Backfill concluído: ${updatedCount} deals atualizados`);

    return new Response(
      JSON.stringify({
        success: true,
        updated_count: updatedCount,
        total_deals_without_product: deals?.length || 0,
        updated_deals: updatedDeals,
        message: `Backfill concluído: ${updatedCount} de ${deals?.length || 0} deals atualizados`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('[backfill-deal-products] Erro:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
