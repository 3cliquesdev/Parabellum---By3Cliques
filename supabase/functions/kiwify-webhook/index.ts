import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// INPUT VALIDATION HELPERS
// ============================================

/**
 * Validates string field with optional max length
 */
function validateString(value: unknown, fieldName: string, maxLength: number = 500): { valid: boolean; error?: string; sanitized?: string } {
  if (value === undefined || value === null) {
    return { valid: true, sanitized: undefined };
  }
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  if (value.length > maxLength) {
    return { valid: false, error: `${fieldName} exceeds max length of ${maxLength}` };
  }
  return { valid: true, sanitized: value.trim() };
}

/**
 * Validates required string field
 */
function validateRequiredString(value: unknown, fieldName: string, maxLength: number = 500): { valid: boolean; error?: string; sanitized?: string } {
  if (value === undefined || value === null || value === '') {
    return { valid: false, error: `${fieldName} is required` };
  }
  return validateString(value, fieldName, maxLength);
}

/**
 * Validates email format
 */
function validateEmail(value: unknown, fieldName: string): { valid: boolean; error?: string; sanitized?: string } {
  if (value === undefined || value === null || value === '') {
    return { valid: true, sanitized: undefined };
  }
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value) || value.length > 255) {
    return { valid: false, error: `${fieldName} is not a valid email` };
  }
  return { valid: true, sanitized: value.trim().toLowerCase() };
}

/**
 * Validates CPF format (11 digits)
 */
function validateCPF(value: unknown): { valid: boolean; error?: string; sanitized?: string } {
  if (value === undefined || value === null || value === '') {
    return { valid: true, sanitized: undefined };
  }
  if (typeof value !== 'string') {
    return { valid: false, error: 'CPF must be a string' };
  }
  const cpf = value.replace(/\D/g, '');
  if (cpf.length > 0 && cpf.length !== 11) {
    return { valid: false, error: 'CPF must have 11 digits' };
  }
  return { valid: true, sanitized: cpf };
}

/**
 * Validates number field
 */
