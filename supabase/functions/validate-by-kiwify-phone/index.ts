import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidateRequest {
  phone: string;
  whatsapp_id?: string;
  contact_id?: string;
}

interface KiwifyCustomer {
  name: string;
  email: string;
  mobile: string;
  products: string[];
  last_purchase_at: string;
}

/**
 * Normaliza telefone para formato E.164 (apenas dígitos, com DDI 55)
 * Exemplos:
 *   +5549988471092 → 5549988471092
 *   (49) 98847-1092 → 5549988471092
 *   49988471092 → 5549988471092
 *   5549988471092@s.whatsapp.net → 5549988471092
 */
function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Remove tudo que não é dígito
  const digits = phone.replace(/\D/g, '');
  
  // Se começar com 55 e tiver 12-13 dígitos, já está E.164
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }
  
  // Se tiver 10-11 dígitos (DDD + número), adicionar 55 (Brasil)
  if (digits.length >= 10 && digits.length <= 11) {
    return '55' + digits;
  }
  
  // Se tiver 8-9 dígitos (só número sem DDD), não podemos normalizar
  // Retorna vazio para evitar falsos positivos
  if (digits.length < 10) {
    return '';
  }
  
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

    const { phone, whatsapp_id, contact_id }: ValidateRequest = await req.json();

    if (!phone && !whatsapp_id) {
      return new Response(JSON.stringify({ 
        error: 'phone ou whatsapp_id é obrigatório' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalizar o telefone recebido
    const normalizedPhone = normalizePhone(phone || whatsapp_id || '');
    
    if (!normalizedPhone) {
      console.log('[validate-by-kiwify-phone] Telefone inválido ou muito curto:', phone);
      return new Response(JSON.stringify({ 
        found: false, 
        reason: 'Telefone inválido para validação' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[validate-by-kiwify-phone] Buscando compras Kiwify para: ${normalizedPhone}`);

    // Buscar compras na Kiwify onde o mobile normalizado bate
    // Usamos LIKE porque o formato pode variar (+55... vs 55...)
    const { data: kiwifyEvents, error: kiwifyError } = await supabaseClient
      .from('kiwify_events')
      .select(`
        id,
        event_type,
        customer_email,
        payload,
        created_at
      `)
      .in('event_type', ['paid', 'order_approved', 'subscription_renewed'])
      .order('created_at', { ascending: false });

    if (kiwifyError) {
      console.error('[validate-by-kiwify-phone] Erro ao buscar kiwify_events:', kiwifyError);
      throw kiwifyError;
    }

    // Filtrar eventos onde o mobile normalizado bate
    const matchingEvents = (kiwifyEvents || []).filter(event => {
      const customerMobile = event.payload?.Customer?.mobile || '';
      const normalizedCustomerMobile = normalizePhone(customerMobile);
      return normalizedCustomerMobile === normalizedPhone;
    });

    if (matchingEvents.length === 0) {
      console.log(`[validate-by-kiwify-phone] Nenhuma compra encontrada para: ${normalizedPhone}`);
      return new Response(JSON.stringify({ 
        found: false,
        reason: 'Nenhuma compra Kiwify encontrada para este número'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extrair dados do cliente e produtos comprados
    const firstEvent = matchingEvents[0];
    const customer = firstEvent.payload?.Customer || {};
    const products = [...new Set(matchingEvents.map(e => 
      e.payload?.Product?.product_name || 'Produto não identificado'
    ))];

    const customerData: KiwifyCustomer = {
      name: customer.full_name || customer.first_name || 'Cliente',
      email: customer.email || firstEvent.customer_email || '',
      mobile: customer.mobile || '',
      products,
      last_purchase_at: firstEvent.created_at,
    };

    console.log(`[validate-by-kiwify-phone] ✅ Cliente encontrado:`, {
      name: customerData.name,
      email: customerData.email,
      products_count: products.length
    });

    // Se temos contact_id, atualizar o contato com os dados da Kiwify
    let updatedContact = null;
    if (contact_id && customerData.email) {
      const { data: updated, error: updateError } = await supabaseClient
        .from('contacts')
        .update({
          email: customerData.email,
          status: 'customer',
          // Marcar como validado via Kiwify (usando campo existente ou metadata)
          source: 'kiwify_validated',
        })
        .eq('id', contact_id)
        .select()
        .single();

      if (!updateError && updated) {
        updatedContact = updated;
        console.log(`[validate-by-kiwify-phone] ✅ Contato ${contact_id} atualizado com email Kiwify`);

        // Registrar interação de identificação
        await supabaseClient.from('interactions').insert({
          customer_id: contact_id,
          type: 'internal_note',
          content: `✅ Cliente identificado automaticamente via número Kiwify. Email: ${customerData.email}. Produtos: ${products.join(', ')}`,
          channel: 'system'
        });
      }
    }

    return new Response(JSON.stringify({ 
      found: true,
      customer: customerData,
      contact_id: updatedContact?.id || contact_id,
      contact_updated: !!updatedContact,
      matching_purchases: matchingEvents.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[validate-by-kiwify-phone] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      found: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
