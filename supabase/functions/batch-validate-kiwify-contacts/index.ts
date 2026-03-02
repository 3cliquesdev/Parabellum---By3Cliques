import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) return digits;
  if (digits.length >= 10 && digits.length <= 11) return '55' + digits;
  if (digits.length < 10) return '';
  return digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("[batch-validate] Iniciando validação em massa...");

    // 1. Buscar contatos não validados que têm telefone
    const { data: contacts, error: contactsErr } = await supabaseClient
      .from('contacts')
      .select('id, phone, whatsapp_id, first_name, last_name, email')
      .or('kiwify_validated.is.null,kiwify_validated.eq.false')
      .or('phone.neq.,whatsapp_id.neq.')
      .limit(1000);

    if (contactsErr) throw contactsErr;

    console.log(`[batch-validate] Contatos para validar: ${contacts?.length || 0}`);

    if (!contacts || contacts.length === 0) {
      return new Response(JSON.stringify({
        success: true, validated: 0, not_found: 0, total: 0,
        message: "Nenhum contato pendente de validação"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Buscar TODOS os eventos Kiwify relevantes (mobile do customer)
    const { data: kiwifyEvents, error: kiwifyErr } = await supabaseClient
      .from('kiwify_events')
      .select('id, payload, customer_email, created_at')
      .in('event_type', ['paid', 'order_approved', 'subscription_renewed'])
      .limit(5000);

    if (kiwifyErr) throw kiwifyErr;

    console.log(`[batch-validate] Eventos Kiwify carregados: ${kiwifyEvents?.length || 0}`);

    // 3. Criar mapa: últimos 9 dígitos → dados do cliente Kiwify
    const kiwifyMap = new Map<string, { email: string; name: string; products: string[] }>();

    for (const event of (kiwifyEvents || [])) {
      const customer = event.payload?.Customer;
      if (!customer?.mobile) continue;

      const normalized = normalizePhone(customer.mobile);
      if (!normalized) continue;

      const last9 = normalized.slice(-9);
      const existing = kiwifyMap.get(last9);

      const productName = event.payload?.Product?.product_name || 'Produto';
      if (existing) {
        if (!existing.products.includes(productName)) existing.products.push(productName);
      } else {
        kiwifyMap.set(last9, {
          email: customer.email || event.customer_email || '',
          name: customer.full_name || customer.first_name || '',
          products: [productName],
        });
      }
    }

    console.log(`[batch-validate] Números Kiwify únicos no mapa: ${kiwifyMap.size}`);

    // 4. Fazer matching e atualizar contatos
    let validated = 0;
    let notFound = 0;
    const results: Array<{ contact_id: string; name: string; matched: boolean; products?: string[] }> = [];

    for (const contact of contacts) {
      const phone = contact.phone || contact.whatsapp_id || '';
      const normalized = normalizePhone(phone);
      if (!normalized) {
        notFound++;
        continue;
      }

      const last9 = normalized.slice(-9);
      const kiwifyData = kiwifyMap.get(last9);

      if (kiwifyData) {
        const updateData: Record<string, unknown> = {
          status: 'customer',
          source: 'kiwify_validated',
          kiwify_validated: true,
          kiwify_validated_at: new Date().toISOString(),
        };
        if (kiwifyData.email && !contact.email) {
          updateData.email = kiwifyData.email;
        }

        const { error: updateErr } = await supabaseClient
          .from('contacts')
          .update(updateData)
          .eq('id', contact.id);

        if (!updateErr) {
          validated++;
          results.push({
            contact_id: contact.id,
            name: `${contact.first_name} ${contact.last_name}`.trim(),
            matched: true,
            products: kiwifyData.products,
          });

          // Registrar nota interna
          await supabaseClient.from('interactions').insert({
            customer_id: contact.id,
            type: 'internal_note',
            content: `✅ Cliente identificado via batch-validate Kiwify. Produtos: ${kiwifyData.products.join(', ')}`,
            channel: 'system',
          });
        }
      } else {
        notFound++;
      }
    }

    console.log(`[batch-validate] ✅ Concluído: ${validated} validados, ${notFound} sem match`);

    return new Response(JSON.stringify({
      success: true,
      total: contacts.length,
      validated,
      not_found: notFound,
      kiwify_numbers_available: kiwifyMap.size,
      details: results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[batch-validate] Erro:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