function validateNumber(value: unknown, fieldName: string): { valid: boolean; error?: string; sanitized?: number } {
  if (value === undefined || value === null) {
    return { valid: true, sanitized: undefined };
  }
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (typeof num !== 'number' || isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a number` };
  }
  return { valid: true, sanitized: num };
}

/**
 * Validates alphanumeric ID with max length
 */
function validateId(value: unknown, fieldName: string, maxLength: number = 100): { valid: boolean; error?: string; sanitized?: string } {
  if (value === undefined || value === null || value === '') {
    return { valid: true, sanitized: undefined };
  }
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  if (value.length > maxLength) {
    return { valid: false, error: `${fieldName} exceeds max length of ${maxLength}` };
  }
  // Allow alphanumeric, hyphens, underscores
  const idRegex = /^[a-zA-Z0-9_-]+$/;
  if (!idRegex.test(value)) {
    return { valid: false, error: `${fieldName} contains invalid characters` };
  }
  return { valid: true, sanitized: value };
}

/**
 * Validates Kiwify webhook payload structure
 */
function validateKiwifyPayload(payload: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate order_id
  const orderIdResult = validateRequiredString(payload.order_id, 'order_id', 100);
  if (!orderIdResult.valid) errors.push(orderIdResult.error!);
  
  // Validate order_status
  const validStatuses = [
    'paid', 'order_approved', 'subscription_renewed',
    'refused', 'cart_abandoned', 'payment_refused',
    'subscription_late', 'subscription_card_declined',
    'refunded', 'chargedback', 'subscription_canceled'
  ];
  if (!payload.order_status || !validStatuses.includes(payload.order_status)) {
    errors.push(`order_status must be one of: ${validStatuses.join(', ')}`);
  }
  
  // Validate Customer
  if (!payload.Customer || typeof payload.Customer !== 'object') {
    errors.push('Customer object is required');
  } else {
    const emailResult = validateEmail(payload.Customer.email, 'Customer.email');
    if (!emailResult.valid) errors.push(emailResult.error!);
    
    const nameResult = validateString(payload.Customer.full_name, 'Customer.full_name', 200);
    if (!nameResult.valid) errors.push(nameResult.error!);
    
    const cpfResult = validateCPF(payload.Customer.CPF);
    if (!cpfResult.valid) errors.push(cpfResult.error!);
    
    const phoneResult = validateString(payload.Customer.mobile || payload.Customer.phone, 'Customer.phone', 20);
    if (!phoneResult.valid) errors.push(phoneResult.error!);
  }
  
  // Validate Product
  if (!payload.Product || typeof payload.Product !== 'object') {
    errors.push('Product object is required');
  } else {
    const productIdResult = validateString(payload.Product.product_id, 'Product.product_id', 100);
    if (!productIdResult.valid) errors.push(productIdResult.error!);
    
    const productNameResult = validateString(payload.Product.product_name, 'Product.product_name', 300);
    if (!productNameResult.valid) errors.push(productNameResult.error!);
  }
  
  // Validate Commissions if present
  if (payload.Commissions && typeof payload.Commissions === 'object') {
    const priceResult = validateNumber(payload.Commissions.product_base_price, 'Commissions.product_base_price');
    if (!priceResult.valid) errors.push(priceResult.error!);
  }
  
  return { valid: errors.length === 0, errors };
}

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
    plan?: {
      id: string;      // ← ESSE É O OFFER_ID REAL
      name: string;    // ← ESSE É O NOME DA OFERTA
      frequency?: string;
    };
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

/**
 * Inicia um playbook corretamente:
 * 1. Busca o playbook e flow_definition
 * 2. Cria registro em playbook_executions com current_node_id
 * 3. Enfileira o primeiro node em playbook_execution_queue
 */
async function initiatePlaybook(
  supabase: any,
  playbook_id: string,
  contact_id: string
): Promise<string | null> {
  try {
    // 1. Buscar playbook e seu flow_definition
    const { data: playbook, error: playbookError } = await supabase
      .from('onboarding_playbooks')
      .select('id, name, flow_definition')
      .eq('id', playbook_id)
      .single();
    
    if (playbookError || !playbook) {
      console.error(`[initiatePlaybook] ❌ Playbook ${playbook_id} não encontrado:`, playbookError);
      return null;
    }
    
    const flow = playbook.flow_definition;
    const nodes = flow?.nodes || [];
    
    if (nodes.length === 0) {
      console.warn(`[initiatePlaybook] ⚠️ Playbook "${playbook.name}" não tem nodes`);
      return null;
    }
    
    // Encontrar o primeiro node (start ou o primeiro da lista)
    const startNode = nodes.find((n: any) => n.type === 'start') || nodes[0];
    
    // ANTI-DUPLICAÇÃO: verificar se já existe execução running/pending
    const { data: existingExec } = await supabase
      .from('playbook_executions')
      .select('id, status')
      .eq('playbook_id', playbook_id)
      .eq('contact_id', contact_id)
      .in('status', ['pending', 'running'])
      .maybeSingle();

    if (existingExec) {
      console.log(`[initiatePlaybook] ⚠️ Execução já ativa: ${existingExec.id} (${existingExec.status}). Pulando duplicação.`);
      return null;
    }

    // 2. Criar execução com dados completos
    const { data: execution, error: execError } = await supabase
      .from('playbook_executions')
      .insert({
        playbook_id,
        contact_id,
        status: 'running',
        current_node_id: startNode.id,
        nodes_executed: [],
        errors: [],
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (execError || !execution) {
      console.error(`[initiatePlaybook] ❌ Erro ao criar execução:`, execError);
      return null;
    }
    
    console.log(`[initiatePlaybook] ✅ Execução criada: ${execution.id} para playbook "${playbook.name}"`);
    
    // 3. CRÍTICO: Adicionar primeiro node na fila de processamento
    const { error: queueError } = await supabase
      .from('playbook_execution_queue')
      .insert({
        execution_id: execution.id,
        node_id: startNode.id,
        node_type: startNode.type || 'unknown',
        node_data: startNode.data || {},
        scheduled_for: new Date().toISOString(),
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
      });
    
    if (queueError) {
      console.error(`[initiatePlaybook] ❌ Erro ao enfileirar node:`, queueError);
      // Marcar execução como falha
      await supabase
        .from('playbook_executions')
        .update({ 
          status: 'failed',
          errors: [{ message: 'Failed to queue first node', error: queueError.message }]
        })
        .eq('id', execution.id);
      return null;
    }
    
    console.log(`[initiatePlaybook] ✅ Node "${startNode.id}" (${startNode.type}) enfileirado`);
    return execution.id;
    
  } catch (error) {
    console.error(`[initiatePlaybook] ❌ Erro inesperado:`, error);
    return null;
  }
}

/**
 * Dispara email baseado em trigger_type via send-triggered-email
 * Falha silenciosamente se não houver template ativo
 */
async function sendTriggeredEmail(
  supabase: any,
  trigger_type: string,
  contact_id: string | null,
  contact_email: string,
  variables: Record<string, string | number | null>
): Promise<void> {
  try {
    console.log(`[sendTriggeredEmail] 📧 Triggering: ${trigger_type} for ${contact_email}`);
    
    const response = await supabase.functions.invoke('send-triggered-email', {
      body: {
        trigger_type,
        contact_id,
        contact_email,
        variables
      }
    });

    if (response.error) {
      console.error(`[sendTriggeredEmail] ❌ Error:`, response.error);
    } else if (response.data?.skipped) {
      console.log(`[sendTriggeredEmail] ⏭️ Skipped: ${response.data.reason}`);
    } else {
      console.log(`[sendTriggeredEmail] ✅ Email sent: ${response.data?.email_id}`);
    }
  } catch (error) {
    // Falha silenciosa - não bloquear o fluxo principal
    console.error(`[sendTriggeredEmail] ❌ Failed (silent):`, error);
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

    // Resolver nome da organização dinamicamente
    const { data: _orgRow } = await supabase.from('organizations').select('name').limit(1).maybeSingle();
    const orgName = _orgRow?.name || 'Sua Empresa';

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
    // ENTERPRISE VALIDATION: Validate all fields
    // ============================================
    const validationResult = validateKiwifyPayload(payload);
    if (!validationResult.valid) {
      console.error('[kiwify-webhook] ❌ Validation failed:', validationResult.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Payload validation failed', 
          details: validationResult.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { order_status, Customer, Product, Commissions, order_id } = payload;

    // ============================================
    // IDEMPOTENCY CHECK: Prevent duplicate processing
    // Check if this exact event was processed in last 5 minutes
    // ============================================
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: recentEvent } = await supabase
      .from('kiwify_events')
      .select('id, processed')
      .eq('order_id', order_id)
      .eq('event_type', order_status)
      .gte('created_at', fiveMinutesAgo)
      .limit(1)
      .maybeSingle();
    
    if (recentEvent) {
      console.log('[kiwify-webhook] ⚠️ DUPLICATE EVENT DETECTED - Skipping:', {
        order_id,
        event_type: order_status,
        existing_event_id: recentEvent.id
      });
      return new Response(JSON.stringify({ 
        status: 'skipped', 
        reason: 'duplicate_event',
        existing_event_id: recentEvent.id
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // ============================================
    // REGISTRAR EVENTO NA TABELA DE AUDITORIA
    // ============================================
    
    // 🔧 CORREÇÃO CRÍTICA: Extrair offer_id de Subscription.plan.id (fonte correta da Kiwify)
    const extractedOfferId = payload.Subscription?.plan?.id || Product?.offer_id || null;
    const extractedOfferName = payload.Subscription?.plan?.name || null;
    
    console.log('[kiwify-webhook] 📋 Offer extraction:', {
      from_subscription_plan: payload.Subscription?.plan?.id,
      from_product_offer_id: Product?.offer_id,
      final_offer_id: extractedOfferId,
      offer_name: extractedOfferName
    });
    
    const eventRecord = await supabase
      .from('kiwify_events')
      .insert({
        event_type: order_status,
        order_id: order_id,
        customer_email: Customer?.email || 'unknown',
        product_id: Product?.product_id || 'unknown',
        offer_id: extractedOfferId,
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
          result = await handlePaidOrder(supabase, Customer, Product, Commissions, order_id, payload);
          break;
        
        case 'subscription_renewed':
          result = await handleSubscriptionRenewal(supabase, Customer, Product, Commissions, payload);
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
  order_id: string,
  payload: KiwifyWebhookPayload
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
  
  // ============================================
  // 🆕 FECHAMENTO AUTOMÁTICO DE DEALS ABERTOS
  // Buscar deals de recuperação/oportunidade para este email
  // ============================================
  console.log('[kiwify-webhook] 🔍 Buscando deals abertos para:', Customer.email);
  
  const { data: openDeals } = await supabase
    .from('deals')
    .select('id, title, assigned_to, contact_id, value, lead_email')
    .eq('status', 'open')
    .or(`lead_email.eq.${Customer.email}`)
    .order('created_at', { ascending: false });

  // Encontrar deal correspondente ao email do cliente
  let matchingDeal: { id: string; title: string; assigned_to: string | null; contact_id: string | null; value: number | null } | null = null;
  
  // 1. Buscar por lead_email
  if (openDeals && openDeals.length > 0) {
    matchingDeal = openDeals.find((d: any) => d.lead_email === Customer.email) || null;
  }
  
  // 2. Se não encontrou por lead_email, buscar por contact_id
  if (!matchingDeal && existingContact) {
    const { data: contactDeals } = await supabase
      .from('deals')
      .select('id, title, assigned_to, contact_id, value')
      .eq('status', 'open')
      .eq('contact_id', existingContact.id)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (contactDeals && contactDeals.length > 0) {
      matchingDeal = contactDeals[0];
    }
  }

  // 🎯 Se encontrou deal existente (COM ou SEM vendedor)
  if (matchingDeal) {
    const kiwifyValue = Commissions.product_base_price / 100;
    const valueFormatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL'
    }).format(kiwifyValue);
    
    console.log('[kiwify-webhook] ✅ Deal encontrado:', matchingDeal.id, 
                'Com vendedor:', !!matchingDeal.assigned_to, 'Valor:', valueFormatted);
    
    // Buscar kiwify_event recém-criado
    const { data: kiwifyEvent } = await supabase
      .from('kiwify_events')
      .select('id')
      .eq('order_id', order_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Vincular kiwify_event ao deal para rastreamento
    if (kiwifyEvent) {
      await supabase
        .from('kiwify_events')
        .update({ linked_deal_id: matchingDeal.id })
        .eq('id', kiwifyEvent.id);
    }

    if (matchingDeal.assigned_to) {
      // CENÁRIO A: Deal COM vendedor → marcar como pending (vendedor valida em 30 min)
      await supabase
        .from('deals')
        .update({
          pending_payment_at: new Date().toISOString(),
          pending_kiwify_event_id: kiwifyEvent?.id || null,
          value: kiwifyValue, // Atualizar valor com valor real da Kiwify
          updated_at: new Date().toISOString()
        })
        .eq('id', matchingDeal.id);

      // 🔔 NOTIFICAR VENDEDOR com urgência
      const deadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      await supabase.from('notifications').insert({
        user_id: matchingDeal.assigned_to,
        type: 'payment_pending_validation',
        title: '💰 Cliente Pagou! Validar Venda',
        message: `${Customer.full_name} pagou ${valueFormatted} por ${Product.product_name}. Informe o código Kiwify em até 30 minutos ou será marcado como venda orgânica.`,
        metadata: {
          deal_id: matchingDeal.id,
          deal_title: matchingDeal.title,
          kiwify_event_id: kiwifyEvent?.id,
          order_id,
          customer_email: Customer.email,
          customer_name: Customer.full_name,
          product_name: Product.product_name,
          value: kiwifyValue,
          deadline,
          action_url: `/deals?deal=${matchingDeal.id}`,
        },
        read: false
      });

      console.log('[kiwify-webhook] 🔔 Vendedor notificado, deadline:', deadline);

      // Registrar na timeline do contact
      if (matchingDeal.contact_id) {
        await supabase.from('interactions').insert({
          customer_id: matchingDeal.contact_id,
          type: 'note',
          channel: 'other',
          content: `💳 Pagamento detectado! Vendedor tem 30 minutos para validar. Produto: ${Product.product_name} - ${valueFormatted}`,
          metadata: {
            deal_id: matchingDeal.id,
            order_id,
            pending_validation: true,
            deadline
          }
        });
      }
    } else {
      // CENÁRIO B: Deal SEM vendedor → fechar automaticamente
      // Determinar se é venda orgânica ou de afiliado baseado na comissão
      const affiliateCommissionValue = (Commissions.commissioned_stores?.find(s => s.type === 'affiliate')?.value || 0) / 100;
      const hasAffiliate = affiliateCommissionValue > 0;
      const saleType = hasAffiliate ? 'Afiliado' : 'Orgânica';
      
      console.log(`[kiwify-webhook] 🌿 Deal sem vendedor, fechando como venda ${saleType.toLowerCase()}`);
      
      await supabase
        .from('deals')
        .update({
          status: 'won',
          is_organic_sale: !hasAffiliate, // false se tem afiliado
          value: kiwifyValue,
          closed_at: new Date().toISOString(),
          pending_payment_at: null,
          pending_kiwify_event_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', matchingDeal.id);

      // Atualizar contato para customer
      if (matchingDeal.contact_id) {
        await supabase
          .from('contacts')
          .update({
            status: 'customer',
            subscription_plan: Product.product_name,
            total_ltv: kiwifyValue,
            last_kiwify_event: 'paid',
            last_kiwify_event_at: new Date().toISOString()
          })
          .eq('id', matchingDeal.contact_id);

        // Registrar na timeline do contato
        await supabase.from('interactions').insert({
          customer_id: matchingDeal.contact_id,
          type: 'note',
          channel: 'other',
          content: `Venda ${saleType}! ${valueFormatted} por ${Product.product_name} - Deal fechado automaticamente`,
          metadata: {
            deal_id: matchingDeal.id,
            order_id,
            organic: !hasAffiliate,
            affiliate: hasAffiliate,
            value: kiwifyValue
          }
        });
      }

      console.log(`[kiwify-webhook] ✅ Deal ${saleType.toLowerCase()} fechado:`, matchingDeal.id, 'Valor:', valueFormatted);

      // 🆕 CRIAR DEAL EM CS - NOVOS CLIENTES (para acompanhamento do time de CS)
      // Só cria se o contato NÃO era cliente antes (primeira compra)
      const wasAlreadyCustomer = existingContact && existingContact.status === 'customer';
      let csDealCreated = false;
      
      if (!wasAlreadyCustomer) {
        try {
          const { data: csNovosPipeline } = await supabase
            .from('pipelines')
            .select('id')
            .eq('name', 'CS - Novos Clientes')
            .single();

          if (csNovosPipeline) {
            const { data: csFirstStage } = await supabase
              .from('stages')
              .select('id')
              .eq('pipeline_id', csNovosPipeline.id)
              .order('position', { ascending: true })
              .limit(1)
              .single();

            if (csFirstStage) {
              // Buscar produto se ainda não temos
              let productId = null;
              const { data: productData } = await supabase
                .from('products')
                .select('id')
                .or(`external_id.eq.${Product.product_id},name.ilike.%${Product.product_name}%`)
                .limit(1)
                .single();
              
              if (productData) {
                productId = productData.id;
              }

              const { data: csDeal, error: csDealError } = await supabase
                .from('deals')
                .insert({
                  title: `CS - ${Customer.full_name}`,
                  contact_id: matchingDeal.contact_id,
                  pipeline_id: csNovosPipeline.id,
                  stage_id: csFirstStage.id,
                  status: 'open',
                  value: kiwifyValue,
                  is_returning_customer: false,
                  lead_source: 'kiwify_novo_cliente',
                  product_id: productId,
                })
                .select()
                .single();

              if (csDeal) {
                console.log('[kiwify-webhook] ✅ Deal CS - Novos Clientes criado:', csDeal.id);
                csDealCreated = true;
              } else if (csDealError) {
                console.error('[kiwify-webhook] ⚠️ Erro ao criar deal CS:', csDealError.message);
              }
            }
          }
        } catch (csError) {
          console.error('[kiwify-webhook] ⚠️ Erro no fluxo CS:', csError);
          // Não bloqueia o fluxo principal
        }
      }

      // IMPORTANTE: Retornar aqui para não criar deal/contato duplicado
      return new Response(JSON.stringify({
        success: true,
        action: 'closed_organic',
        deal_id: matchingDeal.id,
        value: kiwifyValue,
        cs_deal_created: csDealCreated,
        message: `Deal sem vendedor fechado como venda orgânica: ${valueFormatted}`
      }), { status: 200, headers: corsHeaders });
    }
  }
  // FIM DO FECHAMENTO AUTOMÁTICO
  
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
  
  // 🔧 CORREÇÃO: Usar Subscription.plan.id como fonte principal de offer_id
  const subscriptionOfferId = payload.Subscription?.plan?.id;
  const subscriptionOfferName = payload.Subscription?.plan?.name;
  const productOfferId = Product.offer_id;
  
  console.log('[kiwify-webhook] 🔍 Buscando produto com:', {
    subscription_offer_id: subscriptionOfferId,
    subscription_offer_name: subscriptionOfferName,
    product_offer_id: productOfferId,
    product_id: Product.product_id
  });
  
  // PRIORIDADE 1: Buscar por Subscription.plan.id (fonte correta da Kiwify)
  if (subscriptionOfferId) {
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
      .eq('offer_id', subscriptionOfferId)
      .eq('is_active', true)
      .single();
    
    if (offerData) {
      offer = offerData;
      product = offerData.products;
      console.log('[kiwify-webhook] ✅ Produto encontrado via Subscription.plan.id:', subscriptionOfferId);
    }
  }
  
  // PRIORIDADE 2: Buscar por Product.offer_id (fallback legacy)
  if (!product && productOfferId) {
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
      .eq('offer_id', productOfferId)
      .eq('is_active', true)
      .single();
    
    if (offerData) {
      offer = offerData;
      product = offerData.products;
      console.log('[kiwify-webhook] ✅ Produto encontrado via Product.offer_id:', productOfferId);
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

  // 2.1 📧 Email de boas-vindas com link de primeiro acesso
  try {
    const customerFirstName = nameParts[0];
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://nexxoai.lovable.app';

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: Customer.email,
      options: {
        redirectTo: `${frontendUrl}/client-portal`
      }
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[kiwify-webhook] ⚠️ Failed to generate recovery link:', linkError);
    } else {
      const actionLink = linkData.properties.action_link;
      
      await supabase.functions.invoke('send-email', {
        body: {
          to: Customer.email,
          to_name: customerFirstName,
          subject: `✅ Seu acesso ao portal está pronto, ${customerFirstName}!`,
          html: `<h2>Olá, ${customerFirstName}!</h2>
<p>Sua compra do <strong>${Product.product_name}</strong> foi confirmada.</p>
<p>Criamos seu acesso ao portal do cliente onde você pode acompanhar seus tickets, devoluções e progresso do onboarding.</p>
<h3>Seus dados de acesso:</h3>
<ul>
  <li><strong>Login:</strong> ${Customer.email}</li>
  <li><strong>Produto:</strong> ${Product.product_name}</li>
  <li><strong>Senha:</strong> clique no botão abaixo para definir sua senha</li>
</ul>
<p style="text-align: center; margin: 30px 0;">
  <a href="${actionLink}" style="background-color: #2c5282; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Definir minha senha e acessar o portal →</a>
</p>
<p style="color: #888; font-size: 13px;">O link expira em 24 horas.</p>
<hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
<p style="color: #999; font-size: 12px; text-align: center;">© ${orgName} — Todos os direitos reservados</p>`,
          customer_id: contact.id,
          is_customer_email: true,
        }
      });

      console.log('[kiwify-webhook] ✅ Welcome email sent to:', Customer.email);
    }
  } catch (welcomeEmailErr) {
    console.error('[kiwify-webhook] ⚠️ Welcome email failed (non-blocking):', welcomeEmailErr);
  }

  // 2.5 🆕 CRIAR DEAL AUTOMATICAMENTE PARA VENDA DE NOVO CLIENTE
  const grossValue = Commissions.product_base_price / 100;
  const netValue = (Commissions.my_commission || Commissions.product_base_price) / 100;
  const kiwifyFee = (Commissions.kiwify_fee || 0) / 100;

  // Buscar pipeline padrão e última stage
  const { data: defaultPipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('is_default', true)
    .single();

  let organicDealId = null;

  if (defaultPipeline) {
    // Buscar última stage (Ganho) do pipeline padrão
    const { data: lastStage } = await supabase
      .from('stages')
      .select('id')
      .eq('pipeline_id', defaultPipeline.id)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    if (lastStage) {
      // Determinar se é venda orgânica ou de afiliado baseado na comissão
      const hasAffiliate = affiliateCommission > 0;
      const saleType = hasAffiliate ? 'Venda Afiliado' : 'Venda Orgânica';
      
      // Extrair offer_id do payload para cruzamento com product_offers
      const kiwifyOfferId = payload.Subscription?.plan?.id || payload.Product?.offer_id || null;
      
      // Criar deal e marcar como ganho imediatamente
      const { data: organicDeal, error: dealError } = await supabase
        .from('deals')
        .insert({
          title: `${saleType} - ${Product.product_name}`,
          contact_id: contact.id,
          pipeline_id: defaultPipeline.id,
          stage_id: lastStage.id,
          status: 'won',
          value: netValue,
          gross_value: grossValue,
          net_value: netValue,
          kiwify_fee: kiwifyFee,
          affiliate_commission: affiliateCommission,
          affiliate_name: affiliateName,
          affiliate_email: affiliateEmail,
          is_organic_sale: !hasAffiliate, // false se tem afiliado
          is_returning_customer: false,
          lead_source: 'kiwify_direto',
          closed_at: new Date().toISOString(),
          product_id: product?.id,
          kiwify_offer_id: kiwifyOfferId, // ✅ Para cruzamento com product_offers.source_type
        })
        .select()
        .single();

      if (dealError) {
        console.error('[kiwify-webhook] ❌ Erro ao criar deal orgânico:', dealError);
      } else if (organicDeal) {
        organicDealId = organicDeal.id;
        console.log('[kiwify-webhook] ✅ Deal orgânico criado e ganho:', organicDeal.id);

        // Vincular kiwify_event ao deal
        await supabase
          .from('kiwify_events')
          .update({ linked_deal_id: organicDeal.id })
          .eq('order_id', order_id)
          .is('linked_deal_id', null);
      }
    }
  }

  // ✅ Registrar venda na timeline do cliente
  await supabase
    .from('interactions')
    .insert({
      customer_id: contact.id,
      type: 'note',
      channel: 'other',
      content: `Venda Kiwify: ${Product.product_name} - Bruto: R$ ${grossValue.toFixed(2)}, Líquido: R$ ${netValue.toFixed(2)}`,
      metadata: {
        source: 'kiwify_organic',
        product_name: Product.product_name,
        product_id: Product.product_id,
        offer_id: Product.offer_id || null,
        gross_value: grossValue,
        net_value: netValue,
        kiwify_fee: kiwifyFee,
        affiliate_commission: affiliateCommission,
        affiliate_name: affiliateName,
        affiliate_email: affiliateEmail,
        order_id,
        deal_id: organicDealId,
      }
    });

  console.log('[kiwify-webhook] ✅ Venda orgânica com deal:', organicDealId, 'Bruto R$', grossValue.toFixed(2), 'Líquido R$', netValue.toFixed(2));

  // ============================================
  // 🆕 CRIAR DEAL EM CS - NOVOS CLIENTES
  // Para acompanhamento do time de Customer Success
  // ============================================
  let csDealId = null;
  
  const { data: csNovosPipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('name', 'CS - Novos Clientes')
    .single();

  if (csNovosPipeline) {
    // Buscar primeira stage (Onboarding)
    const { data: csFirstStage } = await supabase
      .from('stages')
      .select('id')
      .eq('pipeline_id', csNovosPipeline.id)
      .order('position', { ascending: true })
      .limit(1)
      .single();

    if (csFirstStage) {
      const { data: csDeal, error: csDealError } = await supabase
        .from('deals')
        .insert({
          title: `CS - ${Customer.full_name}`,
          contact_id: contact.id,
          pipeline_id: csNovosPipeline.id,
          stage_id: csFirstStage.id,
          status: 'open', // Aberto para CS acompanhar
          value: netValue,
          is_returning_customer: false,
          lead_source: 'kiwify_novo_cliente',
          product_id: product?.id,
        })
        .select()
        .single();

      if (csDealError) {
        console.error('[kiwify-webhook] ❌ Erro ao criar deal CS - Novos Clientes:', csDealError);
      } else if (csDeal) {
        csDealId = csDeal.id;
        console.log('[kiwify-webhook] ✅ Deal CS - Novos Clientes criado:', csDeal.id);
      }
    } else {
      console.warn('[kiwify-webhook] ⚠️ Nenhuma stage encontrada no pipeline CS - Novos Clientes');
    }
  } else {
    console.warn('[kiwify-webhook] ⚠️ Pipeline CS - Novos Clientes não encontrado');
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

  // FALLBACK 3: Buscar via playbook_products (tabela de vínculo direto)
  if (playbook_ids.length === 0 && product) {
    console.log('[kiwify-webhook] 🔍 Tentando fallback playbook_products para produto:', product.id);
    const { data: linkedPlaybooks } = await supabase
      .from('playbook_products')
      .select('playbook_id, playbook:onboarding_playbooks(id, is_active)')
      .eq('product_id', product.id);
    
    if (linkedPlaybooks && linkedPlaybooks.length > 0) {
      playbook_ids = linkedPlaybooks
        .filter((lp: any) => lp.playbook?.is_active)
        .map((lp: any) => lp.playbook_id);
      console.log(`[kiwify-webhook] ✅ Encontrados ${playbook_ids.length} playbook(s) via playbook_products`);
    }
  }

  // ============================================
  // 🆕 KANBAN CARD AUTO-CREATION
  // Check if product has mapping to create card automatically
  // ============================================
  let createdCardId: string | null = null;
  
  if (product) {
    const { data: boardMapping } = await supabase
      .from('product_board_mappings')
      .select(`
        *,
        board:project_boards(id, name),
        initial_column:project_columns!product_board_mappings_initial_column_id_fkey(id, name),
        form:forms(id, name)
      `)
      .eq('product_id', product.id)
      .eq('is_active', true)
      .single();

    if (boardMapping) {
      console.log(`[kiwify-webhook] 📋 Found board mapping for product ${product.name} -> board ${boardMapping.board?.name}`);
      
      // Calculate next position in initial column
      const { data: existingCards } = await supabase
        .from('project_cards')
        .select('position')
        .eq('column_id', boardMapping.initial_column_id)
        .order('position', { ascending: false })
        .limit(1);
      const nextPosition = (existingCards?.[0]?.position ?? -1) + 1;

      // Create card in Kanban
      const cardDescription = `**Cliente:** ${Customer.full_name}
**Email:** ${Customer.email}
**Telefone:** ${Customer.mobile || Customer.mobile_phone || Customer.phone || 'Não informado'}
**Produto:** ${Product.product_name}
**Pedido Kiwify:** ${order_id}
**Valor:** R$ ${grossValue.toFixed(2)}

⏳ Aguardando preenchimento do formulário`;

      const { data: newCard, error: cardError } = await supabase
        .from('project_cards')
        .insert({
          board_id: boardMapping.board_id,
          column_id: boardMapping.initial_column_id,
          title: `${Customer.full_name} - ${Product.product_name}`,
          description: cardDescription,
          priority: 'high',
          contact_id: contact.id,
          kiwify_order_id: order_id,
          position: nextPosition,
        })
        .select()
        .single();

      if (cardError) {
        console.error('[kiwify-webhook] ❌ Error creating kanban card:', cardError);
      } else if (newCard) {
        createdCardId = newCard.id;
        console.log(`[kiwify-webhook] ✅ Kanban card created: ${newCard.id}`);

        // Assign user if configured
        if (boardMapping.auto_assign_user_id) {
          await supabase.from('project_card_assignees').insert({
            card_id: newCard.id,
            user_id: boardMapping.auto_assign_user_id,
          });
          console.log(`[kiwify-webhook] 👤 Card assigned to user: ${boardMapping.auto_assign_user_id}`);
        }

        // Send welcome email with form link if configured
        if (boardMapping.send_welcome_email && boardMapping.form_id && boardMapping.form) {
          // forms table doesn't have short_code column - use form_id directly
          const formShortCode = boardMapping.form_id;
          const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
          // Extract project ref from URL (between https:// and .supabase.co)
          const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/)?.[1] || '';
          const appBaseUrl = `https://${projectRef}.lovableproject.com`;
          const formUrl = `${appBaseUrl}/f/${formShortCode}`;

          try {
            // Get email template if configured
            let emailSubject = `Próximos passos: ${Product.product_name}`;
            let emailHtml = `
              <p>Olá ${Customer.full_name},</p>
              <p>Obrigado pela sua compra de <strong>${Product.product_name}</strong>!</p>
              <p>Para dar continuidade ao seu projeto, por favor preencha o formulário abaixo com as informações necessárias:</p>
              <p style="margin: 24px 0;">
                <a href="${formUrl}" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Preencher Formulário
                </a>
              </p>
              <p>Se o botão não funcionar, copie e cole este link no navegador:</p>
              <p>${formUrl}</p>
              <p>Obrigado!</p>
            `;

            if (boardMapping.email_template_id) {
              const { data: template } = await supabase
                .from('email_templates')
                .select('subject, html_body')
                .eq('id', boardMapping.email_template_id)
                .single();

              if (template) {
                emailSubject = template.subject
                  .replace(/\{\{customer_name\}\}/g, Customer.full_name)
                  .replace(/\{\{product_name\}\}/g, Product.product_name)
                  .replace(/\{\{form_url\}\}/g, formUrl);
                emailHtml = template.html_body
                  .replace(/\{\{customer_name\}\}/g, Customer.full_name)
                  .replace(/\{\{product_name\}\}/g, Product.product_name)
                  .replace(/\{\{form_url\}\}/g, formUrl);
              }
            }

            await supabase.functions.invoke('send-email', {
              body: {
                to: Customer.email,
                to_name: Customer.full_name,
                subject: emailSubject,
                html: emailHtml,
                customer_id: contact.id,
                is_customer_email: true,
              },
            });
            console.log(`[kiwify-webhook] 📧 Welcome email sent with form link: ${formUrl}`);
          } catch (emailError) {
            console.error('[kiwify-webhook] ❌ Failed to send welcome email:', emailError);
          }
        }
      }
    }
  }

  // 4. 🎯 Iniciar TODOS os Playbooks (CORRIGIDO - com fila)
  const started_executions: string[] = [];
  for (const playbook_id of playbook_ids) {
    const execution_id = await initiatePlaybook(supabase, playbook_id, contact.id);
    if (execution_id) {
      started_executions.push(execution_id);
    }
  }
  
  console.log(`[kiwify-webhook] 🎯 ${started_executions.length}/${playbook_ids.length} playbook(s) iniciado(s) corretamente`);

  // 5. Registrar interação na timeline
  await supabase
    .from('interactions')
    .insert({
      customer_id: contact.id,
      type: 'note',
      channel: 'other',
      content: `✅ Venda aprovada via Kiwify: ${Product.product_name} (Novo Cliente)${createdCardId ? ' - Card criado no Kanban' : ''}`,
      metadata: {
        product: Product.product_name,
        product_id: Product.product_id,
        offer_id: Product.offer_id || null,
        offer_name: offer?.offer_name || null,
        value: Commissions.product_base_price,
        order_id,
        kiwify_customer_id: Customer.id,
        new_customer: true,
        kanban_card_id: createdCardId
      }
    });

  // 📧 DISPARO AUTOMÁTICO DE EMAIL: order_paid (primeiro compra)
  await sendTriggeredEmail(supabase, 'order_paid', contact.id, Customer.email, {
    CUSTOMER_FIRST_NAME: Customer.full_name?.split(' ')[0] || '',
    CUSTOMER_FULL_NAME: Customer.full_name || '',
    CUSTOMER_EMAIL: Customer.email,
    PRODUCT_NAME: Product.product_name,
    ORDER_VALUE: netValue,
    ORDER_ID: order_id,
    CUSTOMER_LTV: netValue,
  });

  return {
    success: true,
    action: 'new_customer_onboarding',
    contact_id: contact.id,
    sale_gross_value: grossValue,
    sale_net_value: netValue,
    playbook_ids,
    playbooks_count: playbook_ids.length,
    kanban_card_id: createdCardId,
    message: `Novo cliente criado (venda orgânica R$ ${netValue.toFixed(2)}), Auth configurado, ${playbook_ids.length} playbook(s) iniciado(s)${createdCardId ? ', card Kanban criado' : ''}`
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

  // 2.5 🆕 CRIAR DEAL NO PIPELINE CS - RECORRÊNCIA
  // Buscar Pipeline CS - Recorrência
  const { data: recurrencePipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('name', 'CS - Recorrência')
    .single();

  let upsellDealId = null;

  if (recurrencePipeline) {
    // Buscar stage "Ganho" do pipeline de recorrência
    const { data: recurrenceStage } = await supabase
      .from('stages')
      .select('id')
      .eq('pipeline_id', recurrencePipeline.id)
      .eq('name', 'Ganho')
      .single();

    if (recurrenceStage) {
      // Determinar se é venda orgânica ou de afiliado
      const hasUpsellAffiliate = upsellAffiliateCommission > 0;
      const upsellSaleType = hasUpsellAffiliate ? 'Afiliado' : 'Orgânica';
      
      // Extrair offer_id do Product para cruzamento com product_offers
      const upsellOfferId = Product.offer_id || null;
      
      // Criar deal e marcar como ganho imediatamente no Pipeline de Recorrência
      const { data: upsellDeal, error: dealError } = await supabase
        .from('deals')
        .insert({
          title: `Recorrência ${upsellSaleType} - ${Product.product_name}`,
          contact_id: existingContact.id,
          pipeline_id: recurrencePipeline.id,
          stage_id: recurrenceStage.id,
          status: 'won',
          value: netValue,
          gross_value: grossValue,
          net_value: netValue,
          kiwify_fee: kiwifyFee,
          affiliate_commission: upsellAffiliateCommission,
          affiliate_name: upsellAffiliateName,
          affiliate_email: upsellAffiliateEmail,
          is_organic_sale: !hasUpsellAffiliate, // false se tem afiliado
          is_returning_customer: true,
          lead_source: 'kiwify_recorrencia',
          closed_at: new Date().toISOString(),
          kiwify_offer_id: upsellOfferId, // ✅ Para cruzamento com product_offers.source_type
        })
        .select()
        .single();

      if (dealError) {
        console.error('[kiwify-webhook] ❌ Erro ao criar deal de recorrência:', dealError);
      } else if (upsellDeal) {
        upsellDealId = upsellDeal.id;
        console.log('[kiwify-webhook] ✅ Deal de recorrência criado e ganho:', upsellDeal.id);

        // Vincular kiwify_event ao deal
        await supabase
          .from('kiwify_events')
          .update({ linked_deal_id: upsellDeal.id })
          .eq('order_id', order_id)
          .is('linked_deal_id', null);
      }
    }
  } else {
    console.warn('[kiwify-webhook] ⚠️ Pipeline de Recorrência não encontrado, upsell sem deal');
  }

  // ✅ Registrar upsell na timeline do cliente
  await supabase
    .from('interactions')
    .insert({
      customer_id: existingContact.id,
      type: 'note',
      channel: 'other',
      content: `Upsell Kiwify: ${Product.product_name} - Bruto: R$ ${grossValue.toFixed(2)}, Líquido: R$ ${netValue.toFixed(2)}`,
      metadata: {
        source: 'kiwify_recorrencia',
        product_name: Product.product_name,
        product_id: Product.product_id,
        gross_value: grossValue,
        net_value: netValue,
        kiwify_fee: kiwifyFee,
        affiliate_commission: upsellAffiliateCommission,
        affiliate_name: upsellAffiliateName,
        affiliate_email: upsellAffiliateEmail,
        deal_id: upsellDealId,
      }
    });

  console.log('[kiwify-webhook] ✅ Upsell com deal:', upsellDealId, 'Bruto R$', grossValue.toFixed(2), 'Líquido R$', netValue.toFixed(2));

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
        
        const started_upsell_executions: string[] = [];
        for (const playbook_id of playbook_ids) {
          const execution_id = await initiatePlaybook(supabase, playbook_id, existingContact.id);
          if (execution_id) {
            started_upsell_executions.push(execution_id);
          }
        }
        
        console.log(`[kiwify-webhook] 🎯 ${started_upsell_executions.length}/${playbook_ids.length} playbook(s) de upsell iniciado(s)`);
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
        const fallback_exec_id = await initiatePlaybook(supabase, playbook.id, existingContact.id);
        
        console.log('[kiwify-webhook] 🎯 Playbook de upsell iniciado (sem login):', fallback_exec_id || 'falhou');
      }
    }

    // FALLBACK 3: Buscar via playbook_products (tabela de vínculo direto)
    if (playbook_ids.length === 0) {
      console.log('[kiwify-webhook] 🔍 [UPSELL] Tentando fallback playbook_products para produto:', product.id);
      const { data: linkedPlaybooks } = await supabase
        .from('playbook_products')
        .select('playbook_id, playbook:onboarding_playbooks(id, is_active)')
        .eq('product_id', product.id);
      
      if (linkedPlaybooks && linkedPlaybooks.length > 0) {
        playbook_ids = linkedPlaybooks
          .filter((lp: any) => lp.playbook?.is_active)
          .map((lp: any) => lp.playbook_id);
        
        const started_upsell_executions: string[] = [];
        for (const playbook_id of playbook_ids) {
          const execution_id = await initiatePlaybook(supabase, playbook_id, existingContact.id);
          if (execution_id) {
            started_upsell_executions.push(execution_id);
          }
        }
        console.log(`[kiwify-webhook] ✅ [UPSELL] ${started_upsell_executions.length}/${playbook_ids.length} playbook(s) via playbook_products`);
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

  // 📧 DISPARO AUTOMÁTICO DE EMAIL: upsell_paid
  await sendTriggeredEmail(supabase, 'upsell_paid', existingContact.id, Customer.email, {
    CUSTOMER_FIRST_NAME: Customer.full_name?.split(' ')[0] || existingContact.first_name || '',
    CUSTOMER_FULL_NAME: Customer.full_name || '',
    CUSTOMER_EMAIL: Customer.email,
    PRODUCT_NAME: Product.product_name,
    ORDER_VALUE: netValue,
    ORDER_ID: order_id,
    CUSTOMER_LTV: newLtv,
  });

  return {
    success: true,
    action: 'upsell_processed',
    contact_id: existingContact.id,
    sale_gross_value: grossValue,
    sale_net_value: netValue,
    new_ltv: newLtv,
    playbook_ids,
    playbooks_count: playbook_ids.length,
    consultant_notified: !!existingContact.consultant_id,
    message: `Upsell orgânico registrado (R$ ${netValue.toFixed(2)}), LTV atualizado, ${playbook_ids.length} playbook(s) iniciado(s)`
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
  Commissions: KiwifyCommissions,
  payload: KiwifyWebhookPayload
) {
  console.log('[kiwify-webhook] 🔄 RENOVAÇÃO:', Customer.email);

  // 1. Find existing customer with consultant info
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, total_ltv, consultant_id, first_name, last_name')
    .eq('email', Customer.email)
    .single();

  if (!contact) {
    console.warn('[kiwify-webhook] Customer not found for renewal, treating as new order');
    return handlePaidOrder(supabase, Customer, Product, Commissions, 'renewal-fallback', payload);
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

  // 📧 DISPARO AUTOMÁTICO DE EMAIL: subscription_renewed
  await sendTriggeredEmail(supabase, 'subscription_renewed', contact.id, Customer.email, {
    CUSTOMER_FIRST_NAME: contact.first_name || Customer.full_name?.split(' ')[0] || '',
    CUSTOMER_FULL_NAME: `${contact.first_name} ${contact.last_name}`.trim() || Customer.full_name || '',
    CUSTOMER_EMAIL: Customer.email,
    PRODUCT_NAME: Product.product_name,
    ORDER_VALUE: renewalValue,
    CUSTOMER_LTV: newLtv,
  });

  // ============================================
  // 🆕 CRIAR DEAL EM CS - RECORRÊNCIA
  // Para acompanhamento de renovações pelo time de CS
  // ============================================
  let csRenewalDealId = null;

  const { data: csRecurrencePipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('name', 'CS - Recorrência')
    .single();

  if (csRecurrencePipeline) {
    // Buscar stage "Ganho" do pipeline CS - Recorrência
    const { data: csWonStage } = await supabase
      .from('stages')
      .select('id')
      .eq('pipeline_id', csRecurrencePipeline.id)
      .eq('name', 'Ganho')
      .single();

    if (csWonStage) {
      const { data: csRenewalDeal, error: csRenewalError } = await supabase
        .from('deals')
        .insert({
          title: `Renovação - ${Product.product_name}`,
          contact_id: contact.id,
          pipeline_id: csRecurrencePipeline.id,
          stage_id: csWonStage.id,
          status: 'won',
          value: renewalValue,
          is_returning_customer: true,
          is_organic_sale: true, // Renovação automática
          lead_source: 'kiwify_renovacao',
          closed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (csRenewalError) {
        console.error('[kiwify-webhook] ❌ Erro ao criar deal CS - Recorrência:', csRenewalError);
      } else if (csRenewalDeal) {
        csRenewalDealId = csRenewalDeal.id;
        console.log('[kiwify-webhook] ✅ Deal CS - Recorrência criado:', csRenewalDeal.id);
      }
    } else {
      console.warn('[kiwify-webhook] ⚠️ Stage "Ganho" não encontrada no pipeline CS - Recorrência');
    }
  } else {
    console.warn('[kiwify-webhook] ⚠️ Pipeline CS - Recorrência não encontrado');
  }

  // 4. Notify consultant about renewal
  if (contact.consultant_id) {
    const renewalValueFormatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(renewalValue);
    
    const newLtvFormatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(newLtv);

    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: contact.consultant_id,
      type: 'subscription_renewal',
      title: '🔄 Cliente Renovou!',
      message: `${contact.first_name} ${contact.last_name} renovou ${Product.product_name} (${renewalValueFormatted}). Novo LTV: ${newLtvFormatted}`,
      metadata: {
        contact_id: contact.id,
        contact_name: `${contact.first_name} ${contact.last_name}`,
        product_name: Product.product_name,
        renewal_value: renewalValue,
        new_ltv: newLtv,
        cs_deal_id: csRenewalDealId,
        action_url: csRenewalDealId ? `/deals?deal=${csRenewalDealId}` : '/deals',
      },
      read: false
    });

    if (notifError) {
      console.error('[kiwify-webhook] ❌ Failed to notify consultant:', notifError);
    } else {
      console.log('[kiwify-webhook] 🔔 Consultant notified:', contact.consultant_id);
    }
  }

  return {
    success: true,
    action: 'ltv_updated',
    new_ltv: newLtv,
    contact_id: contact.id,
    cs_deal_id: csRenewalDealId,
    message: `Renovação processada, LTV atualizado${csRenewalDealId ? ', deal CS - Recorrência criado' : ''}`
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

  // 4. Buscar stage "Oportunidade" no Pipeline de Vendas Nacional (padrão)
  const { data: targetPipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('is_default', true)
    .single();

  if (!targetPipeline) {
    throw new Error('Pipeline padrão não encontrado no sistema');
  }

  const { data: recoveryStage } = await supabase
    .from('stages')
    .select('id, pipeline_id')
    .eq('name', 'Oportunidade')
    .eq('pipeline_id', targetPipeline.id)
    .single();

  if (!recoveryStage) {
    throw new Error('Stage "Oportunidade" não encontrada no pipeline padrão');
  }

  // 5. Distribuir para sales_rep online (Round Robin) - APENAS entre membros da equipe do pipeline
  const { data: salesRepId } = await supabase.rpc('get_least_loaded_sales_rep_for_pipeline', { 
    p_pipeline_id: targetPipeline.id 
  });

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

  // 📧 DISPARO AUTOMÁTICO DE EMAIL: cart_abandoned ou payment_refused
  const emailTrigger = order_status === 'cart_abandoned' ? 'cart_abandoned' : 'payment_refused';
  await sendTriggeredEmail(supabase, emailTrigger, contact.id, Customer.email, {
    CUSTOMER_FIRST_NAME: Customer.full_name?.split(' ')[0] || '',
    CUSTOMER_FULL_NAME: Customer.full_name || '',
    CUSTOMER_EMAIL: Customer.email,
    PRODUCT_NAME: Product.product_name,
    ORDER_VALUE: grossValue,
    ORDER_ID: order_id,
    RECOVERY_LINK: '', // TODO: Adicionar link de recuperação quando disponível
    PAYMENT_REASON: order_status === 'refused' ? 'Cartão recusado' : 'Carrinho abandonado',
  });

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

  // 2. Buscar stage "Oportunidade" no Pipeline de Vendas Nacional (padrão)
  const { data: targetPipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('is_default', true)
    .single();

  if (!targetPipeline) {
    console.error('[kiwify-webhook] Pipeline padrão não encontrado');
    return {
      success: false,
      error: 'Pipeline not found',
      message: 'Pipeline padrão não encontrado'
    };
  }

  const { data: cobrancaStage } = await supabase
    .from('stages')
    .select('id, pipeline_id')
    .eq('name', 'Oportunidade')
    .eq('pipeline_id', targetPipeline.id)
    .single();

  if (!cobrancaStage) {
    console.error('[kiwify-webhook] Stage Oportunidade não encontrada no pipeline padrão');
    return {
      success: false,
      error: 'Stage not found',
      message: 'Stage "Oportunidade" não encontrada no pipeline padrão'
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

  // 📧 DISPARO AUTOMÁTICO DE EMAIL: subscription_late ou subscription_card_declined
  const overdueTrigger = order_status === 'subscription_late' ? 'subscription_late' : 'subscription_card_declined';
  await sendTriggeredEmail(supabase, overdueTrigger, contact.id, Customer.email, {
    CUSTOMER_FIRST_NAME: Customer.full_name?.split(' ')[0] || '',
    CUSTOMER_FULL_NAME: Customer.full_name || '',
    CUSTOMER_EMAIL: Customer.email,
    PRODUCT_NAME: Product.product_name,
    SUBSCRIPTION_DAYS_LATE: 0, // TODO: Calcular dias em atraso se disponível
    PAYMENT_REASON: statusMessage,
  });

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
  // IDEMPOTENCY: Check if Winback deal already exists for this contact
  const { data: existingWinbackDeal } = await supabase
    .from('deals')
    .select('id')
    .eq('contact_id', contact.id)
    .eq('status', 'open')
    .ilike('title', 'Winback%')
    .limit(1)
    .maybeSingle();

  let deal_id = null;

  if (existingWinbackDeal) {
    deal_id = existingWinbackDeal.id;
    console.log('[kiwify-webhook] ⚠️ Winback deal already exists, skipping creation:', deal_id);
  } else {
    // Buscar stage "Oportunidade" no Pipeline de Vendas Nacional (padrão)
    const { data: targetPipeline } = await supabase
      .from('pipelines')
      .select('id')
      .eq('is_default', true)
      .single();

    const { data: winbackStage } = targetPipeline ? await supabase
      .from('stages')
      .select('id, pipeline_id')
      .eq('name', 'Oportunidade')
      .eq('pipeline_id', targetPipeline.id)
      .single() : { data: null };

    if (winbackStage) {
      // 🆕 ROUND-ROBIN: Distribuir para vendedor da EQUIPE DO PIPELINE apenas
      const { data: salesRepId } = await supabase.rpc('get_least_loaded_sales_rep_for_pipeline', {
        p_pipeline_id: targetPipeline.id
      });
      console.log('[kiwify-webhook] 🔄 Winback assigned to sales rep:', salesRepId);

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
          assigned_to: salesRepId, // 🆕 Distribuição automática
        })
        .select()
        .single();

      deal_id = deal?.id;
      console.log('[kiwify-webhook] 🔄 Winback deal created:', deal_id);
    }
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

  // 📧 DISPARO AUTOMÁTICO DE EMAIL: refunded ou churned
  const churnTrigger = order_status === 'refunded' ? 'refunded' : 'churned';
  await sendTriggeredEmail(supabase, churnTrigger, contact.id, Customer.email, {
    CUSTOMER_FIRST_NAME: Customer.full_name?.split(' ')[0] || '',
    CUSTOMER_FULL_NAME: Customer.full_name || '',
    CUSTOMER_EMAIL: Customer.email,
    PRODUCT_NAME: Product.product_name,
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
