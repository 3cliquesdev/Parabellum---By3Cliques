import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { dryRun = true, limit = 100 } = await req.json().catch(() => ({}));

    console.log(`[fix-affiliate-attribution] Starting... dryRun=${dryRun}, limit=${limit}`);

    // Use a more efficient SQL query to find and fix deals
    const { data: events, error: fetchError } = await supabase
      .from('kiwify_events')
      .select('linked_deal_id, payload')
      .not('linked_deal_id', 'is', null)
      .limit(limit);

    if (fetchError) throw fetchError;

    // Filter events that have affiliate data and prepare updates
    const updates: Array<{
      deal_id: string;
      affiliate_commission: number;
      affiliate_name: string | null;
      affiliate_email: string | null;
    }> = [];

    for (const event of events || []) {
      const commissionedStores = event.payload?.Commissions?.commissioned_stores || [];
      const affiliateData = commissionedStores.find((cs: any) => cs.type === 'affiliate');
      
      if (affiliateData && event.linked_deal_id) {
        updates.push({
          deal_id: event.linked_deal_id,
          affiliate_commission: (affiliateData.value || 0) / 100,
          affiliate_name: affiliateData.custom_name || affiliateData.name || null,
          affiliate_email: affiliateData.email || null,
        });
      }
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No deals with affiliate data found in this batch.",
        processed: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get deal IDs that need fixing (still marked as organic)
    const dealIds = updates.map(u => u.deal_id);
    const { data: dealsToCheck, error: checkError } = await supabase
      .from('deals')
      .select('id, title, is_organic_sale')
      .in('id', dealIds)
      .eq('is_organic_sale', true);

    if (checkError) throw checkError;

    const dealsNeedingFix = (dealsToCheck || []).map(deal => {
      const updateData = updates.find(u => u.deal_id === deal.id);
      return {
        ...deal,
        ...updateData,
      };
    });

    if (dryRun) {
      return new Response(JSON.stringify({
        success: true,
        dryRun: true,
        dealsToFix: dealsNeedingFix.length,
        sample: dealsNeedingFix.slice(0, 10),
        message: `Found ${dealsNeedingFix.length} deals that need affiliate attribution fix.`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apply fixes
    let fixed = 0;
    let errors = 0;

    for (const fix of dealsNeedingFix) {
      const newTitle = (fix.title || '')
        .replace('Venda Orgânica', 'Venda Afiliado')
        .replace('Recorrência -', 'Recorrência Afiliado -');

      const { error: updateError } = await supabase
        .from('deals')
        .update({
          is_organic_sale: false,
          affiliate_commission: fix.affiliate_commission,
          affiliate_name: fix.affiliate_name,
          affiliate_email: fix.affiliate_email,
          title: newTitle !== fix.title ? newTitle : fix.title,
        })
        .eq('id', fix.deal_id);

      if (updateError) {
        console.error(`Error updating deal ${fix.deal_id}:`, updateError);
        errors++;
      } else {
        fixed++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      dryRun: false,
      fixed,
      errors,
      totalProcessed: events?.length || 0,
      message: `Fixed ${fixed} deals, ${errors} errors.`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[fix-affiliate-attribution] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
