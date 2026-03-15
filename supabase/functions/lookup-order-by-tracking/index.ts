import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { tracking_code } = await req.json();

    if (!tracking_code || typeof tracking_code !== 'string') {
      return new Response(JSON.stringify({ found: false, error: 'tracking_code é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const trimmed = tracking_code.trim();

    const { data: deal, error } = await supabase
      .from('deals')
      .select('external_order_id, tracking_code, contact_id, contacts(first_name, last_name, email)')
      .eq('tracking_code', trimmed)
      .maybeSingle();

    if (error) {
      console.error('[lookup-order-by-tracking] Error:', error);
      return new Response(JSON.stringify({ found: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!deal) {
      return new Response(JSON.stringify({ found: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      found: true,
      external_order_id: deal.external_order_id,
      tracking_code: deal.tracking_code,
      contact_id: deal.contact_id,
      contact: deal.contacts || null,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[lookup-order-by-tracking] Error:', err);
    return new Response(JSON.stringify({ found: false }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
