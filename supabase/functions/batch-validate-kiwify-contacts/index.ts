import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!/^\d{10,13}$/.test(digits)) return '';
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) return digits;
  if (digits.length >= 10 && digits.length <= 11) return '55' + digits;
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

    let specificIds: string[] | null = null;
    try {
      const body = await req.json();
      if (body?.contact_ids && Array.isArray(body.contact_ids)) {
        specificIds = body.contact_ids;
      }
    } catch { /* no body */ }

    console.log("[batch-validate] Iniciando...", specificIds ? `IDs: ${specificIds.length}` : "Todos pendentes");

    // 1. Buscar contatos não validados (paginado)
    const allContacts: Array<any> = [];
    let cOffset = 0;
    let cMore = true;

    while (cMore) {
      let q = supabaseClient
        .from('contacts')
        .select('id, phone, whatsapp_id, first_name, last_name, email')
        .or('kiwify_validated.is.null,kiwify_validated.eq.false');

      if (specificIds?.length) q = q.in('id', specificIds);

      const { data: pg, error } = await q.range(cOffset, cOffset + 999);
      if (error) throw error;
      if (pg?.length) {
        allContacts.push(...pg);
        cOffset += pg.length;
        cMore = pg.length === 1000;
      } else {
        cMore = false;
      }
    }

    // Filter valid phones
    const contacts = allContacts.filter(c => {
      const n = normalizePhone(c.phone || c.whatsapp_id || '');
      return n.length > 0;
    });

    console.log(`[batch-validate] Contatos válidos: ${contacts.length} (de ${allContacts.length})`);

    if (!contacts.length) {
      return new Response(JSON.stringify({
        success: true, validated: 0, not_found: 0, total: 0,
        message: "Nenhum contato pendente"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Build unique last9 digits map from contacts
    const contactsByLast9 = new Map<string, Array<any>>();
    for (const c of contacts) {
      const norm = normalizePhone(c.phone || c.whatsapp_id || '');
      const last9 = norm.slice(-9);
      if (!contactsByLast9.has(last9)) contactsByLast9.set(last9, []);
      contactsByLast9.get(last9)!.push(c);
    }

    const uniquePhones = Array.from(contactsByLast9.keys());
    console.log(`[batch-validate] Telefones únicos a verificar: ${uniquePhones.length}`);

    // 3. Query kiwify_events in batches of 50 phone suffixes using textSearch/ilike
    let validated = 0;
    let notFound = 0;
    const results: Array<{ contact_id: string; name: string; matched: boolean; products?: string[] }> = [];
    const BATCH = 50;

    for (let i = 0; i < uniquePhones.length; i += BATCH) {
      const batch = uniquePhones.slice(i, i + BATCH);
      
      // Build OR filter: payload->Customer->>mobile ends with each suffix
      const orFilter = batch.map(last9 => `payload->Customer->>mobile.ilike.%${last9}`).join(',');
      
      const { data: events, error: evErr } = await supabaseClient
        .from('kiwify_events')
        .select('payload, customer_email')
        .in('event_type', ['paid', 'order_approved', 'subscription_renewed'])
        .or(orFilter)
        .limit(500);

      if (evErr) {
        console.error(`[batch-validate] Query error batch ${i}:`, evErr.message);
        continue;
      }

      // Build map from found events
      const foundMap = new Map<string, { email: string; name: string; products: string[] }>();
      for (const ev of (events || [])) {
        const cust = ev.payload?.Customer;
        if (!cust?.mobile) continue;
        const norm = normalizePhone(cust.mobile);
        if (!norm) continue;
        const l9 = norm.slice(-9);
        const prod = ev.payload?.Product?.product_name || 'Produto';
        const existing = foundMap.get(l9);
        if (existing) {
          if (!existing.products.includes(prod)) existing.products.push(prod);
        } else {
          foundMap.set(l9, {
            email: cust.email || ev.customer_email || '',
            name: cust.full_name || cust.first_name || '',
            products: [prod],
          });
        }
      }

      // Update matched contacts
      for (const [last9, kiwifyData] of foundMap) {
        const matchedContacts = contactsByLast9.get(last9) || [];
        for (const contact of matchedContacts) {
          const updateData: Record<string, unknown> = {
            status: 'customer',
            source: 'kiwify_validated',
            kiwify_validated: true,
            kiwify_validated_at: new Date().toISOString(),
          };
          if (kiwifyData.email && !contact.email) {
            updateData.email = kiwifyData.email;
          }

          const { error: upErr } = await supabaseClient
            .from('contacts')
            .update(updateData)
            .eq('id', contact.id);

          if (!upErr) {
            validated++;
            results.push({
              contact_id: contact.id,
              name: `${contact.first_name} ${contact.last_name}`.trim(),
              matched: true,
              products: kiwifyData.products,
            });

            await supabaseClient.from('interactions').insert({
              customer_id: contact.id,
              type: 'internal_note',
              content: `✅ Cliente identificado via batch-validate Kiwify. Produtos: ${kiwifyData.products.join(', ')}`,
              channel: 'system',
            });
          }
        }
      }

      // Count not found in this batch
      for (const last9 of batch) {
        if (!foundMap.has(last9)) {
          notFound += (contactsByLast9.get(last9) || []).length;
        }
      }
    }

    console.log(`[batch-validate] ✅ Concluído: ${validated} validados, ${notFound} sem match`);

    return new Response(JSON.stringify({
      success: true,
      total: contacts.length,
      validated,
      not_found: notFound,
      skipped_invalid_phones: allContacts.length - contacts.length,
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
