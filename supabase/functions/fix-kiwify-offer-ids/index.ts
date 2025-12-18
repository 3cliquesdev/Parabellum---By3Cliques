import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log('[fix-kiwify-offer-ids] 🔧 Iniciando backfill de offer_id...');

    // 1. Buscar todos eventos com offer_id NULL mas que têm Subscription.plan.id no payload
    const { data: eventsToFix, error: fetchError } = await supabase
      .from('kiwify_events')
      .select('id, payload')
      .is('offer_id', null)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`[fix-kiwify-offer-ids] 📊 Encontrados ${eventsToFix?.length || 0} eventos para verificar`);

    let fixed = 0;
    let skipped = 0;
    const fixedOffers: Record<string, number> = {};

    for (const event of eventsToFix || []) {
      const payload = event.payload as any;
      
      // Extrair offer_id de Subscription.plan.id
      const offerId = payload?.Subscription?.plan?.id;
      const offerName = payload?.Subscription?.plan?.name;
      
      if (offerId) {
        const { error: updateError } = await supabase
          .from('kiwify_events')
          .update({ offer_id: offerId })
          .eq('id', event.id);
        
        if (!updateError) {
          fixed++;
          const key = `${offerId} (${offerName || 'sem nome'})`;
          fixedOffers[key] = (fixedOffers[key] || 0) + 1;
        }
      } else {
        skipped++;
      }
    }

    console.log('[fix-kiwify-offer-ids] ✅ Backfill concluído:', {
      total_checked: eventsToFix?.length || 0,
      fixed,
      skipped,
      offers_fixed: fixedOffers
    });

    return new Response(
      JSON.stringify({
        success: true,
        total_checked: eventsToFix?.length || 0,
        fixed,
        skipped,
        offers_fixed: fixedOffers
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fix-kiwify-offer-ids] ❌ Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
