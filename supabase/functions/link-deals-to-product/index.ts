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

    const { product_id, kiwify_product_ids } = await req.json();

    if (!product_id || !kiwify_product_ids || !Array.isArray(kiwify_product_ids) || kiwify_product_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'product_id e kiwify_product_ids são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[link-deals-to-product] Iniciando vinculação para product_id: ${product_id}`);
    console.log(`[link-deals-to-product] Kiwify IDs: ${kiwify_product_ids.join(', ')}`);

    // Buscar deals sem product_id que tenham interactions com kiwify_product_id correspondente
    const { data: deals, error: dealsError } = await supabaseClient
      .from('deals')
      .select('id, title, contact_id')
      .is('product_id', null);

    if (dealsError) {
      console.error('[link-deals-to-product] Erro ao buscar deals:', dealsError);
      throw dealsError;
    }

    console.log(`[link-deals-to-product] ${deals?.length || 0} deals sem product_id encontrados`);

    let linkedCount = 0;
    const linkedDeals = [];

    // Para cada deal, verificar se tem interaction com kiwify_product_id correspondente
    for (const deal of deals || []) {
      const { data: interactions, error: interError } = await supabaseClient
        .from('interactions')
        .select('metadata')
        .eq('customer_id', deal.contact_id)
        .not('metadata', 'is', null);

      if (interError) {
        console.error(`[link-deals-to-product] Erro ao buscar interactions do deal ${deal.id}:`, interError);
        continue;
      }

      // Verificar se alguma interaction tem kiwify_product_id correspondente
      for (const interaction of interactions || []) {
        const metadata = interaction.metadata as any;
        const interactionProductId = metadata?.kiwify_product_id;

        if (interactionProductId && kiwify_product_ids.includes(interactionProductId)) {
          // Atualizar deal com product_id
          const { error: updateError } = await supabaseClient
            .from('deals')
            .update({ product_id })
            .eq('id', deal.id);

          if (updateError) {
            console.error(`[link-deals-to-product] Erro ao atualizar deal ${deal.id}:`, updateError);
          } else {
            linkedCount++;
            linkedDeals.push({
              deal_id: deal.id,
              deal_title: deal.title,
              kiwify_product_id: interactionProductId,
            });
            console.log(`[link-deals-to-product] ✅ Deal ${deal.id} vinculado ao produto ${product_id}`);
            break; // Já vinculou, não precisa continuar verificando interactions
          }
        }
      }
    }

    console.log(`[link-deals-to-product] ✅ Total vinculado: ${linkedCount} deals`);

    return new Response(
      JSON.stringify({
        success: true,
        linked_count: linkedCount,
        linked_deals: linkedDeals,
        message: `${linkedCount} deal(s) foram vinculados ao produto`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('[link-deals-to-product] Erro:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
