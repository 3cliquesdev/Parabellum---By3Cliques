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

    const { email, external_order_id } = await req.json();

    if (!external_order_id) {
      return new Response(JSON.stringify({ tracking_code_original: null }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const trimmedOrderId = String(external_order_id).trim();
    const trimmedEmail = email ? String(email).trim().toLowerCase() : null;

    // Find deal by external_order_id directly
    const dealQuery = supabase
      .from('deals')
      .select('tracking_code, external_order_id')
      .eq('external_order_id', trimmedOrderId);

    // If email provided, optionally filter by contact
    if (trimmedEmail) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (contact?.id) {
        dealQuery.eq('contact_id', contact.id);
      }
    }

    const { data: deal } = await dealQuery.maybeSingle();

    return new Response(JSON.stringify({
      tracking_code_original: deal?.tracking_code || null,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[lookup-order-tracking] Error:', err);
    return new Response(JSON.stringify({ tracking_code_original: null }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
