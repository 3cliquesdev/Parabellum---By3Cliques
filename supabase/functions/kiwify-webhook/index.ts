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
  order_status: 
    | 'paid' | 'order_approved'
    | 'subscription_renewed'
    | 'refused' | 'cart_abandoned' | 'payment_refused'
    | 'subscription_late' | 'subscription_card_declined'
    | 'refunded' | 'chargedback' | 'subscription_canceled';
  Customer: KiwifyCustomer;
  Product: KiwifyProduct;
  Commissions: KiwifyCommissions;
  Subscription?: {
    id: string;
    status: string;
  };
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
      case 'order_approved':
        result = await handlePaidOrder(supabase, Customer, Product, Commissions, order_id);
        break;
      
      case 'subscription_renewed':
        result = await handleSubscriptionRenewal(supabase, Customer, Product, Commissions);
        break;
      
      case 'refused':
      case 'cart_abandoned':
      case 'payment_refused':
        result = await handleRecoveryOrder(supabase, Customer, Product, Commissions, order_status, order_id);
        break;
      
      case 'subscription_late':
      case 'subscription_card_declined':
        result = await handleOverduePayment(supabase, Customer, Product, Commissions, order_status);
        break;
      
      case 'refunded':
      case 'chargedback':
      case 'subscription_canceled':
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
  console.log('[kiwify-webhook] 💚 PAID - Verificando existência:', Customer.email);

  // 🔍 DIVISOR DE ÁGUAS: Verificar se cliente já existe
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, total_ltv, consultant_id, status, first_name')
    .eq('email', Customer.email)
    .single();
  
  const isReturningCustomer = existingContact && existingContact.status === 'customer';
  
  if (isReturningCustomer) {
    console.log('[kiwify-webhook] 💰 UPSELL DETECTADO - Cliente recorrente');
    return handleUpsellOrder(supabase, existingContact, Customer, Product, Commissions, order_id);
  }

  // ========================================
  // FLUXO DE NOVO CLIENTE (Primeira Compra)
  // ========================================
  console.log('[kiwify-webhook] 🆕 NOVO CLIENTE - Iniciando onboarding:', Customer.email);

  // 1. Criar contact como CUSTOMER
  const nameParts = Customer.full_name.split(' ');
  const { data: contact } = await supabase
    .from('contacts')
    .insert({
      email: Customer.email,
      first_name: nameParts[0],
      last_name: nameParts.slice(1).join(' ') || nameParts[0],
      phone: Customer.mobile_phone,
      document: Customer.CPF,
      status: 'customer',
      total_ltv: Commissions.product_base_price, // LTV inicial
      kiwify_customer_id: Customer.id,
      subscription_plan: Product.product_name,
      registration_date: new Date().toISOString(),
      last_kiwify_event: 'paid',
      last_kiwify_event_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (!contact) {
    throw new Error('Failed to create contact');
  }

  // 2. ✅ CRIAR Login no Supabase Auth (senha = 5 primeiros dígitos CPF)
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
    console.warn('[kiwify-webhook] Auth error:', authErr);
  }

  // 3. Buscar produto por external_id (Kiwify product_id)
  const { data: product } = await supabase
    .from('products')
    .select('id, name, external_id')
    .eq('external_id', Product.product_id)
    .single();

  let playbook_id = null;
  
  if (!product) {
    console.warn(`[kiwify-webhook] ⚠️ Produto não mapeado - ID Kiwify: ${Product.product_id}`);
    
    await supabase
      .from('interactions')
      .insert({
        customer_id: contact.id,
        type: 'note',
        channel: 'other',
        content: `⚠️ Produto não mapeado no sistema - ID Kiwify: ${Product.product_id}`,
        metadata: {
          product_name: Product.product_name,
          product_id: Product.product_id,
          unmapped: true
        }
      });
  } else {
    const { data: playbook } = await supabase
      .from('onboarding_playbooks')
      .select('id')
      .eq('product_id', product.id)
      .eq('is_active', true)
      .single();
    
    playbook_id = playbook?.id;
  }

  // 4. 🎯 Iniciar Playbook de Onboarding COMPLETO (com etapa de login)
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

    console.log('[kiwify-webhook] 🎯 Playbook completo iniciado:', execution?.id);
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
      content: `✅ Venda aprovada via Kiwify: ${Product.product_name} (Novo Cliente)`,
      metadata: {
        product: Product.product_name,
        value: Commissions.product_base_price,
        order_id,
        kiwify_customer_id: Customer.id,
        new_customer: true
      }
    });

  return {
    success: true,
    action: 'new_customer_onboarding',
    contact_id: contact.id,
    playbook_id,
    message: 'Novo cliente criado, Auth configurado, onboarding completo iniciado'
  };
}

