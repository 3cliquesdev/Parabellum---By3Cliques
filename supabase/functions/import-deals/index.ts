import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DealRow {
  title: string;
  value?: string | number;
  email_contato?: string;
  telefone_contato?: string;
  produto?: string;
  assigned_to?: string;
  expected_close_date?: string;
  external_order_id?: string;
  lead_source?: string;
  status?: string;
}

interface ImportResult {
  deals_created: number;
  contacts_created: number;
  errors: Array<{ row: number; title: string; error: string }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { deals, pipeline_id, stage_id } = body as {
      deals: DealRow[];
      pipeline_id: string;
      stage_id: string;
    };

    if (!deals?.length || !pipeline_id || !stage_id) {
      return new Response(JSON.stringify({ error: 'deals, pipeline_id e stage_id são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[import-deals] User ${user.id} importing ${deals.length} deals`);

    // Pre-fetch profiles for assigned_to resolution (by email or name)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email:id');

    const profileByName = new Map<string, string>();
    profiles?.forEach(p => {
      if (p.full_name) profileByName.set(p.full_name.toLowerCase().trim(), p.id);
    });

    // Pre-fetch products for resolution by name
    const { data: products } = await supabase
      .from('products')
      .select('id, name');

    const productByName = new Map<string, string>();
    products?.forEach(p => {
      if (p.name) productByName.set(p.name.toLowerCase().trim(), p.id);
    });

    const result: ImportResult = { deals_created: 0, contacts_created: 0, errors: [] };

    for (let i = 0; i < deals.length; i++) {
      const row = deals[i];
      const rowNum = i + 1;

      try {
        if (!row.title?.trim()) {
          result.errors.push({ row: rowNum, title: '', error: 'Título é obrigatório' });
          continue;
        }

        // Resolve contact
        let contactId: string | null = null;
        const email = row.email_contato?.toLowerCase().trim();
        const phone = row.telefone_contato?.trim();

        if (email) {
          const { data: existing } = await supabase
            .from('contacts')
            .select('id')
            .eq('email', email)
            .maybeSingle();

          if (existing) {
            contactId = existing.id;
          } else {
            const { data: created, error: createErr } = await supabase
              .from('contacts')
              .insert({
                email,
                first_name: email.split('@')[0],
                last_name: '',
                phone: phone || null,
              })
              .select('id')
              .single();

            if (createErr) {
              console.error(`[import-deals] Error creating contact for ${email}:`, createErr);
            } else {
              contactId = created.id;
              result.contacts_created++;
            }
          }
        } else if (phone) {
          const { data: existing } = await supabase
            .from('contacts')
            .select('id')
            .eq('phone', phone)
            .maybeSingle();

          if (existing) contactId = existing.id;
        }

        // Resolve assigned_to
        let assignedTo: string | null = null;
        if (row.assigned_to?.trim()) {
          assignedTo = profileByName.get(row.assigned_to.toLowerCase().trim()) || null;
        }

        // Resolve product
        let productId: string | null = null;
        if (row.produto?.trim()) {
          productId = productByName.get(row.produto.toLowerCase().trim()) || null;
        }

        // Parse value
        let dealValue: number | null = null;
        if (row.value != null && row.value !== '') {
          const parsed = typeof row.value === 'number'
            ? row.value
            : parseFloat(String(row.value).replace(/\./g, '').replace(',', '.'));
          if (!isNaN(parsed)) dealValue = parsed;
        }

        // Parse status
        const validStatuses = ['open', 'won', 'lost'];
        const dealStatus = row.status && validStatuses.includes(row.status.toLowerCase().trim())
          ? row.status.toLowerCase().trim()
          : 'open';

        const { error: insertErr } = await supabase
          .from('deals')
          .insert({
            title: row.title.trim(),
            value: dealValue,
            contact_id: contactId,
            pipeline_id,
            stage_id,
            assigned_to: assignedTo,
            product_id: productId,
            expected_close_date: row.expected_close_date || null,
            external_order_id: row.external_order_id?.trim() || null,
            lead_source: row.lead_source?.trim() || null,
            lead_email: email || null,
            lead_phone: phone || null,
            status: dealStatus,
          });

        if (insertErr) {
          console.error(`[import-deals] Row ${rowNum} insert error:`, insertErr);
          result.errors.push({ row: rowNum, title: row.title, error: insertErr.message });
        } else {
          result.deals_created++;
        }
      } catch (err: any) {
        result.errors.push({ row: rowNum, title: row.title || '', error: err.message });
      }
    }

    console.log(`[import-deals] Done: ${result.deals_created} created, ${result.contacts_created} contacts, ${result.errors.length} errors`);

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('[import-deals] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
