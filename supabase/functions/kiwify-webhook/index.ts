import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KiwifyAddress {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
}

interface KiwifyCustomer {
  id: string;
  full_name: string;
  email: string;
  mobile_phone?: string;
  mobile?: string;        // Campo correto do telefone
  phone?: string;
  CPF?: string;
  cnpj?: string;
  birth_date?: string;
  Address?: KiwifyAddress;
}

interface KiwifyProduct {
  product_id: string;
  product_name: string;
  offer_id?: string;  // Novo campo para offer_id
}

interface KiwifyCommissions {
  product_base_price: number;      // Valor bruto (centavos)
  charge_amount?: number;          // Valor cobrado
  my_commission?: number;          // Valor líquido que você recebe
  kiwify_fee?: number;             // Taxa da Kiwify
  currency?: string;
  commissioned_stores?: Array<{
    type: string;                  // 'producer' | 'affiliate'
    value: number;
    custom_name?: string;
    email?: string;
  }>;
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

/**
 * Verifies HMAC SHA-1 signature from Kiwify webhook
 * @param body - Raw request body string
 * @param signature - Signature from x-kiwify-signature header or query param
 * @param secret - Webhook secret from environment
 * @returns true if signature is valid, false otherwise
 */
async function verifyKiwifySignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) {
    console.error('[kiwify-webhook] ❌ Missing signature header');
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(body);

    // ✅ CORREÇÃO: Kiwify usa SHA-1, não SHA-256
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      messageData
    );

    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const isValid = expectedSignature === signature.toLowerCase();
    
    if (!isValid) {
      console.error('[kiwify-webhook] ❌ Invalid signature');
      console.error('Expected:', expectedSignature);
      console.error('Received:', signature);
    }

    return isValid;
  } catch (error) {
    console.error('[kiwify-webhook] ❌ Signature verification error:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ============================================
    // SECURITY: Verify webhook signature (HMAC)
    // MULTI-TOKEN SUPPORT
    // ============================================
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Read body as text for signature verification
    const bodyText = await req.text();
    
    // ✅ CORREÇÃO: Aceitar assinatura de AMBAS as fontes (header OU query param)
    // A Kiwify pode enviar a signature no header OU como query parameter
    const url = new URL(req.url);
    const signature = req.headers.get('x-kiwify-signature') 
      || req.headers.get('x-signature')
      || url.searchParams.get('signature');

    console.log('[kiwify-webhook] 📥 Signature source:', {
      fromHeaderKiwify: req.headers.get('x-kiwify-signature'),
      fromHeaderGeneric: req.headers.get('x-signature'),
      fromQueryParam: url.searchParams.get('signature'),
      finalSignature: signature ? signature.substring(0, 20) + '...' : 'NOT FOUND'
    });

    // 1️⃣ Tentar validar contra tokens cadastrados na tabela
    const { data: tokens } = await supabase
      .from('kiwify_webhook_tokens')
      .select('id, token')
      .eq('is_active', true);

    let isValid = false;
    let matchedTokenId: string | null = null;

    console.log(`[kiwify-webhook] 🔍 Testing ${tokens?.length || 0} active tokens`);

    for (const tokenRecord of tokens || []) {
      if (await verifyKiwifySignature(bodyText, signature, tokenRecord.token)) {
        isValid = true;
        matchedTokenId = tokenRecord.id;
        console.log(`[kiwify-webhook] ✅ Token matched: ${tokenRecord.id}`);
        break;
      }
    }

    // 2️⃣ Fallback: Tentar KIWIFY_WEBHOOK_SECRET (compatibilidade retroativa)
    if (!isValid) {
      const envSecret = Deno.env.get('KIWIFY_WEBHOOK_SECRET');
      if (envSecret) {
        console.log('[kiwify-webhook] 🔄 Trying fallback env secret');
        isValid = await verifyKiwifySignature(bodyText, signature, envSecret);
        if (isValid) {
          console.log('[kiwify-webhook] ✅ Fallback env secret validated');
        }
      }
    }

    // 3️⃣ Se nenhum token validou, rejeitar
    if (!isValid) {
      console.error('[kiwify-webhook] ❌ SECURITY: Invalid webhook signature - possible attack');
      console.error('[kiwify-webhook] Tested tokens from DB:', tokens?.length || 0);
      console.error('[kiwify-webhook] Env secret available:', !!Deno.env.get('KIWIFY_WEBHOOK_SECRET'));
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4️⃣ Se token da tabela foi usado, atualizar last_used_at
    if (matchedTokenId) {
      await supabase
        .from('kiwify_webhook_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', matchedTokenId);
      console.log('[kiwify-webhook] 📝 Token last_used_at updated');
    }

    console.log('[kiwify-webhook] ✅ Signature verified');

    const payload: KiwifyWebhookPayload = JSON.parse(bodyText);
    console.log('[kiwify-webhook] Received:', payload.order_status, payload.order_id);

    // ============================================
    // DEFENSIVE VALIDATION: Check required fields
    // ============================================
    if (!payload.order_status) {
      console.error('[kiwify-webhook] ❌ Missing order_status');
      return new Response(
        JSON.stringify({ error: 'Missing order_status in payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.Customer) {
      console.error('[kiwify-webhook] ❌ Missing Customer data');
      return new Response(
        JSON.stringify({ error: 'Missing Customer in payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.Product) {
      console.error('[kiwify-webhook] ❌ Missing Product data');
      return new Response(
        JSON.stringify({ error: 'Missing Product in payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { order_status, Customer, Product, Commissions, order_id } = payload;

    // ============================================
    // REGISTRAR EVENTO NA TABELA DE AUDITORIA
    // ============================================
    const eventRecord = await supabase
      .from('kiwify_events')
      .insert({
        event_type: order_status,
        order_id: order_id,
        customer_email: Customer?.email || 'unknown',
        product_id: Product?.product_id || 'unknown',
        offer_id: Product?.offer_id || null,
        payload: payload,
        processed: false,
      })
      .select()
      .single();

    console.log('[kiwify-webhook] ✅ Event logged:', eventRecord.data?.id);

    let result;
    let error_message = null;
    
    try {
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
          
          // Marcar evento como processado (ignorado)
          if (eventRecord.data) {
            await supabase
              .from('kiwify_events')
              .update({ processed: true })
              .eq('id', eventRecord.data.id);
          }
          
          return new Response(JSON.stringify({ ignored: true, status: order_status }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });
      }

      // Marcar evento como processado com sucesso
      if (eventRecord.data) {
        await supabase
          .from('kiwify_events')
          .update({ processed: true })
          .eq('id', eventRecord.data.id);
      }

    } catch (processingError) {
      error_message = processingError instanceof Error ? processingError.message : 'Unknown error';
      console.error('[kiwify-webhook] Processing error:', error_message);
      
      // Marcar evento como erro
      if (eventRecord.data) {
        await supabase
          .from('kiwify_events')
          .update({ 
            processed: false,
            error_message: error_message 
          })
          .eq('id', eventRecord.data.id);
      }
      
      throw processingError;
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
  console.log('[kiwify-webhook] 📊 Customer data:', {
    document: Customer.CPF || Customer.cnpj || 'NONE',
    phone: Customer.mobile || Customer.mobile_phone || Customer.phone || 'NONE'
  });
  // Extrair dados do afiliado
  const affiliateData = Commissions.commissioned_stores?.find(s => s.type === 'affiliate');
  const affiliateCommission = (affiliateData?.value || 0) / 100;
  const affiliateName = affiliateData?.custom_name || null;
  const affiliateEmail = affiliateData?.email || null;

  console.log('[kiwify-webhook] 💰 Financial values:', {
    gross: Commissions.product_base_price / 100,
    net: (Commissions.my_commission || Commissions.product_base_price) / 100,
    fee: (Commissions.kiwify_fee || 0) / 100,
    affiliateCommission,
    affiliateName,
    affiliateEmail
  });

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

  // 1. Buscar produto por offer_id PRIMEIRO (se disponível), depois product_id como offer_id, fallback para external_id
  let product = null;
  let offer = null;
  
  if (Product.offer_id) {
    // PRIORIDADE 1: Buscar por offer_id explícito em product_offers
    const { data: offerData } = await supabase
      .from('product_offers')
      .select(`
        id,
        offer_id,
        offer_name,
        price,
        products:product_id (
          id,
          name,
          external_id,
          delivery_group_id,
          support_channel_id
        )
      `)
      .eq('offer_id', Product.offer_id)
      .eq('is_active', true)
      .single();
    
    if (offerData) {
      offer = offerData;
      product = offerData.products;
      console.log('[kiwify-webhook] ✅ Produto encontrado via offer_id:', Product.offer_id);
    }
  }
  
  // PRIORIDADE 2: 🆕 CRÍTICO - Tentar product_id como offer_id (Kiwify envia offer_id no campo product_id às vezes)
  if (!product) {
    const { data: offerData } = await supabase
      .from('product_offers')
      .select(`
        id,
        offer_id,
        offer_name,
        price,
        products:product_id (
          id,
          name,
          external_id,
          delivery_group_id,
          support_channel_id
        )
      `)
      .eq('offer_id', Product.product_id)  // ← NOVA LÓGICA: buscar product_id como offer_id
      .eq('is_active', true)
      .single();
    
    if (offerData) {
      offer = offerData;
      product = offerData.products;
      console.log('[kiwify-webhook] ✅ Produto encontrado via product_id→offer_id:', Product.product_id);
    }
  }
  
  // PRIORIDADE 3: Buscar por external_id (compatibilidade legacy)
  if (!product) {
    const { data: productData } = await supabase
      .from('products')
      .select('id, name, external_id, delivery_group_id, support_channel_id')
      .eq('external_id', Product.product_id)
      .single();
    
    product = productData;
    
    if (product) {
      console.log('[kiwify-webhook] ⚠️ Produto encontrado via external_id (fallback):', Product.product_id);
    }
  }

  // 2. Criar contact como CUSTOMER (com support_channel_id do produto)
  const nameParts = Customer.full_name.split(' ');
  const { data: contact } = await supabase
    .from('contacts')
    .insert({
      email: Customer.email,
      first_name: nameParts[0],
      last_name: nameParts.slice(1).join(' ') || nameParts[0],
      phone: Customer.mobile || Customer.mobile_phone || Customer.phone || null,
      document: Customer.CPF || Customer.cnpj || null,
      birth_date: Customer.birth_date || null,
      address: Customer.Address?.street || null,
      address_number: Customer.Address?.number || null,
      address_complement: Customer.Address?.complement || null,
      neighborhood: Customer.Address?.neighborhood || null,
      city: Customer.Address?.city || null,
      state: Customer.Address?.state || null,
      zip_code: Customer.Address?.zipcode || null,
      status: 'customer',
      total_ltv: Commissions.product_base_price / 100, // LTV inicial (centavos → reais)
      kiwify_customer_id: Customer.id,
      subscription_plan: Product.product_name,
      registration_date: new Date().toISOString(),
      last_kiwify_event: 'paid',
      last_kiwify_event_at: new Date().toISOString(),
      support_channel_id: product?.support_channel_id || null, // 🆕 Herdar canal do produto
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

  // 2.5 🆕 CRIAR DEAL COM STATUS "GANHO" E VALOR DA VENDA
  const grossValue = Commissions.product_base_price / 100;
  const netValue = (Commissions.my_commission || Commissions.product_base_price) / 100;
  const kiwifyFee = (Commissions.kiwify_fee || 0) / 100;

  const { data: wonDeal, error: dealError } = await supabase
    .from('deals')
    .insert({
      title: `Venda Kiwify: ${Product.product_name}`,
      contact_id: contact.id,
      value: netValue,              // Valor líquido como principal
      gross_value: grossValue,      // Valor bruto
      net_value: netValue,          // Valor líquido
      kiwify_fee: kiwifyFee,        // Taxa Kiwify
      affiliate_commission: affiliateCommission,  // Comissão afiliado
      affiliate_name: affiliateName,              // Nome do afiliado
      affiliate_email: affiliateEmail,            // Email do afiliado
      currency: 'BRL',
      status: 'won',
      closed_at: new Date().toISOString(),
      pipeline_id: '00000000-0000-0000-0000-000000000001', // Pipeline de Vendas
      stage_id: '55555555-5555-5555-5555-555555555555', // Fechado
      product_id: product?.id || null,
      lead_source: 'kiwify',
    })
    .select()
    .single();

  if (dealError) {
    console.error('[kiwify-webhook] ❌ Erro ao criar deal ganho:', dealError);
  } else {
    console.log('[kiwify-webhook] ✅ Deal ganho criado:', wonDeal.id, 'Bruto: R$', grossValue.toFixed(2), 'Líquido: R$', netValue.toFixed(2));
  }

  // 3. Buscar produto por offer_id PRIMEIRO (se disponível), fallback para external_id
  let playbook_ids: string[] = [];
  
  if (!product) {
    console.warn(`[kiwify-webhook] ⚠️ Produto não mapeado - Offer ID: ${Product.offer_id || 'N/A'}, Product ID: ${Product.product_id}`);
    
    // Registrar na timeline do cliente
    await supabase
      .from('interactions')
      .insert({
        customer_id: contact.id,
        type: 'note',
        channel: 'other',
        content: `⚠️ Produto/Oferta não mapeado - Offer: ${Product.offer_id || 'N/A'}, Product: ${Product.product_id}`,
        metadata: {
          product_name: Product.product_name,
          product_id: Product.product_id,
          offer_id: Product.offer_id,
          price: Commissions.product_base_price,
          unmapped: true
        }
      });

    // ============================================
    // CRIAR ALERTA PARA ADMINISTRADORES
    // ============================================
    await supabase
      .from('admin_alerts')
      .insert({
        type: 'unmapped_product',
        title: '🛒 Novo Produto Kiwify Não Mapeado',
        message: `Produto "${Product.product_name}" não está cadastrado no sistema. Cadastre manualmente para habilitar automações.`,
        metadata: {
          product_name: Product.product_name,
          product_id: Product.product_id,
          offer_id: Product.offer_id,
          offer_name: offer?.offer_name || null,
          price: Commissions.product_base_price,
          customer_email: Customer.email,
          order_id: order_id,
        }
      });
    
    console.log('[kiwify-webhook] 🔔 Admin alert created for unmapped product');
  } else if (product.delivery_group_id) {
    const { data: groupPlaybooks } = await supabase
      .from('group_playbooks')
      .select('playbook_id, playbook:onboarding_playbooks(id, is_active)')
      .eq('group_id', product.delivery_group_id)
      .order('position');
    
    if (groupPlaybooks) {
      playbook_ids = groupPlaybooks
        .filter((gp: any) => gp.playbook?.is_active)
        .map((gp: any) => gp.playbook_id);
    }
  } else {
    const { data: playbook } = await supabase
      .from('onboarding_playbooks')
      .select('id')
      .eq('product_id', product.id)
      .eq('is_active', true)
      .single();
    
    if (playbook) playbook_ids = [playbook.id];
  }

  // 4. 🎯 Iniciar TODOS os Playbooks
  for (const playbook_id of playbook_ids) {
    await supabase
      .from('playbook_executions')
      .insert({
        playbook_id,
        contact_id: contact.id,
        status: 'pending',
      });
  }
  
  console.log(`[kiwify-webhook] 🎯 ${playbook_ids.length} playbook(s) iniciado(s)`);

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
        product_id: Product.product_id,
        offer_id: Product.offer_id || null,
        offer_name: offer?.offer_name || null,
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
    deal_id: wonDeal?.id,
    deal_gross_value: grossValue,
    deal_net_value: netValue,
    playbook_ids,
    playbooks_count: playbook_ids.length,
    message: `Novo cliente criado, Deal ganho criado (Bruto: R$ ${grossValue.toFixed(2)}, Líquido: R$ ${netValue.toFixed(2)}), Auth configurado, ${playbook_ids.length} playbook(s) iniciado(s)`
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
  const grossValue = Commissions.product_base_price / 100;
  const netValue = (Commissions.my_commission || Commissions.product_base_price) / 100;
  const kiwifyFee = (Commissions.kiwify_fee || 0) / 100;
  
  // Extrair dados do afiliado para upsell
  const upsellAffiliateData = Commissions.commissioned_stores?.find(s => s.type === 'affiliate');
  const upsellAffiliateCommission = (upsellAffiliateData?.value || 0) / 100;
  const upsellAffiliateName = upsellAffiliateData?.custom_name || null;
  const upsellAffiliateEmail = upsellAffiliateData?.email || null;
  
  const newLtv = (existingContact.total_ltv || 0) + netValue;
  
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

  // 2.5 🆕 CRIAR DEAL COM STATUS "GANHO" PARA UPSELL
  const { data: upsellDeal, error: dealError } = await supabase
    .from('deals')
    .insert({
      title: `Upsell Kiwify: ${Product.product_name}`,
      contact_id: existingContact.id,
      value: netValue,              // Valor líquido
      gross_value: grossValue,      // Valor bruto
      net_value: netValue,          // Valor líquido
      kiwify_fee: kiwifyFee,        // Taxa Kiwify
      affiliate_commission: upsellAffiliateCommission,  // Comissão afiliado
      affiliate_name: upsellAffiliateName,              // Nome do afiliado
      affiliate_email: upsellAffiliateEmail,            // Email do afiliado
      currency: 'BRL',
      status: 'won',
      closed_at: new Date().toISOString(),
      pipeline_id: '00000000-0000-0000-0000-000000000001', // Pipeline de Vendas
      stage_id: '55555555-5555-5555-5555-555555555555', // Fechado
      lead_source: 'kiwify_upsell',
    })
    .select()
    .single();

  if (dealError) {
    console.error('[kiwify-webhook] ❌ Erro ao criar deal upsell:', dealError);
  } else {
    console.log('[kiwify-webhook] ✅ Deal upsell criado:', upsellDeal.id, 'Bruto: R$', grossValue.toFixed(2), 'Líquido: R$', netValue.toFixed(2));
  }

  // 3. Buscar produto e playbooks (NOVA LÓGICA: offer_id primeiro, product_id como offer_id, external_id)
  let product = null;
  let offer = null;
  
  if (Product.offer_id) {
    // PRIORIDADE 1: Buscar por offer_id explícito
    const { data: offerData } = await supabase
      .from('product_offers')
      .select(`
        id,
        offer_id,
        offer_name,
        price,
        products:product_id (
          id,
          name,
          external_id,
          delivery_group_id,
          support_channel_id
        )
      `)
      .eq('offer_id', Product.offer_id)
      .eq('is_active', true)
      .single();
    
    if (offerData) {
      offer = offerData;
      product = offerData.products;
      console.log('[kiwify-webhook] ✅ [UPSELL] Produto encontrado via offer_id:', Product.offer_id);
    }
  }
  
  // PRIORIDADE 2: 🆕 CRÍTICO - Tentar product_id como offer_id
  if (!product) {
    const { data: offerData } = await supabase
      .from('product_offers')
      .select(`
        id,
        offer_id,
        offer_name,
        price,
        products:product_id (
          id,
          name,
          external_id,
          delivery_group_id,
          support_channel_id
        )
      `)
      .eq('offer_id', Product.product_id)  // ← NOVA LÓGICA
      .eq('is_active', true)
      .single();
    
    if (offerData) {
      offer = offerData;
      product = offerData.products;
      console.log('[kiwify-webhook] ✅ [UPSELL] Produto encontrado via product_id→offer_id:', Product.product_id);
    }
  }
  
  // PRIORIDADE 3: Buscar por external_id (compatibilidade legacy)
  if (!product) {
    const { data: productData } = await supabase
      .from('products')
      .select('id, name, external_id, delivery_group_id, support_channel_id')
      .eq('external_id', Product.product_id)
      .single();
    
    product = productData;
    
    if (product) {
      console.log('[kiwify-webhook] ⚠️ [UPSELL] Produto encontrado via external_id (fallback):', Product.product_id);
    }
  }

  // 4. Iniciar playbook(s) do novo produto (pular etapa de login)
  let playbook_ids: string[] = [];
  
  if (product) {
    if (product.delivery_group_id) {
      // NOVA LÓGICA: Buscar todos playbooks do grupo
      const { data: groupPlaybooks } = await supabase
        .from('group_playbooks')
        .select(`
          playbook_id,
          playbook:onboarding_playbooks(id, name, is_active)
        `)
        .eq('group_id', product.delivery_group_id)
        .order('position');
      
      if (groupPlaybooks && groupPlaybooks.length > 0) {
        playbook_ids = groupPlaybooks
          .filter((gp: any) => gp.playbook?.is_active)
          .map((gp: any) => gp.playbook_id);
        
        for (const playbook_id of playbook_ids) {
          await supabase
            .from('playbook_executions')
            .insert({
              playbook_id,
              contact_id: existingContact.id,
              status: 'pending',
            });
        }
        
        console.log(`[kiwify-webhook] 🎯 ${playbook_ids.length} playbook(s) de upsell iniciado(s)`);
      }
    } else {
      // FALLBACK: Lógica antiga (product_id direto)
      const { data: playbook } = await supabase
        .from('onboarding_playbooks')
        .select('id')
        .eq('product_id', product.id)
        .eq('is_active', true)
        .single();
      
      if (playbook) {
        playbook_ids = [playbook.id];
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
        product_id: Product.product_id,
        offer_id: Product.offer_id || null,
        offer_name: offer?.offer_name || null,
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
    deal_id: upsellDeal?.id,
    deal_gross_value: grossValue,
    deal_net_value: netValue,
    new_ltv: newLtv,
    playbook_ids,
    playbooks_count: playbook_ids.length,
    consultant_notified: !!existingContact.consultant_id,
    message: `Upsell processado, Deal ganho criado (Bruto: R$ ${grossValue.toFixed(2)}, Líquido: R$ ${netValue.toFixed(2)}), LTV atualizado, ${playbook_ids.length} playbook(s) iniciado(s)`
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
Seu cliente ${contact.first_name} acabou de comprar ${Product.product_name} (R$ ${(Commissions.product_base_price / 100).toFixed(2)}).
Entre em contato para agradecer e garantir boa experiência!`,
      metadata: {
        notification_type: 'upsell_alert',
        consultant_id: consultantId,
        product: Product.product_name,
        value: Commissions.product_base_price / 100
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
  const renewalValue = Commissions.product_base_price / 100; // ✅ Converter centavos para reais
  const newLtv = (contact.total_ltv || 0) + renewalValue;
  
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
        value: renewalValue,
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

  // 1. Buscar produto primeiro para obter support_channel_id
  const { data: product } = await supabase
    .from('products')
    .select('id, name, external_id, support_channel_id')
    .eq('external_id', Product.product_id)
    .single();

  if (!product) {
    console.warn(`[kiwify-webhook] ⚠️ Produto não mapeado para recuperação - ID Kiwify: ${Product.product_id}`);
  }

  // 2. Criar/Atualizar contact como LEAD (com support_channel_id do produto)
  const nameParts = Customer.full_name.split(' ');
  const { data: contact } = await supabase
    .from('contacts')
    .upsert({
      email: Customer.email,
      first_name: nameParts[0],
      last_name: nameParts.slice(1).join(' ') || nameParts[0],
      phone: Customer.mobile || Customer.mobile_phone || Customer.phone || null,
      document: Customer.CPF || Customer.cnpj || null,
      birth_date: Customer.birth_date || null,
      address: Customer.Address?.street || null,
      address_number: Customer.Address?.number || null,
      address_complement: Customer.Address?.complement || null,
      neighborhood: Customer.Address?.neighborhood || null,
      city: Customer.Address?.city || null,
      state: Customer.Address?.state || null,
      zip_code: Customer.Address?.zipcode || null,
      status: 'lead',
      kiwify_customer_id: Customer.id,
      last_kiwify_event: order_status,
      last_kiwify_event_at: new Date().toISOString(),
      support_channel_id: product?.support_channel_id || null, // 🆕 Herdar canal do produto
    }, {
      onConflict: 'email'
    })
    .select()
    .single();

  // 3. VERIFICAR DUPLICIDADE: UM CLIENTE = UM DEAL (independente do produto)
  const { data: existingDeal } = await supabase
    .from('deals')
    .select('id, title, value, product_id')
    .eq('contact_id', contact.id)
    .eq('status', 'open')
    .ilike('title', '%Recuperação%')
    .maybeSingle();

  if (existingDeal) {
    // AGREGAR produto ao deal existente
    const additionalValue = Commissions.product_base_price / 100;
    const newValue = (existingDeal.value || 0) + additionalValue;
    
    // Atualizar título se produto ainda não está incluso
    let newTitle = existingDeal.title;
    if (!existingDeal.title.includes(Product.product_name)) {
      newTitle = `${existingDeal.title} + ${Product.product_name}`;
    }
    
    // Update deal com valor agregado e produto (se existir)
    const updatePayload: any = {
      value: newValue,
      title: newTitle,
      updated_at: new Date().toISOString()
    };
    
    // Se há produto mapeado e o deal não tinha produto, adicionar
    if (product && !existingDeal.product_id) {
      updatePayload.product_id = product.id;
    }
    
    await supabase
      .from('deals')
      .update(updatePayload)
      .eq('id', existingDeal.id);
    
    // Registrar nota sobre produto adicional
    await supabase
      .from('interactions')
      .insert({
        customer_id: contact.id,
        type: 'note',
        channel: 'other',
        content: `➕ Produto adicional ao carrinho: ${Product.product_name} (R$ ${additionalValue.toFixed(2)}) - Cliente tentou comprar mais um produto`,
        metadata: {
          product: Product.product_name,
          value_added: additionalValue,
          new_total: newValue,
          order_id,
          deal_id: existingDeal.id
        }
      });
    
    console.log('[kiwify-webhook] ➕ Produto agregado ao deal existente:', existingDeal.id, 'Novo valor:', newValue);
    
    return {
      success: true,
      action: 'product_aggregated_to_deal',
      contact_id: contact.id,
      deal_id: existingDeal.id,
      message: `Produto ${Product.product_name} agregado ao deal existente. Novo valor: R$ ${newValue.toFixed(2)}`
    };
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
  const grossValue = Commissions.product_base_price / 100;
  const netValue = (Commissions.my_commission || Commissions.product_base_price) / 100;
  const kiwifyFee = (Commissions.kiwify_fee || 0) / 100;
  const affiliateCommission = (Commissions.commissioned_stores?.find(s => s.type === 'affiliate')?.value || 0) / 100;

  const { data: deal } = await supabase
    .from('deals')
    .insert({
      title: `Recuperação - ${Product.product_name} - ${Customer.full_name}`,
      value: netValue,              // Valor líquido
      gross_value: grossValue,      // Valor bruto
      net_value: netValue,          // Valor líquido
      kiwify_fee: kiwifyFee,        // Taxa Kiwify
      affiliate_commission: affiliateCommission,  // Comissão afiliado
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
        gross_value: grossValue,
        net_value: netValue,
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

  // 1. Buscar produto para obter support_channel_id
  const { data: product } = await supabase
    .from('products')
    .select('id, support_channel_id')
    .eq('external_id', Product.product_id)
    .single();

  // 2. Update contact to OVERDUE status (com canal do produto)
  const { data: contact } = await supabase
    .from('contacts')
    .update({
      status: 'overdue',
      last_kiwify_event: order_status,
      last_kiwify_event_at: new Date().toISOString(),
      support_channel_id: product?.support_channel_id || null,
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

  // 5. Create overdue deal
  const overdueValue = Commissions.product_base_price / 100; // ✅ Converter centavos para reais
  const { data: deal } = await supabase
    .from('deals')
    .insert({
      title: `Cobrança - ${Product.product_name} - ${Customer.full_name}`,
      value: overdueValue,
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