// ============================================
// CASE 1.2: UPSELL - Cliente Recorrente
// ============================================
async function handleUpsellOrder(
  supabase: any,
  existingContact: any,
  Customer: KiwifyCustomer,
  Product: KiwifyProduct,
  Commissions: KiwifyCommissions,
  order_id: string
) {
  console.log('[kiwify-webhook] 💰 UPSELL:', Customer.email);

  // 1. ❌ NÃO criar usuário no Auth (já existe)
  // 2. ✅ Atualizar LTV somando valor da nova compra
  const newLtv = (existingContact.total_ltv || 0) + Commissions.product_base_price;
  
  await supabase
    .from('contacts')
    .update({
      total_ltv: newLtv,
      subscription_plan: Product.product_name,
      last_payment_date: new Date().toISOString(),
      last_kiwify_event: 'paid_upsell',
      last_kiwify_event_at: new Date().toISOString(),
    })
    .eq('id', existingContact.id);

  // 3. Buscar produto e playbook
  const { data: product } = await supabase
    .from('products')
    .select('id, name, external_id')
    .eq('external_id', Product.product_id)
    .single();

  // 4. Iniciar playbook do novo produto (pular etapa de login)
  let playbook_id = null;
  if (product) {
    const { data: playbook } = await supabase
      .from('onboarding_playbooks')
      .select('id')
      .eq('product_id', product.id)
      .eq('is_active', true)
      .single();
    
    if (playbook) {
      playbook_id = playbook.id;
      await supabase
        .from('playbook_executions')
        .insert({
          playbook_id: playbook.id,
          contact_id: existingContact.id,
          status: 'pending',
        });
      
      console.log('[kiwify-webhook] 🎯 Playbook de upsell iniciado (sem login)');
    }
  }

  // 5. 📧 Registrar interação de UPSELL
  await supabase
    .from('interactions')
    .insert({
      customer_id: existingContact.id,
      type: 'note',
      channel: 'other',
      content: `💰 UPSELL: ${Product.product_name} adicionado à conta - LTV: R$ ${newLtv.toFixed(2)}`,
      metadata: {
        product: Product.product_name,
        value: Commissions.product_base_price,
        order_id,
        upsell: true,
        previous_ltv: existingContact.total_ltv || 0,
        new_ltv: newLtv
      }
    });

  // 6. 🔔 NOTIFICAR CONSULTOR (se tiver)
  if (existingContact.consultant_id) {
    await notifyConsultantUpsell(
      supabase, 
      existingContact.consultant_id, 
      existingContact, 
      Product, 
      Commissions
    );
  }

  return {
    success: true,
    action: 'upsell_processed',
    contact_id: existingContact.id,
    new_ltv: newLtv,
    playbook_id,
    consultant_notified: !!existingContact.consultant_id,
    message: 'Upsell processado, LTV atualizado, consultor notificado'
  };
}

// ============================================
// Notificação de Upsell ao Consultor
// ============================================
async function notifyConsultantUpsell(
  supabase: any,
  consultantId: string,
  contact: any,
  Product: KiwifyProduct,
  Commissions: KiwifyCommissions
) {
  // 1. Criar interação especial para o consultor ver
  await supabase
    .from('interactions')
    .insert({
      customer_id: contact.id,
      type: 'note',
      channel: 'other',
      content: `💰 UPSELL DETECTADO!
Seu cliente ${contact.first_name} acabou de comprar ${Product.product_name} (R$ ${Commissions.product_base_price.toFixed(2)}).
Entre em contato para agradecer e garantir boa experiência!`,
      metadata: {
        notification_type: 'upsell_alert',
        consultant_id: consultantId,
        product: Product.product_name,
        value: Commissions.product_base_price
      }
    });

  // 2. Criar atividade para o consultor
  await supabase
    .from('activities')
    .insert({
      title: `💰 Agradecer Upsell - ${contact.first_name}`,
      description: `Cliente comprou ${Product.product_name}. Enviar mensagem de agradecimento.`,
      type: 'call',
      contact_id: contact.id,
      assigned_to: consultantId,
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // +24h
      completed: false
    });

  console.log('[kiwify-webhook] 🔔 Consultor notificado:', consultantId);
}

