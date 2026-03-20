import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendQuoteEmailRequest {
  quote_id: string;
  frontend_url: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { quote_id, frontend_url }: SendQuoteEmailRequest = await req.json();

    console.log('[send-quote-email] Processing quote:', quote_id);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resolver nome da organização dinamicamente
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('name')
      .limit(1)
      .maybeSingle();
    const ORG_NAME = orgRow?.name || 'Sua Empresa';

    // Fetch quote with all related data
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select(`
        *,
        deals:deal_id(id, title),
        contacts:contact_id(id, first_name, last_name, email, company),
        items:quote_items(
          id,
          quantity,
          unit_price,
          discount_percentage,
          products:product_id(name, description)
        )
      `)
      .eq('id', quote_id)
      .single();

    if (quoteError || !quote) {
      console.error('[send-quote-email] Quote not found:', quoteError);
      throw new Error('Quote not found');
    }

    const contact = quote.contacts as any;
    if (!contact?.email) {
      throw new Error('Contact email not found');
    }

    // Generate public link
    const publicLink = `${frontend_url}/public-quote/${quote.signature_token}`;

    // Calculate totals
    const items = quote.items as any[] || [];
    const subtotal = items.reduce((sum, item) => 
      sum + (item.quantity * item.unit_price), 0
    );
    const totalDiscount = items.reduce((sum, item) => 
      sum + (item.quantity * item.unit_price * (item.discount_percentage / 100)), 0
    );
    const total = subtotal - totalDiscount;

    // Build items HTML
    const itemsHtml = items.map(item => {
      const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percentage / 100);
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.products?.name || 'Produto'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">R$ ${item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.discount_percentage}%</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">R$ ${itemTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');

    // Build email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold;">Seu Armazém Drop</h1>
        </div>
        <div style="background: #2563EB; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Nova Proposta Comercial</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Proposta #${quote.quote_number}</p>
        </div>

        <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; margin-bottom: 20px;">
            Olá <strong>${contact.first_name}</strong>,
          </p>

          <p style="margin-bottom: 20px;">
            Temos o prazer de enviar nossa proposta comercial para sua análise. 
            Preparamos uma oferta especial pensando nas suas necessidades.
          </p>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 25px 0; border: 2px solid #2563EB;">
            <h3 style="margin-top: 0; color: #2563EB;">Resumo da Proposta</h3>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #2563EB;">Produto</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 2px solid #2563EB;">Qtd</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 2px solid #2563EB;">Preço</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 2px solid #2563EB;">Desc.</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 2px solid #2563EB;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div style="border-top: 2px solid #e5e7eb; padding-top: 15px; margin-top: 15px;">
              <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                <span>Subtotal:</span>
                <span>R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              ${totalDiscount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin: 8px 0; color: #059669;">
                  <span>Desconto Total:</span>
                  <span>- R$ ${totalDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; margin: 15px 0 0 0; padding-top: 15px; border-top: 2px solid #2563EB; font-size: 24px; font-weight: bold; color: #2563EB;">
                <span>Total:</span>
                <span>R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${publicLink}" style="display: inline-block; background: #2563EB; color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Visualizar Proposta Completa
            </a>
          </div>

          ${quote.expiration_date ? `
            <p style="text-align: center; color: #dc2626; font-weight: bold; margin: 20px 0; padding: 15px; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;">
              Proposta válida até: ${new Date(quote.expiration_date).toLocaleDateString('pt-BR')}
            </p>
          ` : ''}

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 5px 0; font-size: 14px; color: #6b7280;">
              Para aceitar ou recusar esta proposta, clique no botão acima e assine digitalmente.
            </p>
            <p style="margin: 15px 0 5px 0; font-size: 14px; color: #6b7280;">
              Dúvidas? Estamos à disposição!
            </p>
          </div>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #1e3a5f;">
          <tr>
            <td align="center" style="padding: 25px;">
              <p style="color: #ffffff; margin: 0 0 10px 0; font-size: 24px; font-weight: bold;">
                Seu Armazém Drop
              </p>
              <p style="color: #94a3b8; margin: 0 0 5px 0; font-size: 12px;">
                Equipe Comercial
              </p>
              <p style="color: #64748b; margin: 0; font-size: 11px;">
                Ambiente Seguro
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Send email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    console.log('[send-quote-email] Sending email to:', contact.email);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: '3Cliques Comercial <contato@mail.3cliques.net>',
        to: [contact.email],
        subject: `Proposta Comercial #${quote.quote_number} - ${contact.company || contact.first_name}`,
        html: emailHtml,
        tags: [
          { name: 'type', value: 'quote' },
          { name: 'quote_id', value: quote_id }
        ]
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text();
      console.error('[send-quote-email] Resend error:', errorData);
      throw new Error(`Resend API error: ${errorData}`);
    }

    const resendData = await resendResponse.json();
    console.log('[send-quote-email] Email sent successfully:', resendData);

    // Update quote status to 'sent'
    const { error: updateError } = await supabase
      .from('quotes')
      .update({ status: 'sent' })
      .eq('id', quote_id);

    if (updateError) {
      console.error('[send-quote-email] Error updating quote status:', updateError);
    }

    // Log interaction
    await supabase
      .from('interactions')
      .insert({
        customer_id: quote.contact_id,
        type: 'email_sent',
        content: `Proposta comercial #${quote.quote_number} enviada`,
        channel: 'email',
        metadata: {
          quote_id,
          email_id: resendData.id,
          public_link: publicLink,
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: resendData.id,
        public_link: publicLink,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[send-quote-email] Error:', error);
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
