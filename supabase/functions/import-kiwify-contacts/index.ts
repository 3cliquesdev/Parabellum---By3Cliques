import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

interface ImportOptions {
  days_back?: number;
  user_id?: string;
  update_existing?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let jobId: string | null = null;

  try {
    console.log('[import-kiwify-contacts] 🚀 Iniciando importação de contatos...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse options from request body
    const body = await req.json().catch(() => ({}));
    const options: ImportOptions = {
      days_back: body.days_back ?? 365,
      user_id: body.user_id,
      update_existing: body.update_existing ?? false,
    };

    console.log('[import-kiwify-contacts] 📋 Opções:', options);

    // 1. Criar job de sincronização
    const { data: job, error: jobError } = await supabaseClient
      .from('sync_jobs')
      .insert({
        job_type: 'kiwify_contacts_import',
        status: 'running',
        started_at: new Date().toISOString(),
        created_by: options.user_id,
        options: options,
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error('Falha ao criar job de importação');
    }

    jobId = job.id;
    console.log('[import-kiwify-contacts] 📝 Job criado:', jobId);

    // 2. Buscar credenciais da API Kiwify
    const { data: configs } = await supabaseClient
      .from('system_configurations')
      .select('key, value')
      .in('key', ['kiwify_client_id', 'kiwify_client_secret', 'kiwify_account_id']);

    const clientId = configs?.find(c => c.key === 'kiwify_client_id')?.value;
    const clientSecret = configs?.find(c => c.key === 'kiwify_client_secret')?.value;
    const accountId = configs?.find(c => c.key === 'kiwify_account_id')?.value;

    if (!clientId || !clientSecret || !accountId) {
      await supabaseClient
        .from('sync_jobs')
        .update({ 
          status: 'failed', 
          completed_at: new Date().toISOString(),
          errors: [{ message: 'Credenciais Kiwify não configuradas' }]
        })
        .eq('id', jobId);
      throw new Error('Credenciais Kiwify não configuradas');
    }

    // 3. Autenticar via OAuth
    console.log('[import-kiwify-contacts] 🔐 Autenticando...');
    const authResponse = await fetch('https://public-api.kiwify.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      await supabaseClient
        .from('sync_jobs')
        .update({ 
          status: 'failed', 
          completed_at: new Date().toISOString(),
          errors: [{ message: `Falha na autenticação: ${authResponse.status}` }]
        })
        .eq('id', jobId);
      throw new Error(`Falha na autenticação Kiwify: ${authResponse.status} - ${errorText}`);
    }

    const { access_token } = await authResponse.json();
    console.log('[import-kiwify-contacts] ✅ Autenticado com sucesso');

    // 4. Buscar vendas PAID com paginação em janelas de 90 dias
    console.log('[import-kiwify-contacts] 📥 Buscando vendas PAID...');
    let allSales: KiwifySale[] = [];

    const maxWindowDays = 90;
    const now = new Date();
    const daysBack = options.days_back ?? 365;
    const overallStart = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    const dayMs = 24 * 60 * 60 * 1000;
    let windowEnd = now;

    while (windowEnd >= overallStart) {
      const windowStart = new Date(
        Math.max(overallStart.getTime(), windowEnd.getTime() - (maxWindowDays - 1) * dayMs)
      );

      const startDateStr = windowStart.toISOString().split('T')[0];
      const endDateStr = windowEnd.toISOString().split('T')[0];
      
      console.log(`[import-kiwify-contacts] 📅 Janela: ${startDateStr} até ${endDateStr}`);

      let page = 1;
      let hasMoreInWindow = true;

      while (hasMoreInWindow) {
        let retries = 0;
        let success = false;
        
        while (!success && retries < 3) {
          try {
            // Buscar apenas vendas PAID
            const salesResponse = await fetch(
              `https://public-api.kiwify.com/v1/sales?page_number=${page}&page_size=100&updated_at_start_date=${startDateStr}&updated_at_end_date=${endDateStr}&status=paid`,
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
              const waitTime = Math.pow(2, retries) * 30000; // Exponential backoff: 30s, 60s, 120s
              console.log(`[import-kiwify-contacts] ⏳ Rate limited (tentativa ${retries}/3), aguardando ${waitTime/1000}s...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }

            if (!salesResponse.ok) {
              const errorText = await salesResponse.text().catch(() => '');
              throw new Error(`Falha ao buscar vendas: ${salesResponse.status} - ${errorText}`);
            }

            const salesData = await salesResponse.json();
            const windowSales: KiwifySale[] = (salesData.data || []).filter(
              (sale: KiwifySale) => sale.status === 'paid'
            );
            allSales = allSales.concat(windowSales);

            hasMoreInWindow = (salesData.data || []).length === 100;
            page++;
            success = true;

            // Rate limiting entre páginas: 2 segundos
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (err: any) {
            retries++;
            if (retries >= 3) throw err;
            console.log(`[import-kiwify-contacts] ⚠️ Erro na página ${page}, tentativa ${retries}/3:`, err.message);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
        
        if (!success) {
          throw new Error('Máximo de tentativas atingido após rate limiting');
        }
      }

      // Rate limiting entre janelas de 90 dias: 5 segundos
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Move window to previous period
      windowEnd = new Date(windowStart.getTime() - dayMs);
    }

    // Atualizar total
    await supabaseClient
      .from('sync_jobs')
      .update({ total_items: allSales.length })
      .eq('id', jobId);

    console.log(`[import-kiwify-contacts] ✅ ${allSales.length} vendas PAID encontradas`);

    // 5. Processar contatos (SEM criar deals)
    let contactsCreated = 0;
    let contactsUpdated = 0;
    let contactsSkipped = 0;
    const errors: any[] = [];
    const processedEmails = new Set<string>();

    for (let i = 0; i < allSales.length; i++) {
      const sale = allSales[i];
      
      // Pular emails duplicados no mesmo batch
      if (processedEmails.has(sale.customer.email.toLowerCase())) {
        contactsSkipped++;
        continue;
      }
      processedEmails.add(sale.customer.email.toLowerCase());
      
      try {
        // Buscar contato existente
        const { data: existingContact } = await supabaseClient
          .from('contacts')
          .select('id, phone, document, email')
          .eq('email', sale.customer.email)
          .maybeSingle();

        if (existingContact) {
          // Contato existe - atualizar apenas se solicitado
          if (options.update_existing) {
            const updates: any = {};
            const phone = sale.customer.mobile || sale.customer.mobile_phone || sale.customer.phone;
            const doc = sale.customer.cpf || sale.customer.cnpj;
            
            if (phone && !existingContact.phone) updates.phone = phone;
            if (doc && !existingContact.document) updates.document = doc;
            
            // Atualizar status para customer se não estiver
            updates.status = 'customer';

            if (Object.keys(updates).length > 0) {
              await supabaseClient
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
          // Criar novo contato
          const names = (sale.customer.full_name || sale.customer.email).split(' ');
          const firstName = sale.customer.first_name || names[0] || 'Cliente';
          const lastName = sale.customer.last_name || names.slice(1).join(' ') || 'Kiwify';
          
          const { error: contactError } = await supabaseClient
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

          if (contactError) {
            throw contactError;
          }
          contactsCreated++;
        }

      } catch (err: any) {
        console.error(`[import-kiwify-contacts] ❌ Erro ao processar ${sale.customer.email}:`, err.message);
        errors.push({
          email: sale.customer.email,
          error: err.message,
        });
      }

      // Atualizar progresso a cada 50 contatos
      if ((i + 1) % 50 === 0 || i === allSales.length - 1) {
        await supabaseClient
          .from('sync_jobs')
          .update({
            processed_items: i + 1,
            contacts_created: contactsCreated,
            updated_items: contactsUpdated,
          })
          .eq('id', jobId);
      }
    }

    // 6. Finalizar job
    await supabaseClient
      .from('sync_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        processed_items: allSales.length,
        contacts_created: contactsCreated,
        updated_items: contactsUpdated,
        errors: errors,
      })
      .eq('id', jobId);

    console.log('[import-kiwify-contacts] ✅ Importação concluída');
    console.log(`[import-kiwify-contacts] 📊 Criados: ${contactsCreated}, Atualizados: ${contactsUpdated}, Pulados: ${contactsSkipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        stats: {
          total_sales: allSales.length,
          contacts_created: contactsCreated,
          contacts_updated: contactsUpdated,
          contacts_skipped: contactsSkipped,
          errors: errors.length,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[import-kiwify-contacts] ❌ ERROR:', error);
    
    // Atualizar o job para failed
    if (jobId) {
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        await supabaseClient
          .from('sync_jobs')
          .update({ 
            status: 'failed', 
            completed_at: new Date().toISOString(),
            errors: [{ message: error.message }]
          })
          .eq('id', jobId);
      } catch (updateErr) {
        console.error('[import-kiwify-contacts] Failed to update job status:', updateErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        job_id: jobId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