// ============================================
// CASE 1.5: SUBSCRIPTION_RENEWED - Renovação
// ============================================
async function handleSubscriptionRenewal(
  supabase: any,
  Customer: KiwifyCustomer,
  Product: KiwifyProduct,
  Commissions: KiwifyCommissions
) {
  console.log('[kiwify-webhook] 🔄 RENOVAÇÃO:', Customer.email);

  // 1. Find existing customer
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, total_ltv')
    .eq('email', Customer.email)
    .single();

  if (!contact) {
    console.warn('[kiwify-webhook] Customer not found for renewal, treating as new order');
    return handlePaidOrder(supabase, Customer, Product, Commissions, 'renewal-fallback');
  }

  // 2. Update LTV
  const newLtv = (contact.total_ltv || 0) + Commissions.product_base_price;
  
  await supabase
    .from('contacts')
    .update({
      total_ltv: newLtv,
      last_payment_date: new Date().toISOString(),
      last_kiwify_event: 'subscription_renewed',
      last_kiwify_event_at: new Date().toISOString(),
    })
    .eq('id', contact.id);

  // 3. Log renewal interaction
  await supabase
    .from('interactions')
    .insert({
      customer_id: contact.id,
      type: 'note',
      channel: 'other',
      content: `✅ Renovação com Sucesso: ${Product.product_name} - LTV atualizado para R$ ${newLtv.toFixed(2)}`,
      metadata: { 
        product: Product.product_name, 
        value: Commissions.product_base_price,
        new_ltv: newLtv 
      }
    });

  console.log('[kiwify-webhook] ✅ LTV updated:', newLtv);

  return {
    success: true,
    action: 'ltv_updated',
    new_ltv: newLtv,
    contact_id: contact.id,
    message: 'Renovação processada, LTV atualizado'
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

  // 2. Buscar produto por external_id (Kiwify product_id)
  const { data: product } = await supabase
    .from('products')
    .select('id, name, external_id')
    .eq('external_id', Product.product_id)
    .single();

  if (!product) {
    console.warn(`[kiwify-webhook] ⚠️ Produto não mapeado para recuperação - ID Kiwify: ${Product.product_id}`);
  }

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
// CASE 2.5: SUBSCRIPTION_LATE/CARD_DECLINED - Inadimplência
// ============================================
async function handleOverduePayment(
  supabase: any,
  Customer: KiwifyCustomer,
  Product: KiwifyProduct,
  Commissions: KiwifyCommissions,
  order_status: string
) {
  console.log('[kiwify-webhook] 🟠 INADIMPLÊNCIA:', order_status, Customer.email);

  // 1. Update contact to OVERDUE status
  const { data: contact } = await supabase
    .from('contacts')
    .update({
      status: 'overdue',
      last_kiwify_event: order_status,
      last_kiwify_event_at: new Date().toISOString(),
    })
    .eq('email', Customer.email)
    .select('id, consultant_id')
    .single();

  if (!contact) {
    console.error('[kiwify-webhook] Contact not found for overdue:', Customer.email);
    return {
      success: false,
      error: 'Contact not found',
      message: 'Cliente não encontrado'
    };
  }

  // 2. Find "Cobrança Ativa" stage
  const { data: cobrancaStage } = await supabase
    .from('stages')
    .select('id, pipeline_id')
    .eq('name', 'Cobrança Ativa')
    .single();

  if (!cobrancaStage) {
    console.error('[kiwify-webhook] Cobrança Ativa stage not found');
    return {
      success: false,
      error: 'Stage not found',
      message: 'Stage "Cobrança Ativa" não encontrada'
    };
  }

  // 3. Check for existing open overdue deal (prevent duplicates)
  const { data: existingDeal } = await supabase
    .from('deals')
    .select('id')
    .eq('contact_id', contact.id)
    .eq('stage_id', cobrancaStage.id)
    .eq('status', 'open')
    .single();

  if (existingDeal) {
    console.log('[kiwify-webhook] Deal already exists, adding note');
    
    await supabase
      .from('interactions')
      .insert({
        customer_id: contact.id,
        type: 'note',
        channel: 'other',
        content: `⚠️ Nova tentativa de pagamento falhou: ${order_status}`,
        metadata: { 
          deal_id: existingDeal.id, 
          order_status 
        }
      });

    return {
      success: true,
      action: 'note_added',
      deal_id: existingDeal.id,
      message: 'Nota adicionada ao deal existente'
    };
  }

  // 4. Determine responsible (consultant or support agent)
  let assigned_to = contact.consultant_id;
  
  if (!assigned_to) {
    // Fallback: find online support agent
    const { data: supportAgent } = await supabase
      .from('profiles')
      .select('id')
      .eq('availability_status', 'online')
      .limit(1)
      .single();
    
    assigned_to = supportAgent?.id;
  }

  // 5. Buscar produto por external_id
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('external_id', Product.product_id)
    .single();

  // 6. Create overdue deal
  const { data: deal } = await supabase
    .from('deals')
    .insert({
      title: `Cobrança - ${Product.product_name} - ${Customer.full_name}`,
      value: Commissions.product_base_price,
      currency: 'BRL',
      status: 'open',
      stage_id: cobrancaStage.id,
      pipeline_id: cobrancaStage.pipeline_id,
      contact_id: contact.id,
      product_id: product?.id,
      assigned_to,
    })
    .select()
    .single();

  // 7. Log urgent interaction
  const statusMessage = order_status === 'subscription_late' 
    ? 'Pagamento atrasado' 
    : 'Cartão recusado';

  await supabase
    .from('interactions')
    .insert({
      customer_id: contact.id,
      type: 'note',
      channel: 'other',
      content: `⚠️ INADIMPLÊNCIA: ${statusMessage} - ${Product.product_name} - Iniciar cobrança`,
      metadata: { 
        deal_id: deal?.id, 
        product: Product.product_name, 
        order_status,
        assigned_to
      }
    });

  console.log('[kiwify-webhook] 📞 Overdue deal created:', deal?.id, 'Assigned to:', assigned_to || 'Queue');

  return {
    success: true,
    action: 'overdue_deal_created',
    deal_id: deal?.id,
    assigned_to,
    contact_id: contact.id,
    message: 'Deal de cobrança criado e atribuído'
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

  // 5. Create Winback Deal in "Análise de Perda / Winback" stage
  const { data: winbackStage } = await supabase
    .from('stages')
    .select('id, pipeline_id')
    .eq('name', 'Análise de Perda / Winback')
    .single();

  let deal_id = null;

  if (winbackStage) {
    const { data: deal } = await supabase
      .from('deals')
      .insert({
        title: `Winback - ${Product.product_name} - ${Customer.full_name}`,
        value: 0, // No value since it's a winback opportunity
        currency: 'BRL',
        status: 'open',
        stage_id: winbackStage.id,
        pipeline_id: winbackStage.pipeline_id,
        contact_id: contact.id,
        lost_reason: order_status,
      })
      .select()
      .single();

    deal_id = deal?.id;
    console.log('[kiwify-webhook] 🔄 Winback deal created:', deal_id);
  }

  // 6. Registrar interação de churn
  const churnReason = order_status === 'refunded' 
    ? 'Reembolso solicitado' 
    : order_status === 'chargedback' 
    ? 'Chargeback (contestação)' 
    : 'Assinatura cancelada';

  await supabase
    .from('interactions')
    .insert({
      customer_id: contact.id,
      type: 'note',
      channel: 'other',
      content: `🔴 CHURN: ${churnReason} - ${Product.product_name} - Acesso revogado`,
      metadata: {
        product: Product.product_name,
        reason: order_status,
        blocked: true,
        access_revoked: true,
        deal_id
      }
    });

  return {
    success: true,
    action: 'churn_processed',
    contact_id: contact.id,
    access_revoked: !!userToBlock,
    winback_deal_id: deal_id,
    message: 'Cliente marcado como churned, acesso bloqueado, playbooks cancelados, deal de winback criado'
  };
}
