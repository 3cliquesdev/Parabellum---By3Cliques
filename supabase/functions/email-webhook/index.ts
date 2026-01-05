import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET_TRACKING') || Deno.env.get('RESEND_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('[email-webhook] RESEND_WEBHOOK_SECRET_TRACKING not configured');
      throw new Error('Webhook secret not configured');
    }

    // Verificar assinatura do webhook (Resend usa Svix)
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error('[email-webhook] Missing Svix headers');
      throw new Error('Missing webhook signature headers');
    }

    const body = await req.text();
    const signedContent = `${svixId}.${svixTimestamp}.${body}`;
    
    // Verificar assinatura usando Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(webhookSecret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureData = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signedContent)
    );
    
    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureData)));

    const signatures = svixSignature.split(' ');
    const versionedSignatures = signatures.filter(sig => sig.startsWith('v1,'));
    
    if (versionedSignatures.length === 0) {
      console.error('[email-webhook] No v1 signature found');
      throw new Error('Invalid signature version');
    }

    const providedSignature = versionedSignatures[0].replace('v1,', '');
    
    if (providedSignature !== expectedSignature) {
      console.error('[email-webhook] Signature verification failed');
      throw new Error('Invalid webhook signature');
    }

    console.log('[email-webhook] Signature verified successfully');

    const payload = JSON.parse(body);
    const eventType = payload.type;

    console.log('[email-webhook] Event received:', eventType, payload);

    // Processar apenas eventos email.opened e email.clicked
    if (eventType !== 'email.opened' && eventType !== 'email.clicked') {
      console.log('[email-webhook] Ignoring event type:', eventType);
      return new Response(
        JSON.stringify({ message: 'Event ignored' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const emailId = payload.data.email_id;
    
    // Buscar customer_id pela tag do email no Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const emailResponse = await fetch(`https://api.resend.com/emails/${emailId}`, {
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
      },
    });

    if (!emailResponse.ok) {
      console.error('[email-webhook] Error fetching email from Resend');
      throw new Error('Failed to fetch email details');
    }

    const emailData = await emailResponse.json();
    const customerTag = emailData.tags?.find((tag: any) => tag.name === 'customer_id');
    
    if (!customerTag) {
      console.error('[email-webhook] No customer_id tag found in email');
      throw new Error('Customer ID not found in email tags');
    }

    const customerId = customerTag.value;
    console.log('[email-webhook] Customer ID found:', customerId);

    // Registrar interação no Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let interactionType: 'email_open' | 'email_click';
    let content: string;
    let metadata: any;

    if (eventType === 'email.opened') {
      interactionType = 'email_open';
      content = 'Email foi aberto pelo destinatário';
      metadata = {
        email_id: emailId,
        opened_at: payload.created_at,
      };
    } else {
      interactionType = 'email_click';
      content = `Link clicado: ${payload.data.click?.link || 'unknown'}`;
      metadata = {
        email_id: emailId,
        clicked_url: payload.data.click?.link,
        clicked_at: payload.created_at,
      };
    }

    const { error: interactionError } = await supabase
      .from('interactions')
      .insert({
        customer_id: customerId,
        type: interactionType,
        content,
        channel: 'email',
        metadata,
      });

    if (interactionError) {
      console.error('[email-webhook] Error inserting interaction:', interactionError);
      throw interactionError;
    }

    console.log('[email-webhook] Interaction registered successfully:', interactionType);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `${eventType} processed successfully`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[email-webhook] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});