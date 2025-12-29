import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactRow {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company?: string;
  document?: string;
  state_registration?: string;
  address?: string;
  address_number?: string;
  address_complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  birth_date?: string;
  customer_type?: string;
  blocked?: string | boolean;
  subscription_plan?: string;
  registration_date?: string;
  last_payment_date?: string;
  next_payment_date?: string;
  recent_orders_count?: string | number;
  account_balance?: string | number;
  assigned_to?: string;
}

function prepareContactData(contact: ContactRow) {
  return {
    email: contact.email.toLowerCase().trim(),
    first_name: contact.first_name?.trim() || '',
    last_name: contact.last_name?.trim() || '',
    phone: contact.phone?.trim() || null,
    company: contact.company?.trim() || null,
    document: contact.document?.trim() || null,
    state_registration: contact.state_registration?.trim() || null,
    address: contact.address?.trim() || null,
    address_number: contact.address_number?.trim() || null,
    address_complement: contact.address_complement?.trim() || null,
    neighborhood: contact.neighborhood?.trim() || null,
    city: contact.city?.trim() || null,
    state: contact.state?.trim() || null,
    zip_code: contact.zip_code?.trim() || null,
    birth_date: contact.birth_date || null,
    customer_type: contact.customer_type?.trim() || null,
    blocked: typeof contact.blocked === 'boolean' 
      ? contact.blocked 
      : (contact.blocked?.toLowerCase().trim() === 'sim' || contact.blocked?.toLowerCase().trim() === 'yes' || contact.blocked === '1'),
    subscription_plan: contact.subscription_plan?.trim() || null,
    registration_date: contact.registration_date || null,
    last_payment_date: contact.last_payment_date || null,
    next_payment_date: contact.next_payment_date || null,
    recent_orders_count: contact.recent_orders_count 
      ? parseInt(String(contact.recent_orders_count), 10) 
      : 0,
    account_balance: contact.account_balance 
      ? parseFloat(String(contact.account_balance).replace(',', '.')) 
      : 0,
    assigned_to: contact.assigned_to || null,
    source: 'csv_import',
    last_contact_date: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { contacts } = await req.json() as { contacts: ContactRow[] };

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid contacts array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Bulk Import] Processing ${contacts.length} contacts`);

    const results = {
      created: 0,
      updated: 0,
      errors: [] as Array<{ row: number; email: string; error: string }>,
    };

    // Filtrar contatos válidos
    const validContacts: Array<{ index: number; data: ReturnType<typeof prepareContactData> }> = [];
    
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      if (!contact.email || !contact.email.trim()) {
        results.errors.push({
          row: i + 1,
          email: contact.email || 'N/A',
          error: 'Email obrigatório',
        });
        continue;
      }
      validContacts.push({ index: i, data: prepareContactData(contact) });
    }

    // Processar em lotes de 50 para evitar timeout
    const BATCH_SIZE = 50;
    
    for (let batchStart = 0; batchStart < validContacts.length; batchStart += BATCH_SIZE) {
      const batch = validContacts.slice(batchStart, batchStart + BATCH_SIZE);
      const emails = batch.map(c => c.data.email);
      
      // Buscar contatos existentes em uma única query
      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('id, email')
        .in('email', emails);
      
      const existingEmailMap = new Map((existingContacts || []).map(c => [c.email, c.id]));
      
      const toInsert: Array<ReturnType<typeof prepareContactData>> = [];
      const toUpdate: Array<{ id: string; data: ReturnType<typeof prepareContactData>; originalIndex: number }> = [];
      
      for (const { index, data } of batch) {
        const existingId = existingEmailMap.get(data.email);
        if (existingId) {
          toUpdate.push({ id: existingId, data, originalIndex: index });
        } else {
          toInsert.push(data);
        }
      }
      
      // Inserir novos contatos em lote
      if (toInsert.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from('contacts')
          .insert(toInsert)
          .select('id');
        
        if (insertError) {
          console.error(`[Bulk Import] Batch insert error:`, insertError);
          // Tentar um por um para identificar erros específicos
          for (const contactData of toInsert) {
            const { error: singleError } = await supabase.from('contacts').insert(contactData);
            if (singleError) {
              results.errors.push({ row: 0, email: contactData.email, error: singleError.message });
            } else {
              results.created++;
              console.log(`[Bulk Import] Created contact: ${contactData.email}`);
            }
          }
        } else {
          results.created += inserted?.length || toInsert.length;
          console.log(`[Bulk Import] Batch created ${inserted?.length || toInsert.length} contacts`);
        }
      }
      
      // Atualizar contatos existentes em paralelo (máximo 10 por vez)
      const updatePromises = toUpdate.map(async ({ id, data, originalIndex }) => {
        const { error: updateError } = await supabase
          .from('contacts')
          .update(data)
          .eq('id', id);
        
        if (updateError) {
          console.error(`[Bulk Import] Error updating ${data.email}:`, updateError);
          return { success: false, email: data.email, error: updateError.message };
        }
        console.log(`[Bulk Import] Updated contact: ${data.email}`);
        return { success: true, email: data.email };
      });
      
      const updateResults = await Promise.all(updatePromises);
      
      for (const result of updateResults) {
        if (result.success) {
          results.updated++;
        } else {
          results.errors.push({ row: 0, email: result.email, error: result.error || 'Update error' });
        }
      }
      
      console.log(`[Bulk Import] Batch ${Math.floor(batchStart / BATCH_SIZE) + 1} completed`);
    }

    console.log(`[Bulk Import] Completed: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Bulk Import] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
