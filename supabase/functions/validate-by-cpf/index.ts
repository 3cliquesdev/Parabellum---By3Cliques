import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidateRequest {
  cpf: string;
  contact_id?: string;
}

/**
 * Normaliza CPF para apenas dígitos (11 dígitos)
 * Exemplos:
 *   123.456.789-00 → 12345678900
 *   12345678900 → 12345678900
 */
function normalizeCPF(cpf: string): string {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  // CPF deve ter 11 dígitos
  if (digits.length === 11) return digits;
  // CNPJ tem 14 dígitos — aceitar também
  if (digits.length === 14) return digits;
  return digits;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { cpf, contact_id }: ValidateRequest = await req.json();

    if (!cpf) {
      return new Response(JSON.stringify({ 
        error: 'cpf é obrigatório' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedCPF = normalizeCPF(cpf);
    if (!normalizedCPF) {
      return new Response(JSON.stringify({ found: false, reason: 'cpf_invalid' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[validate-by-cpf] 🔍 Buscando CPF/documento: ${normalizedCPF.slice(0, 3)}***`);

    // 1️⃣ Buscar na tabela contacts por document
    const { data: matchedContact } = await supabaseClient
      .from('contacts')
      .select('id, first_name, last_name, email, phone, document, kiwify_validated, status')
      .or(`document.eq.${normalizedCPF},document.eq.${cpf.trim()}`)
      .limit(1)
      .maybeSingle();

    if (matchedContact && matchedContact.id !== contact_id) {
      console.log(`[validate-by-cpf] ✅ Cliente encontrado por document na contacts: ${matchedContact.first_name}`);

      // Se o contato solicitante existe, promover para kiwify_validated
      if (contact_id) {
        await supabaseClient
          .from('contacts')
          .update({
            kiwify_validated: true,
            kiwify_validated_at: new Date().toISOString(),
            status: 'customer',
          })
          .eq('id', contact_id);
        console.log(`[validate-by-cpf] ✅ Contato ${contact_id} promovido para customer via CPF`);
      }

      return new Response(JSON.stringify({
        found: true,
        source: 'contacts',
        customer: {
          name: `${matchedContact.first_name} ${matchedContact.last_name}`.trim(),
          email: matchedContact.email,
          phone: matchedContact.phone,
          document: matchedContact.document,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Se o próprio contato já tem o document e é customer
    if (matchedContact && matchedContact.id === contact_id && matchedContact.kiwify_validated) {
      return new Response(JSON.stringify({
        found: true,
        source: 'contacts_self',
        customer: {
          name: `${matchedContact.first_name} ${matchedContact.last_name}`.trim(),
          email: matchedContact.email,
          phone: matchedContact.phone,
          document: matchedContact.document,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2️⃣ Fallback: buscar em kiwify_events pelo campo payload->Customer->document
    console.log(`[validate-by-cpf] 🔍 Buscando em kiwify_events...`);
    
    const { data: kiwifyEvents } = await supabaseClient
      .from('kiwify_events')
      .select('payload, event_type, created_at')
      .or(`payload->>customer_document.eq.${normalizedCPF},payload->Customer->>document.eq.${normalizedCPF}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (kiwifyEvents) {
      const payload = kiwifyEvents.payload as any;
      const customerData = payload?.Customer || payload?.customer || {};
      
      console.log(`[validate-by-cpf] ✅ Cliente encontrado em kiwify_events!`);

      // Promover contato
      if (contact_id) {
        const updateData: any = {
          kiwify_validated: true,
          kiwify_validated_at: new Date().toISOString(),
          status: 'customer',
        };
        
        // Preencher email se disponível
        if (customerData.email) updateData.email = customerData.email;
        if (customerData.full_name && !matchedContact) {
          const nameParts = customerData.full_name.split(' ');
          updateData.first_name = nameParts[0] || '';
          updateData.last_name = nameParts.slice(1).join(' ') || '';
        }

        await supabaseClient
          .from('contacts')
          .update(updateData)
          .eq('id', contact_id);
        console.log(`[validate-by-cpf] ✅ Contato ${contact_id} promovido via kiwify_events`);
      }

      return new Response(JSON.stringify({
        found: true,
        source: 'kiwify_events',
        customer: {
          name: customerData.full_name || customerData.name || '',
          email: customerData.email || '',
          document: normalizedCPF,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[validate-by-cpf] ℹ️ Nenhum cliente encontrado para CPF`);
    return new Response(JSON.stringify({ found: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[validate-by-cpf] ❌ Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      found: false,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
