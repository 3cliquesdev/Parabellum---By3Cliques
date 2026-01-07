import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KiwifySale {
  id: string;
  reference: string;
  status: 'paid' | 'refunded' | 'chargedback';
  customer: { 
    email: string; 
    first_name?: string;
    last_name?: string;
    full_name?: string;
    cpf?: string;
    cnpj?: string;
    mobile?: string;
    mobile_phone?: string;
    phone?: string;
    Address?: {
      street?: string;
      number?: string;
      complement?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      zipcode?: string;
    };
  };
  created_at: string;
}

interface QueueItem {
  id: string;
  job_id: string;
  window_start: string;
  window_end: string;
  status: string;
  retry_count: number;
  max_retries: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[process-kiwify-import-queue] 🔄 Iniciando processamento da fila...');

    // 1. Buscar próximo item pendente
    const { data: queueItems, error: queueError } = await supabaseAdmin
      .from('kiwify_import_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(1);

    if (queueError) {
      console.error('[process-kiwify-import-queue] ❌ Erro ao buscar fila:', queueError);
      throw queueError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('[process-kiwify-import-queue] ✅ Nenhum item pendente na fila');
      return new Response(
        JSON.stringify({ message: 'No items to process', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const item = queueItems[0] as QueueItem;
    console.log(`[process-kiwify-import-queue] 📋 Processando item: ${item.id}, janela: ${item.window_start} - ${item.window_end}`);

    // 2. Marcar como processing
    await supabaseAdmin
      .from('kiwify_import_queue')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', item.id);

    // 3. Buscar job options
    const { data: job } = await supabaseAdmin
      .from('sync_jobs')
      .select('*')
      .eq('id', item.job_id)
      .single();

    if (!job) {
      throw new Error(`Job não encontrado: ${item.job_id}`);
    }

    const updateExisting = job.options?.update_existing ?? false;

    // 4. Buscar credenciais da API Kiwify
    const { data: configs } = await supabaseAdmin
      .from('system_configurations')
      .select('key, value')
      .in('key', ['kiwify_client_id', 'kiwify_client_secret', 'kiwify_account_id']);

    const clientId = configs?.find(c => c.key === 'kiwify_client_id')?.value;
    const clientSecret = configs?.find(c => c.key === 'kiwify_client_secret')?.value;
    const accountId = configs?.find(c => c.key === 'kiwify_account_id')?.value;

    if (!clientId || !clientSecret || !accountId) {
      throw new Error('Credenciais Kiwify não configuradas');
    }

    // 5. Autenticar via OAuth
    console.log('[process-kiwify-import-queue] 🔐 Autenticando...');
    const authResponse = await fetch('https://public-api.kiwify.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!authResponse.ok) {
      throw new Error(`Falha na autenticação Kiwify: ${authResponse.status}`);
    }

    const { access_token } = await authResponse.json();

    // 6. Buscar vendas PAID da janela
    console.log(`[process-kiwify-import-queue] 📥 Buscando vendas de ${item.window_start} até ${item.window_end}...`);
    const allSales: KiwifySale[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      let retries = 0;
      let success = false;

      while (!success && retries < 3) {
        try {
          const salesResponse = await fetch(
            `https://public-api.kiwify.com/v1/sales?page_number=${page}&page_size=100&updated_at_start_date=${item.window_start}&updated_at_end_date=${item.window_end}&status=paid`,
            {
              headers: {
                'Authorization': `Bearer ${access_token}`,
                'x-kiwify-account-id': accountId,
                'Content-Type': 'application/json',
              },
            }
          );

          if (salesResponse.status === 429) {
            retries++;
            const waitTime = Math.pow(2, retries) * 30000;
            console.log(`[process-kiwify-import-queue] ⏳ Rate limited (tentativa ${retries}/3), aguardando ${waitTime/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }

          if (!salesResponse.ok) {
            throw new Error(`Falha ao buscar vendas: ${salesResponse.status}`);
          }

          const salesData = await salesResponse.json();
          const windowSales: KiwifySale[] = (salesData.data || []).filter(
            (sale: KiwifySale) => sale.status === 'paid'
          );
          allSales.push(...windowSales);

          hasMore = (salesData.data || []).length === 100;
          page++;
          success = true;

          // Rate limiting entre páginas
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err: any) {
          retries++;
          if (retries >= 3) throw err;
          console.log(`[process-kiwify-import-queue] ⚠️ Erro na página ${page}, tentativa ${retries}/3:`, err.message);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      if (!success) {
        throw new Error('Máximo de tentativas atingido');
      }
    }

    console.log(`[process-kiwify-import-queue] ✅ ${allSales.length} vendas PAID encontradas na janela`);

    // 7. Processar contatos
    let contactsCreated = 0;
    let contactsUpdated = 0;
    let contactsSkipped = 0;
    const processedEmails = new Set<string>();

    for (const sale of allSales) {
      if (processedEmails.has(sale.customer.email.toLowerCase())) {
        contactsSkipped++;
        continue;
      }
      processedEmails.add(sale.customer.email.toLowerCase());

      try {
        const { data: existingContact } = await supabaseAdmin
          .from('contacts')
          .select('id, phone, document')
          .eq('email', sale.customer.email)
          .maybeSingle();

        if (existingContact) {
          if (updateExisting) {
            const updates: any = {};
            const phone = sale.customer.mobile || sale.customer.mobile_phone || sale.customer.phone;
            const doc = sale.customer.cpf || sale.customer.cnpj;

            if (phone && !existingContact.phone) updates.phone = phone;
            if (doc && !existingContact.document) updates.document = doc;
            updates.status = 'customer';

            if (Object.keys(updates).length > 0) {
              await supabaseAdmin
                .from('contacts')
                .update(updates)
                .eq('id', existingContact.id);
              contactsUpdated++;
            } else {
              contactsSkipped++;
            }
          } else {
            contactsSkipped++;
          }
        } else {
          const names = (sale.customer.full_name || sale.customer.email).split(' ');
          const firstName = sale.customer.first_name || names[0] || 'Cliente';
          const lastName = sale.customer.last_name || names.slice(1).join(' ') || 'Kiwify';

          await supabaseAdmin
            .from('contacts')
            .insert({
              email: sale.customer.email,
              first_name: firstName,
              last_name: lastName,
              phone: sale.customer.mobile || sale.customer.mobile_phone || sale.customer.phone,
              document: sale.customer.cpf || sale.customer.cnpj,
              address: sale.customer.Address?.street,
              address_number: sale.customer.Address?.number,
              address_complement: sale.customer.Address?.complement,
              neighborhood: sale.customer.Address?.neighborhood,
              city: sale.customer.Address?.city,
              state: sale.customer.Address?.state,
              zip_code: sale.customer.Address?.zipcode,
              status: 'customer',
              blocked: false,
              source: 'kiwify_import',
            });
          contactsCreated++;
        }
      } catch (err: any) {
        console.error(`[process-kiwify-import-queue] ❌ Erro ao processar ${sale.customer.email}:`, err.message);
      }
    }

    // 8. Marcar item como completed
    await supabaseAdmin
      .from('kiwify_import_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        contacts_created: contactsCreated,
        contacts_updated: contactsUpdated,
        contacts_skipped: contactsSkipped,
        sales_fetched: allSales.length,
      })
      .eq('id', item.id);

    // 9. Atualizar progresso do job
    const { data: queueStats } = await supabaseAdmin
      .from('kiwify_import_queue')
      .select('status, contacts_created, contacts_updated')
      .eq('job_id', item.job_id);

    const completed = queueStats?.filter(q => q.status === 'completed').length || 0;
    const total = queueStats?.length || 0;
    const totalCreated = queueStats?.reduce((sum, q) => sum + (q.contacts_created || 0), 0) || 0;
    const totalUpdated = queueStats?.reduce((sum, q) => sum + (q.contacts_updated || 0), 0) || 0;

    await supabaseAdmin
      .from('sync_jobs')
      .update({
        processed_items: completed,
        contacts_created: totalCreated,
        updated_items: totalUpdated,
      })
      .eq('id', item.job_id);

    // 10. Verificar se todas as janelas foram processadas
    const pending = queueStats?.filter(q => q.status === 'pending' || q.status === 'processing').length || 0;

    if (pending === 0) {
      const failed = queueStats?.filter(q => q.status === 'failed').length || 0;
      
      await supabaseAdmin
        .from('sync_jobs')
        .update({
          status: failed > 0 ? 'completed_with_errors' : 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', item.job_id);

      console.log(`[process-kiwify-import-queue] 🎉 Importação concluída! Total: ${totalCreated} criados, ${totalUpdated} atualizados`);
    }

    console.log(`[process-kiwify-import-queue] ✅ Janela ${item.window_start} - ${item.window_end} processada: ${contactsCreated} criados, ${contactsUpdated} atualizados`);

    return new Response(
      JSON.stringify({
        message: 'Queue item processed',
        item_id: item.id,
        window: `${item.window_start} - ${item.window_end}`,
        contacts_created: contactsCreated,
        contacts_updated: contactsUpdated,
        progress: `${completed}/${total}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[process-kiwify-import-queue] ❌ ERROR:', error);

    // Tentar marcar item como failed ou agendar retry
    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: failedItems } = await supabaseAdmin
        .from('kiwify_import_queue')
        .select('*')
        .eq('status', 'processing')
        .limit(1);

      if (failedItems && failedItems.length > 0) {
        const item = failedItems[0];
        const newRetryCount = item.retry_count + 1;

        if (newRetryCount <= item.max_retries) {
          const backoffMinutes = Math.pow(2, newRetryCount) * 5;
          const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000);

          await supabaseAdmin
            .from('kiwify_import_queue')
            .update({
              status: 'pending',
              retry_count: newRetryCount,
              last_error: error.message,
              scheduled_for: nextRetry.toISOString(),
            })
            .eq('id', item.id);

          console.log(`[process-kiwify-import-queue] ⏰ Retry ${newRetryCount}/${item.max_retries} agendado para ${nextRetry.toISOString()}`);
        } else {
          await supabaseAdmin
            .from('kiwify_import_queue')
            .update({
              status: 'failed',
              last_error: error.message,
              completed_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          console.log(`[process-kiwify-import-queue] ❌ Item ${item.id} marcado como failed após ${item.max_retries} tentativas`);
        }
      }
    } catch (updateErr) {
      console.error('[process-kiwify-import-queue] Falha ao atualizar status do item:', updateErr);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
