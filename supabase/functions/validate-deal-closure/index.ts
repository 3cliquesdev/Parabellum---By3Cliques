import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateRequest {
  deal_id: string;
  kiwify_order_ref: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { deal_id, kiwify_order_ref }: ValidateRequest = await req.json();

    console.log(`[validate-deal-closure] Validating order_ref: ${kiwify_order_ref} for deal: ${deal_id}`);

    if (!deal_id || !kiwify_order_ref) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'ID do negócio e ID da transação Kiwify são obrigatórios.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Buscar transação pelo order_ref (payload->>'order_ref')
    const { data: transactions, error: searchError } = await supabase
      .from('kiwify_events')
      .select('*')
      .eq('payload->>order_ref', kiwify_order_ref.trim());

    if (searchError) {
      console.error('[validate-deal-closure] Search error:', searchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao buscar transação. Tente novamente.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verificar se transação existe
    if (!transactions || transactions.length === 0) {
      console.log(`[validate-deal-closure] Transaction not found: ${kiwify_order_ref}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Transação não encontrada. Verifique o ID da Kiwify.' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transaction = transactions[0];
    const payload = transaction.payload as Record<string, any>;

    // 3. Verificar se status é 'paid' ou 'order_approved'
    const validStatuses = ['paid', 'order_approved'];
    if (!validStatuses.includes(transaction.event_type)) {
      console.log(`[validate-deal-closure] Invalid status: ${transaction.event_type}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `O status da transação é '${transaction.event_type}', não é 'pago'.` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Verificar se já está vinculada a outro deal
    if (transaction.linked_deal_id && transaction.linked_deal_id !== deal_id) {
      // Buscar info do deal vinculado
      const { data: linkedDeal } = await supabase
        .from('deals')
        .select('title')
        .eq('id', transaction.linked_deal_id)
        .single();

      const dealTitle = linkedDeal?.title || transaction.linked_deal_id;
      console.log(`[validate-deal-closure] Transaction already linked to: ${dealTitle}`);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Esta transação já foi vinculada ao negócio "${dealTitle}".` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Extrair dados da transação
    const customer = payload?.Customer || {};
    const product = payload?.Product || {};
    const commissions = payload?.Commissions || {};
    
    // Valor: usar my_commission (líquido) ou product_base_price (bruto)
    const transactionValue = (commissions.my_commission || payload.product_base_price || 0) / 100;
    const grossValue = (payload.product_base_price || 0) / 100;
    const customerEmail = customer.email || transaction.customer_email || '';
    const customerName = customer.full_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    const productName = product.product_name || 'Produto Kiwify';

    // 6. Vincular transação ao deal
    const { error: linkError } = await supabase
      .from('kiwify_events')
      .update({ linked_deal_id: deal_id })
      .eq('id', transaction.id);

    if (linkError) {
      console.error('[validate-deal-closure] Link error:', linkError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao vincular transação. Tente novamente.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[validate-deal-closure] Successfully validated and linked. Value: ${transactionValue}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          transaction_id: transaction.id,
          order_ref: kiwify_order_ref,
          value: transactionValue,
          gross_value: grossValue,
          customer_email: customerEmail,
          customer_name: customerName,
          product_name: productName,
          event_type: transaction.event_type,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[validate-deal-closure] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erro interno do servidor.' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});