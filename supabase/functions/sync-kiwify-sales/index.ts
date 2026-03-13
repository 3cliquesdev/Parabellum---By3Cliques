import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KiwifySale {
  id: string;
  reference: string;
  status: 'paid' | 'refunded' | 'chargedback';
  net_amount: number;
  product: { name: string; id: string };
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
  commissions?: {
    product_base_price: number;
    my_commission?: number;
    kiwify_fee?: number;
    commissioned_stores?: Array<{ 
      type: string; 
      value: number;
      custom_name?: string;
      email?: string;
    }>;
  };
  created_at: string;
}

interface SyncOptions {
  silent?: boolean;
  create_auth_users?: boolean;
  days_back?: number;
  user_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let jobId: string | null = null;

  try {
    console.log('[sync-kiwify-sales] 🚀 Iniciando sincronização...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse options from request body
    const body = await req.json().catch(() => ({}));
    const options: SyncOptions = {
      silent: body.silent ?? false,
      create_auth_users: body.create_auth_users ?? false,
      days_back: body.days_back ?? 365,
      user_id: body.user_id,
    };

    console.log('[sync-kiwify-sales] 📋 Opções:', options);

    // 1. Criar job de sincronização
    const { data: job, error: jobError } = await supabaseClient
      .from('sync_jobs')
      .insert({
        job_type: 'kiwify_sales',
        status: 'running',
        started_at: new Date().toISOString(),
        created_by: options.user_id,
        options: options,
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error('Falha ao criar job de sincronização');
    }

    jobId = job.id;
    console.log('[sync-kiwify-sales] 📝 Job criado:', jobId);

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
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', jobId);
      throw new Error('Credenciais Kiwify não configuradas');
    }

    // 3. Autenticar via OAuth
    console.log('[sync-kiwify-sales] 🔐 Autenticando...');
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
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', jobId);
      throw new Error(`Falha na autenticação Kiwify: ${authResponse.status} - ${errorText}`);
    }

    const { access_token } = await authResponse.json();

    // 4. Buscar vendas com paginação
    console.log('[sync-kiwify-sales] 📥 Buscando vendas...');
    let allSales: KiwifySale[] = [];

    const maxWindowDays = 90;
    const now = new Date();
    const daysBack = options.days_back ?? 365;
    const overallStart = new Date(
      now.getTime() - daysBack * 24 * 60 * 60 * 1000,
    );

    const dayMs = 24 * 60 * 60 * 1000;
    let windowEnd = now;

    while (windowEnd >= overallStart) {
      const windowStart = new Date(
        Math.max(
          overallStart.getTime(),
          windowEnd.getTime() - (maxWindowDays - 1) * dayMs,
        ),
      );

      const startDateStr = windowStart.toISOString().split('T')[0];
      const endDateStr = windowEnd.toISOString().split('T')[0];
      
      console.log(`[sync-kiwify-sales] 📅 Janela: ${startDateStr} até ${endDateStr}`);
      const dayDiff = Math.round((windowEnd.getTime() - windowStart.getTime()) / dayMs);
      console.log(`[sync-kiwify-sales] 📊 Dias na janela: ${dayDiff}`);

      let page = 1;
      let hasMoreInWindow = true;

      while (hasMoreInWindow) {
        let retries = 0;
        let success = false;
        
        while (!success && retries < 3) {
          const salesResponse = await fetch(
            `https://public-api.kiwify.com/v1/sales?page_number=${page}&page_size=100&updated_at_start_date=${startDateStr}&updated_at_end_date=${endDateStr}`,
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
            console.log(`[sync-kiwify-sales] ⏳ Rate limited (tentativa ${retries}/3), aguardando 1 minuto...`);
            await new Promise(resolve => setTimeout(resolve, 60000));
            continue;
          }

          if (!salesResponse.ok) {
            const errorText = await salesResponse.text().catch(() => '');
            throw new Error(`Falha ao buscar vendas: ${salesResponse.status} - ${errorText}`);
          }

          const salesData = await salesResponse.json();
          const windowSales: KiwifySale[] = salesData.data || [];
          allSales = allSales.concat(windowSales);

          hasMoreInWindow = windowSales.length === 100;
          page++;
          success = true;

          // Rate limiting entre páginas: 2 segundos
          await new Promise(resolve => setTimeout(resolve, 2000));
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

    console.log(`[sync-kiwify-sales] ✅ ${allSales.length} vendas encontradas`);

    // 5. Processar vendas
    let contactsCreated = 0;
    let contactsUpdated = 0;
    let authUsersCreated = 0;
    let dealsCreated = 0;
    let dealsUpdated = 0;
    let customersChurned = 0;
    let tagsAdded = 0;
    const errors: any[] = [];

    // Buscar tag "Inadimplente" uma vez antes do loop
    const { data: inadimplenteTag } = await supabaseClient
      .from('tags')
      .select('id')
      .eq('name', 'Inadimplente')
      .single();

    for (let i = 0; i < allSales.length; i++) {
      const sale = allSales[i];
      
      try {
        // Buscar ou criar contato
        let { data: contact } = await supabaseClient
          .from('contacts')
          .select('id, phone, document, email')
          .eq('email', sale.customer.email)
          .single();

        if (!contact) {
          // Criar novo contato
          const names = (sale.customer.full_name || sale.customer.email).split(' ');
          let firstName = sale.customer.first_name || names[0] || 'Cliente';
          let lastName = sale.customer.last_name || names.slice(1).join(' ') || 'Kiwify';
          
          // Corrigir nomes duplicados
          if (firstName.trim() === lastName.trim()) {
            const parts = firstName.trim().split(' ');
            firstName = parts[0];
            lastName = parts.slice(1).join(' ') || '';
          }
          
          const { data: newContact, error: contactError } = await supabaseClient
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
              status: sale.status === 'paid' ? 'customer' : 'churned',
              blocked: sale.status !== 'paid',
              source: 'kiwify_sync',
            })
            .select()
            .single();

          if (contactError) throw contactError;
          contact = newContact;
          contactsCreated++;

          // Contabilizar clientes churned
          if (sale.status !== 'paid') {
            customersChurned++;
          }

          // Criar auth.user se solicitado
          if (options.create_auth_users && contact) {
            try {
              const tempPassword = sale.customer.cpf?.substring(0, 5) || 'temp12345';
              
              const { data: authUser, error: authError } = await supabaseClient.auth.admin.createUser({
                email: sale.customer.email,
                password: tempPassword,
                email_confirm: true,
                user_metadata: {
                  full_name: `${firstName} ${lastName}`,
                  must_change_password: true,
                },
              });

              if (!authError && authUser) {
                authUsersCreated++;
              }
            } catch (authErr: any) {
              console.warn(`[sync-kiwify-sales] ⚠️ Erro ao criar auth.user para ${sale.customer.email}:`, authErr.message);
            }
          }
        } else {
          // Atualizar dados se necessário
          const updates: any = {};
          const phone = sale.customer.mobile || sale.customer.mobile_phone || sale.customer.phone;
          const doc = sale.customer.cpf || sale.customer.cnpj;
          
          if (phone && !contact.phone) updates.phone = phone;
          if (doc && !contact.document) updates.document = doc;

          if (Object.keys(updates).length > 0) {
            await supabaseClient
              .from('contacts')
              .update(updates)
              .eq('id', contact.id);
            contactsUpdated++;
          }
        }

        if (!contact) continue;

        // Adicionar tag "Inadimplente" para vendas não pagas (refunded/chargedback)
        if (sale.status !== 'paid' && inadimplenteTag) {
          const { data: existingTag } = await supabaseClient
            .from('customer_tags')
            .select('id')
            .eq('customer_id', contact.id)
            .eq('tag_id', inadimplenteTag.id)
            .maybeSingle();

          if (!existingTag) {
            const { error: tagError } = await supabaseClient
              .from('customer_tags')
              .insert({
                customer_id: contact.id,
                tag_id: inadimplenteTag.id,
              });

            if (!tagError) {
              tagsAdded++;
            }
          }
        }

        // Calcular valores financeiros
        const grossValue = (sale.commissions?.product_base_price || 0) / 100;
        const netValue = (sale.commissions?.my_commission || sale.net_amount || 0) / 100;
        const kiwifyFee = (sale.commissions?.kiwify_fee || 0) / 100;
        const affiliateData = sale.commissions?.commissioned_stores?.find(s => s.type === 'affiliate');
        const affiliateCommission = (affiliateData?.value || 0) / 100;
        const affiliateName = affiliateData?.custom_name || null;
        const affiliateEmail = affiliateData?.email || null;

        // Buscar pipeline padrão
        const { data: pipeline } = await supabaseClient
          .from('pipelines')
          .select('id')
          .limit(1)
          .single();

        // Buscar ou criar deal
        const dealTitle = `${sale.product.name} - Kiwify #${sale.reference}`;
        const { data: existingDeal } = await supabaseClient
          .from('deals')
          .select('id')
          .eq('contact_id', contact.id)
          .ilike('title', `%${sale.product.name}%`)
          .single();

        const dealData = {
          contact_id: contact.id,
          title: dealTitle,
          value: netValue,
          gross_value: grossValue,
          net_value: netValue,
          kiwify_fee: kiwifyFee,
          affiliate_commission: affiliateCommission,
          affiliate_name: affiliateName,
          affiliate_email: affiliateEmail,
          status: sale.status === 'paid' ? 'won' : 'lost',
          lost_reason: sale.status === 'refunded' ? 'Reembolso' : 
                       sale.status === 'chargedback' ? 'Chargeback' : null,
          currency: 'BRL',
          closed_at: sale.created_at,
          pipeline_id: pipeline?.id,
        };

        if (existingDeal) {
          await supabaseClient
            .from('deals')
            .update(dealData)
            .eq('id', existingDeal.id);
          dealsUpdated++;
        } else {
          await supabaseClient
            .from('deals')
            .insert(dealData);
          dealsCreated++;
        }

      } catch (err: any) {
        console.error(`[sync-kiwify-sales] ❌ Erro ao processar venda ${sale.reference}:`, err.message);
        errors.push({
          sale_reference: sale.reference,
          error: err.message,
        });
      }

      // Atualizar progresso a cada 10 vendas
      if ((i + 1) % 10 === 0 || i === allSales.length - 1) {
        await supabaseClient
          .from('sync_jobs')
          .update({
            processed_items: i + 1,
            contacts_created: contactsCreated,
            updated_items: contactsUpdated,
            auth_users_created: authUsersCreated,
            deals_created: dealsCreated,
            deals_updated: dealsUpdated,
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
        auth_users_created: authUsersCreated,
        deals_created: dealsCreated,
        deals_updated: dealsUpdated,
        customers_churned: customersChurned,
        tags_added: tagsAdded,
        errors: errors,
      })
      .eq('id', jobId);

    console.log('[sync-kiwify-sales] ✅ Sincronização concluída');

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        stats: {
          total_sales: allSales.length,
          contacts_created: contactsCreated,
          contacts_updated: contactsUpdated,
          auth_users_created: authUsersCreated,
          deals_created: dealsCreated,
          deals_updated: dealsUpdated,
          customers_churned: customersChurned,
          tags_added: tagsAdded,
          errors: errors.length,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[sync-kiwify-sales] ❌ ERROR:', error);
    
    // SEMPRE atualizar o job para failed mesmo se crashar
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
      } catch (updateError) {
        console.error('[sync-kiwify-sales] ❌ Erro ao atualizar job:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});