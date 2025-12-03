import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendEmailRequest {
  to: string;
  to_name: string;
  subject: string;
  html: string;
  customer_id: string;
  playbook_execution_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, to_name, subject, html, customer_id, playbook_execution_id }: SendEmailRequest = await req.json();

    console.log('[send-email] Request received:', { to, subject, customer_id, playbook_execution_id });

    // Validação
    if (!to || !subject || !html || !customer_id) {
      console.error('[send-email] Missing fields:', { to: !!to, subject: !!subject, html: !!html, customer_id: !!customer_id });
      throw new Error('Missing required fields: to, subject, html, customer_id');
    }

    // Enviar email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('[send-email] RESEND_API_KEY not configured');
      throw new Error('RESEND_API_KEY not configured');
    }

    console.log('[send-email] Sending email via Resend API...');
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; text-align: center;">
              <img src="https://zaeozfdjhrmblfaxsyuu.supabase.co/storage/v1/object/public/avatars/logo-parabellum-email.png?v=2" 
                   alt="PARABELLUM" 
                   style="max-width: 200px; height: auto;" />
            </div>
            <div style="padding: 30px; background: #f8fafc;">
              ${html}
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #1e3a5f;">
              <tr>
                <td align="center" style="padding: 25px;">
                  <table cellpadding="0" cellspacing="0" border="0" align="center">
                    <tr>
                      <td style="padding: 0 8px;">
                        <img src="https://zaeozfdjhrmblfaxsyuu.supabase.co/storage/v1/object/public/avatars/logo-parabellum-email.png?v=2" 
                             alt="PARABELLUM" 
                             width="100"
                             style="display: block; max-width: 100px; height: auto;" />
                      </td>
                      <td style="padding: 0 8px;">
                        <img src="https://zaeozfdjhrmblfaxsyuu.supabase.co/storage/v1/object/public/avatars/logo-3cliques-email.png?v=2" 
                             alt="3 CLIQUES" 
                             width="80"
                             style="display: block; max-width: 80px; height: auto;" />
                      </td>
                    </tr>
                  </table>
                  <p style="color: #ffffff; margin: 15px 0 10px 0; font-size: 14px; font-weight: 600;">
                    PARABELLUM by 3Cliques
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
          </div>
        </body>
      </html>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Seu Armazém Drop <contato@parabellum.work>',
        to: [`${to_name} <${to}>`],
        subject,
        html: emailHtml,
        tags: [
          { name: 'customer_id', value: customer_id },
          ...(playbook_execution_id ? [{ name: 'playbook_execution_id', value: playbook_execution_id }] : [])
        ]
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text();
      console.error('[send-email] Resend API error:', errorData);
      throw new Error(`Resend API error: ${errorData}`);
    }

    const resendData = await resendResponse.json();
    console.log('[send-email] Email sent successfully:', resendData);

    // Registrar interação email_sent no Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert tracking event
    const { error: trackingError } = await supabase
      .from('email_tracking_events')
      .insert({
        email_id: resendData.id,
        customer_id,
        playbook_execution_id: playbook_execution_id || null,
        event_type: 'sent',
        metadata: { to, subject, to_name }
      });

    if (trackingError) {
      console.warn('[send-email] Warning: Failed to insert tracking event:', trackingError);
    }

    const { error: interactionError } = await supabase
      .from('interactions')
      .insert({
        customer_id,
        playbook_execution_id: playbook_execution_id || null,
        type: 'email_sent',
        content: `Email enviado: ${subject}`,
        channel: 'email',
        metadata: {
          email_id: resendData.id,
          to,
          subject,
        }
      });

    if (interactionError) {
      console.error('[send-email] Error inserting interaction:', interactionError);
      throw interactionError;
    }

    console.log('[send-email] Interaction and tracking registered successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: resendData.id,
        message: 'Email enviado e interação registrada'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[send-email] Error:', error);
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