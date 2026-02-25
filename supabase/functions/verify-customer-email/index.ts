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
      .select('id, email, first_name, last_name, status, phone, consultant_id')
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
            last_name: customer.last_name,
            consultant_id: customer.consultant_id || null
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[verify-customer-email] ⚠️ Não encontrado como customer, verificando kiwify_events...');

    // FALLBACK: Buscar na kiwify_events por evento 'paid'
    const { data: kiwifyEvent, error: kiwifyErr } = await supabase
      .from('kiwify_events')
      .select('customer_email, customer_name, event_type')
      .eq('event_type', 'paid')
      .ilike('customer_email', targetEmail)
      .limit(1)
      .maybeSingle();

    if (kiwifyErr) {
      console.error('[verify-customer-email] ❌ Erro ao buscar kiwify_events:', kiwifyErr);
    }

    if (kiwifyEvent) {
      console.log('[verify-customer-email] ✅ Encontrado na kiwify_events como paid:', kiwifyEvent.customer_email);

      // Buscar contato existente (qualquer status) para promover
      const { data: existingContact, error: contactErr } = await supabase
        .from('contacts')
        .select('id, email, first_name, last_name, status, phone, consultant_id')
        .ilike('email', targetEmail)
        .maybeSingle();

      if (contactErr) {
        console.error('[verify-customer-email] ❌ Erro ao buscar contato existente:', contactErr);
      }

      if (existingContact) {
        // Promover para customer
        const { error: updateErr } = await supabase
          .from('contacts')
          .update({ status: 'customer' })
          .eq('id', existingContact.id);

        if (updateErr) {
          console.error('[verify-customer-email] ❌ Erro ao promover contato:', updateErr);
        } else {
          console.log('[verify-customer-email] ✅ Contato promovido para customer:', existingContact.id);
        }

        return new Response(
          JSON.stringify({
            found: true,
            promoted: true,
            customer: {
              id: existingContact.id,
              email: existingContact.email,
              name: `${existingContact.first_name || ''} ${existingContact.last_name || ''}`.trim(),
              phone: existingContact.phone,
              first_name: existingContact.first_name,
              last_name: existingContact.last_name,
              consultant_id: existingContact.consultant_id || null
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Contato não existe na base — não deveria acontecer segundo os dados, mas log para segurança
      console.log('[verify-customer-email] ⚠️ Evento paid encontrado mas sem contato na base para:', targetEmail);
    }

    console.log('[verify-customer-email] ❌ Email não encontrado em nenhuma base:', targetEmail);
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
