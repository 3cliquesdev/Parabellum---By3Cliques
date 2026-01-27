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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { email, contact_id, conversationId, contactId } = await req.json();
    const targetEmail = email?.toLowerCase().trim();
    const targetContactId = contact_id || contactId;
    
    if (!targetEmail) {
      console.log('[verify-customer-email] ⚠️ Email não fornecido');
      return new Response(
        JSON.stringify({ found: false, error: 'Email not provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[verify-customer-email] 🔍 Verificando email:', targetEmail);

    // Buscar cliente existente pelo email COM status = 'customer'
    const { data: customer, error } = await supabase
      .from('contacts')
      .select('id, email, first_name, last_name, status, phone')
      .eq('email', targetEmail)
      .eq('status', 'customer')
      .maybeSingle();

    if (error) {
      console.error('[verify-customer-email] ❌ Erro ao buscar:', error);
      throw error;
    }

    if (customer) {
      console.log('[verify-customer-email] ✅ Cliente encontrado:', {
        id: customer.id,
        email: customer.email,
        name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
      });
      
      return new Response(
        JSON.stringify({ 
          found: true, 
          customer: {
            id: customer.id,
            email: customer.email,
            name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
            phone: customer.phone,
            first_name: customer.first_name,
            last_name: customer.last_name
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[verify-customer-email] ❌ Email não encontrado como customer:', targetEmail);
    return new Response(
      JSON.stringify({ found: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[verify-customer-email] ❌ Exception:', err);
    return new Response(
      JSON.stringify({ found: false, error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
