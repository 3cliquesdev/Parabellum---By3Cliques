import { createClient } from "npm:@supabase/supabase-js@2";

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
  consultant_id?: string;
}

function prepareContactData(contact: ContactRow, consultantMap: Map<string, string>, validConsultantIds: Set<string>) {
  // Resolver consultant_id: prioridade UUID direto > nome > null
  // IMPORTANTE: só aceita IDs de usuários com role 'consultant'
  let consultantId: string | null = null;

  // 1) Tentar consultant_id (UUID direto)
  if (contact.consultant_id?.trim()) {
    const directId = contact.consultant_id.trim();
    if (validConsultantIds.has(directId)) {
      consultantId = directId;
      console.log(`[Bulk Import] Using direct consultant_id: ${consultantId}`);
    } else {
      console.warn(`[Bulk Import] consultant_id "${directId}" is not a valid/active consultant, falling back to name`);
    }
  }

  // 2) Fallback: resolver por nome
  if (!consultantId && contact.assigned_to?.trim()) {
    const nameKey = contact.assigned_to.toLowerCase().trim();
    consultantId = consultantMap.get(nameKey) || null;
    if (!consultantId) {
      console.warn(`[Bulk Import] Consultant not found (or not a consultant role) for name: "${contact.assigned_to}"`);
    } else {
      console.log(`[Bulk Import] Resolved consultant "${contact.assigned_to}" → ${consultantId}`);
    }
  }

  let firstName = contact.first_name?.trim() || '';
  let lastName = contact.last_name?.trim() || '';

  // Detectar nome de produto no first_name (length > 50 ou palavras-chave)
  const PRODUCT_KEYWORDS = /unidade|stick|câmera|smart tv|retrô|lâmpada|fone|relógio|caixa de som|kit |wi-fi|hdmi|bluetooth|android|streaming/i;
  if (firstName && lastName && (firstName.length > 50 || PRODUCT_KEYWORDS.test(firstName))) {
    console.warn(`[Bulk Import] Product name detected in first_name: "${firstName.substring(0, 40)}..." — swapping with last_name`);
    // Guardar produto e usar last_name como nome real
    const productName = firstName;
    const realNameParts = lastName.split(' ');
    firstName = realNameParts[0];
    lastName = realNameParts.slice(1).join(' ') || '';
    // O nome do produto será salvo em external_ids no retorno
    (contact as any)._detected_product_name = productName;
  }

  // Corrigir nomes duplicados (ex: "Ronildo Oliveira" / "Ronildo Oliveira")
  if (firstName && lastName && firstName === lastName) {
    const parts = firstName.split(' ');
    firstName = parts[0];
    lastName = parts.slice(1).join(' ') || '';
  }
  // Se só tem first_name com espaço e last_name vazio, fazer split
  if (firstName && !lastName && firstName.includes(' ')) {
    const parts = firstName.split(' ');
    firstName = parts[0];
    lastName = parts.slice(1).join(' ');
  }

  return {
    email: contact.email.toLowerCase().trim(),
    first_name: firstName,
    last_name: lastName,
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
    ...(consultantId ? { consultant_id: consultantId } : {}),
    ...((contact as any)._detected_product_name ? { 
      external_ids: { imported_product_name: (contact as any)._detected_product_name } 
    } : {}),
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

    const { contacts, mode = 'replace' } = await req.json() as { contacts: ContactRow[]; mode?: 'replace' | 'merge' | 'update_mapped' };

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid contacts array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Bulk Import] Processing ${contacts.length} contacts in ${mode} mode`);

    // === Resolver nomes de consultores para consultant_id ===
    // Buscar IDs de usuários com role 'consultant'
    const { data: consultantRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'consultant');

    const consultantIds = consultantRoles?.map(r => r.user_id) || [];
    
    // Buscar profiles dos consultores ativos
    let consultantMap = new Map<string, string>(); // nome_lower → id
    const validConsultantIds = new Set<string>(consultantIds);
    if (consultantIds.length > 0) {
      const { data: consultantProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', consultantIds)
        .eq('is_blocked', false);

      if (consultantProfiles) {
        // Atualizar set para só incluir consultores ativos (não bloqueados)
        validConsultantIds.clear();
        for (const c of consultantProfiles) {
          validConsultantIds.add(c.id);
          if (c.full_name) {
            consultantMap.set(c.full_name.toLowerCase().trim(), c.id);
          }
        }
      }
      console.log(`[Bulk Import] Loaded ${consultantMap.size} active consultants for name resolution, ${validConsultantIds.size} valid IDs`);
    }

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
      validContacts.push({ index: i, data: prepareContactData(contact, consultantMap, validConsultantIds) });
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
      
      // Atualizar contatos existentes em paralelo
      const updatePromises = toUpdate.map(async ({ id, data, originalIndex }) => {
        let updateData = data;
        
        if (mode === 'update_mapped') {
          // Atualiza apenas os campos que vieram no CSV (não toca nos outros)
          // Remove campos que vieram vazios/null do CSV para não sobrescrever dados existentes
          updateData = {} as any;
          for (const [key, value] of Object.entries(data)) {
            if (value !== null && value !== '' && value !== 0) {
              (updateData as any)[key] = value;
            }
          }
          // Sempre atualiza last_contact_date
          (updateData as any).last_contact_date = new Date().toISOString();
          console.log(`[Bulk Import] update_mapped fields for ${data.email}:`, Object.keys(updateData));
        } else if (mode === 'merge') {
          // Só preenche campos que estão NULL ou vazios no banco
          const { data: existing } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', id)
            .single();
          
          if (existing) {
            updateData = {} as any;
            for (const [key, value] of Object.entries(data)) {
              if (value !== null && value !== '' && value !== 0) {
                const existingValue = existing[key as keyof typeof existing];
                if (existingValue === null || existingValue === '' || existingValue === 0) {
                  (updateData as any)[key] = value;
                }
              }
            }
            // Sempre atualiza last_contact_date
            (updateData as any).last_contact_date = new Date().toISOString();
          }
        }
        // mode === 'replace': usa data diretamente (já é o padrão)
        
        const { error: updateError } = await supabase
          .from('contacts')
          .update(updateData)
          .eq('id', id);
        
        if (updateError) {
          console.error(`[Bulk Import] Error updating ${data.email}:`, updateError);
          return { success: false, email: data.email, error: updateError.message };
        }
        console.log(`[Bulk Import] Updated contact: ${data.email} (mode: ${mode})`);
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
