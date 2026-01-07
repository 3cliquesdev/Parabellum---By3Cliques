import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReprocessRequest {
  kiwify_product_id: string;
}

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
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { kiwify_product_id }: ReprocessRequest = await req.json();

    if (!kiwify_product_id) {
      throw new Error('kiwify_product_id is required');
    }

    console.log(`[Reprocess] Starting for Kiwify product: ${kiwify_product_id}`);

    // STEP 1: Find internal product by external_id or via product_offers.offer_id
    const { data: productOffers, error: offersError } = await supabaseClient
      .from('product_offers')
      .select('product_id')
      .eq('offer_id', kiwify_product_id);

    if (offersError) throw offersError;

    let productId: string | null = null;

    if (productOffers && productOffers.length > 0) {
      productId = productOffers[0].product_id;
    } else {
      // Try finding by external_id
      const { data: productByExternalId, error: externalIdError } = await supabaseClient
        .from('products')
        .select('id')
        .eq('external_id', kiwify_product_id)
        .maybeSingle();

      if (externalIdError) throw externalIdError;
      if (productByExternalId) {
        productId = productByExternalId.id;
      }
    }

    if (!productId) {
      return new Response(
        JSON.stringify({ 
          error: 'Produto não encontrado no sistema. Verifique se o produto está mapeado corretamente.' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Reprocess] Found internal product: ${productId}`);

    // STEP 2: Verify product has delivery_group_id
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .select('id, name, delivery_group_id')
      .eq('id', productId)
      .single();

    if (productError) throw productError;

    if (!product.delivery_group_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Produto não possui grupo de entrega configurado. Configure primeiro.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Reprocess] Delivery group: ${product.delivery_group_id}`);

    // STEP 3: Fetch playbooks linked to delivery group
    const { data: groupPlaybooks, error: groupPlaybooksError } = await supabaseClient
      .from('group_playbooks')
      .select('playbook_id, position, onboarding_playbooks(id, name)')
      .eq('group_id', product.delivery_group_id)
      .order('position');

    if (groupPlaybooksError) throw groupPlaybooksError;

    if (!groupPlaybooks || groupPlaybooks.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Grupo de entrega não possui playbooks vinculados.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Reprocess] Found ${groupPlaybooks.length} playbooks`);

    // STEP 4: Identify affected contacts via interactions.metadata->>'unmapped' = true
    const { data: unmappedInteractions, error: interactionsError } = await supabaseClient
      .from('interactions')
      .select('customer_id, metadata')
      .eq('type', 'note')
      .contains('metadata', { unmapped: true });

    if (interactionsError) throw interactionsError;

    // Filter to only contacts affected by this specific product
    const affectedContactIds = unmappedInteractions
      .filter((interaction: any) => {
        const metadata = interaction.metadata as any;
        return metadata?.product_id === kiwify_product_id;
      })
      .map((interaction: any) => interaction.customer_id);

    const uniqueContactIds = [...new Set(affectedContactIds)];

    console.log(`[Reprocess] Found ${uniqueContactIds.length} affected contacts`);

    if (uniqueContactIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'Nenhum cliente encontrado para reprocessar.',
          processed: 0,
          playbooks_created: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 5: Create playbook_executions for each contact
    let playbooksCreatedCount = 0;

    for (const contactId of uniqueContactIds) {
      for (const gp of groupPlaybooks) {
        const { error: executionError } = await supabaseClient
          .from('playbook_executions')
          .insert({
            playbook_id: gp.playbook_id,
            contact_id: contactId,
            status: 'pending',
            created_by: user.id,
          });

        if (executionError) {
          console.error(`[Reprocess] Error creating execution for contact ${contactId}:`, executionError);
        } else {
          playbooksCreatedCount++;
        }
      }

      // Log success interaction
      await supabaseClient
        .from('interactions')
        .insert({
          customer_id: contactId,
          type: 'note',
          content: `✅ Playbook iniciado após mapeamento do produto: ${product.name}`,
          channel: 'other',
          created_by: user.id,
          metadata: {
            reprocessed: true,
            kiwify_product_id,
            product_id: productId,
            playbooks_count: groupPlaybooks.length,
          },
        });
    }

    // STEP 6: Mark admin_alerts as is_read = true
    const { error: alertsUpdateError } = await supabaseClient
      .from('admin_alerts')
      .update({ is_read: true })
      .eq('type', 'unmapped_product')
      .contains('metadata', { product_id: kiwify_product_id });

    if (alertsUpdateError) {
      console.error('[Reprocess] Error updating alerts:', alertsUpdateError);
    }

    console.log(`[Reprocess] Complete! Processed: ${uniqueContactIds.length}, Created: ${playbooksCreatedCount}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: uniqueContactIds.length,
        playbooks_created: playbooksCreatedCount,
        product_name: product.name,
        contact_ids: uniqueContactIds,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Reprocess] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
