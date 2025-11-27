import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KiwifyCustomer {
  id: string;
  full_name: string;
  email: string;
  mobile_phone?: string;
  CPF?: string;
}

interface KiwifyProduct {
  product_id: string;
  product_name: string;
}

interface KiwifyCommissions {
  product_base_price: number;
}

interface KiwifyWebhookPayload {
  order_id: string;
  order_status: 'paid' | 'refused' | 'cart_abandoned' | 'refunded' | 'chargedback';
  Customer: KiwifyCustomer;
  Product: KiwifyProduct;
  Commissions: KiwifyCommissions;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const payload: KiwifyWebhookPayload = await req.json();
    console.log('[kiwify-webhook] Received:', payload.order_status, payload.order_id);

    const { order_status, Customer, Product, Commissions, order_id } = payload;

    let result;
    switch (order_status) {
      case 'paid':
        result = await handlePaidOrder(supabase, Customer, Product, Commissions, order_id);
        break;
      
      case 'refused':
      case 'cart_abandoned':
        result = await handleRecoveryOrder(supabase, Customer, Product, Commissions, order_status, order_id);
        break;
      
      case 'refunded':
      case 'chargedback':
        result = await handleChurnOrder(supabase, Customer, Product, order_status);
        break;
      
      default:
        console.log('[kiwify-webhook] Ignored status:', order_status);
        return new Response(JSON.stringify({ ignored: true, status: order_status }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[kiwify-webhook] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// ============================================
// CASE 1: PAID - Fluxo de Sucesso
// ============================================
async function handlePaidOrder(
  supabase: any,
  Customer: KiwifyCustomer,
  Product: KiwifyProduct,
  Commissions: KiwifyCommissions,
  order_id: string
) {
  console.log('[kiwify-webhook] 💚 PAID - Iniciando onboarding:', Customer.email);

  // 1. Criar/Atualizar contact como CUSTOMER
  const nameParts = Customer.full_name.split(' ');
  const { data: contact } = await supabase
    .from('contacts')
    .upsert({
      email: Customer.email,
      first_name: nameParts[0],
      last_name: nameParts.slice(1).join(' ') || nameParts[0],
      phone: Customer.mobile_phone,
      document: Customer.CPF,
      status: 'customer',
      kiwify_customer_id: Customer.id,
      subscription_plan: Product.product_name,
      registration_date: new Date().toISOString(),
      last_kiwify_event: 'paid',
      last_kiwify_event_at: new Date().toISOString(),
    }, {
      onConflict: 'email'
    })
    .select()
    .single();

  if (!contact) {
    throw new Error('Failed to create/update contact');
  }

  // 2. Criar usuário no Supabase Auth (senha = 5 primeiros dígitos CPF)
  const password = Customer.CPF?.replace(/\D/g, '').substring(0, 5) || '12345';
  
  try {
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: Customer.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: Customer.full_name,
        contact_id: contact.id,
        source: 'kiwify'
      }
    });

    if (authError && !authError.message.includes('already registered')) {
      console.error('[kiwify-webhook] Auth creation error:', authError);
    } else {
      console.log('[kiwify-webhook] ✅ Auth user created:', authUser?.user?.id);
    }
  } catch (authErr) {
    console.warn('[kiwify-webhook] Auth error (may already exist):', authErr);
  }

  // 3. Buscar playbook associado ao produto
  const { data: product } = await supabase
    .from('products')
    .select('id, name')
    .ilike('name', `%${Product.product_name}%`)
    .single();

  let playbook_id = null;
  if (product) {
    const { data: playbook } = await supabase
      .from('onboarding_playbooks')
      .select('id')
      .eq('product_id', product.id)
      .eq('is_active', true)
      .single();
    
    playbook_id = playbook?.id;
  }

  // 4. Iniciar customer_journey (playbook de onboarding)
  if (playbook_id) {
    const { data: execution } = await supabase
      .from('playbook_executions')
      .insert({
        playbook_id,
        contact_id: contact.id,
        status: 'pending',
      })
      .select()
      .single();

    console.log('[kiwify-webhook] 🎯 Playbook iniciado:', execution?.id);
  } else {
    console.log('[kiwify-webhook] ⚠️ Nenhum playbook encontrado para produto:', Product.product_name);
  }

  // 5. Registrar interação na timeline
  await supabase
    .from('interactions')
    .insert({
      customer_id: contact.id,
      type: 'note',
      channel: 'other',
      content: `✅ Venda aprovada via Kiwify: ${Product.product_name}`,
      metadata: {
        product: Product.product_name,
        value: Commissions.product_base_price,
        order_id,
        kiwify_customer_id: Customer.id
      }
    });

  return {
    success: true,
    action: 'onboarding_started',
    contact_id: contact.id,
    playbook_id,
    message: 'Cliente criado, usuário Auth configurado, onboarding iniciado'
  };
}

// ============================================
// CASE 2: REFUSED/CART_ABANDONED - Recuperação
// ============================================
async function handleRecoveryOrder(
  supabase: any,
  Customer: KiwifyCustomer,
  Product: KiwifyProduct,
  Commissions: KiwifyCommissions,
  order_status: string,
  order_id: string
) {
  console.log('[kiwify-webhook] 🔴 RECUPERAÇÃO:', order_status, Customer.email);

  // 1. Criar/Atualizar contact como LEAD
  const nameParts = Customer.full_name.split(' ');
  const { data: contact } = await supabase
    .from('contacts')
    .upsert({
      email: Customer.email,
      first_name: nameParts[0],
      last_name: nameParts.slice(1).join(' ') || nameParts[0],
      phone: Customer.mobile_phone,
      document: Customer.CPF,
      status: 'lead',
      kiwify_customer_id: Customer.id,
      last_kiwify_event: order_status,
      last_kiwify_event_at: new Date().toISOString(),
    }, {
      onConflict: 'email'
    })
    .select()
    .single();

  if (!contact) {
    throw new Error('Failed to create/update contact');
  }

  // 2. Buscar produto no sistema
  const { data: product } = await supabase
    .from('products')
    .select('id, name')
    .ilike('name', `%${Product.product_name}%`)
    .single();

  // 3. VERIFICAR DUPLICIDADE: Deal aberto já existe?
  if (product) {
    const { data: existingDeal } = await supabase
      .from('deals')
      .select('id, title')
      .eq('contact_id', contact.id)
      .eq('product_id', product.id)
      .eq('status', 'open')
      .single();

    if (existingDeal) {
      // Apenas adicionar nota ao deal existente
      await supabase
        .from('interactions')
        .insert({
          customer_id: contact.id,
          type: 'note',
          channel: 'other',
          content: `⚠️ Nova tentativa de compra falhou: ${order_status}`,
          metadata: {
            product: Product.product_name,
            order_id,
            reason: order_status,
            deal_id: existingDeal.id
          }
        });

      console.log('[kiwify-webhook] ℹ️ Nota adicionada ao deal existente:', existingDeal.id);
      
      return {
        success: true,
        action: 'note_added',
        contact_id: contact.id,
        deal_id: existingDeal.id,
        message: 'Deal já existe, nota de nova tentativa adicionada'
      };
    }
  }

  // 4. Buscar stage "Recuperação"
  const { data: recoveryStage } = await supabase
    .from('stages')
    .select('id, pipeline_id')
    .eq('name', 'Recuperação')
    .single();

  if (!recoveryStage) {
    throw new Error('Stage "Recuperação" não encontrada no sistema');
  }

  // 5. Distribuir para sales_rep online (Round Robin)
  const { data: salesRepId } = await supabase.rpc('get_least_loaded_sales_rep');

  // 6. Criar Deal de Recuperação
  const { data: deal } = await supabase
    .from('deals')
    .insert({
      title: `Recuperação - ${Product.product_name} - ${Customer.full_name}`,
      value: Commissions.product_base_price,
      currency: 'BRL',
      status: 'open',
      stage_id: recoveryStage.id,
      pipeline_id: recoveryStage.pipeline_id,
      contact_id: contact.id,
      product_id: product?.id,
      assigned_to: salesRepId,
    })
    .select()
    .single();

  // 7. Registrar interação urgente
  await supabase
    .from('interactions')
    .insert({
      customer_id: contact.id,
      type: 'note',
      channel: 'other',
      content: `🚨 RECUPERAÇÃO URGENTE: ${order_status === 'refused' ? 'Pagamento recusado' : 'Carrinho abandonado'} - Ligar AGORA`,
      metadata: {
        product: Product.product_name,
        value: Commissions.product_base_price,
        order_id,
        deal_id: deal?.id,
        assigned_to: salesRepId
      }
    });

  console.log('[kiwify-webhook] 📞 Deal de recuperação criado:', deal?.id, 'Atribuído a:', salesRepId || 'Fila');

  return {
    success: true,
    action: 'recovery_deal_created',
    contact_id: contact.id,
    deal_id: deal?.id,
    assigned_to: salesRepId,
    message: 'Lead criado e deal de recuperação atribuído ao vendedor'
  };
}

// ============================================
// CASE 3: REFUNDED/CHARGEDBACK - Churn
// ============================================
async function handleChurnOrder(
  supabase: any,
  Customer: KiwifyCustomer,
  Product: KiwifyProduct,
  order_status: string
) {
  console.log('[kiwify-webhook] ⚫ CHURN:', order_status, Customer.email);

  // 1. Buscar contact pelo email
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('email', Customer.email)
    .single();

  if (!contact) {
    console.log('[kiwify-webhook] ⚠️ Contact não encontrado para churn:', Customer.email);
    return {
      success: false,
      error: 'Contact not found',
      message: 'Cliente não encontrado no sistema'
    };
  }

  // 2. Atualizar status para churned + bloquear
  await supabase
    .from('contacts')
    .update({
      status: 'churned',
      blocked: true,
      last_kiwify_event: order_status,
      last_kiwify_event_at: new Date().toISOString(),
    })
    .eq('id', contact.id);

  // 3. REVOGAR ACESSO no Supabase Auth (ban user)
  const { data: authUser } = await supabase.auth.admin.listUsers();
  const userToBlock = authUser?.users?.find((u: any) => u.email === Customer.email);

  if (userToBlock) {
    await supabase.auth.admin.updateUserById(userToBlock.id, {
      ban_duration: '876000h' // ~100 anos = permanente
    });
    console.log('[kiwify-webhook] 🚫 Acesso revogado para:', userToBlock.id);
  }

  // 4. CANCELAR todos os playbooks ativos
  const { data: activeExecutions } = await supabase
    .from('playbook_executions')
    .select('id')
    .eq('contact_id', contact.id)
    .in('status', ['pending', 'running']);

  if (activeExecutions && activeExecutions.length > 0) {
    const executionIds = activeExecutions.map((e: any) => e.id);
    
    await supabase
      .from('playbook_executions')
      .update({
        status: 'cancelled',
        completion_reason: { type: 'churn', reason: order_status }
      })
      .in('id', executionIds);

    // Cancelar itens na fila de execução
    await supabase
      .from('playbook_execution_queue')
      .update({ status: 'cancelled' })
      .in('execution_id', executionIds)
      .eq('status', 'pending');

    console.log('[kiwify-webhook] ⏹️ Playbooks cancelados:', executionIds.length);
  }

  // 5. Registrar interação de churn
  await supabase
    .from('interactions')
    .insert({
      customer_id: contact.id,
      type: 'note',
      channel: 'other',
      content: `⚠️ CHURN: ${order_status === 'refunded' ? 'Reembolso solicitado' : 'Chargeback recebido'} - Acesso revogado`,
      metadata: {
        product: Product.product_name,
        reason: order_status,
        blocked: true,
        access_revoked: true
      }
    });

  return {
    success: true,
    action: 'access_revoked',
    contact_id: contact.id,
    message: 'Cliente marcado como churned, acesso bloqueado, playbooks cancelados'
  };
}
