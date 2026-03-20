import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveBranding } from "../_shared/branding-resolver.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendEmailRequest {
  to: string;
  to_name?: string;
  subject: string;
  html: string;
  customer_id?: string;
  playbook_execution_id?: string;
  playbook_node_id?: string;  // ID do nó que enviou o email (para correlação)
  template_id?: string;        // ID do template usado (para tracking)
  is_customer_email?: boolean; // Default: true - usa branding de cliente
  branding_id?: string; // Opcional: branding específico
  isTest?: boolean; // Flag para emails de teste (não requer customer_id)
  useRawHtml?: boolean; // Flag para usar HTML exatamente como enviado (templates personalizados)
}

interface EmailBranding {
  id: string;
  name: string;
  logo_url: string | null;
  footer_logo_url: string | null;
  header_color: string | null;
  primary_color: string | null;
  footer_text: string | null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      to, 
      to_name, 
      subject, 
      html, 
      customer_id, 
      playbook_execution_id,
      playbook_node_id,
      template_id: request_template_id,
      is_customer_email = true,
      branding_id,
      isTest = false,
      useRawHtml = false
    }: SendEmailRequest = await req.json();

    console.log('[send-email] Request received:', { to, subject, customer_id, playbook_execution_id, is_customer_email, branding_id, isTest, useRawHtml });

    // Validação básica
    if (!to || !subject || !html) {
      console.error('[send-email] Missing fields:', { to: !!to, subject: !!subject, html: !!html });
      throw new Error('Missing required fields: to, subject, html');
    }

    // customer_id é obrigatório apenas para emails reais (não de teste)
    if (!isTest && !customer_id) {
      console.error('[send-email] Missing customer_id for non-test email');
      throw new Error('Missing required field: customer_id (required for non-test emails)');
    }

    // Para emails de teste, usar email como nome se to_name não fornecido
    const recipientName = to_name || to.split('@')[0];

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar branding do banco de dados
    let branding: EmailBranding | null = null;
    
    if (branding_id) {
      // Branding específico fornecido
      const { data, error } = await supabase
        .from('email_branding')
        .select('*')
        .eq('id', branding_id)
        .single();
      
      if (!error && data) {
        branding = data;
        console.log('[send-email] Using specific branding:', data.name);
      }
    }
    if (!branding) {
      // Buscar branding padrão baseado no tipo de email
      const brandingColumn = is_customer_email ? 'is_default_customer' : 'is_default_employee';
      const { data, error } = await supabase
        .from('email_branding')
        .select('*')
        .eq(brandingColumn, true)
        .single();
      
      if (!error && data) {
        branding = data;
        console.log(`[send-email] Using default ${is_customer_email ? 'customer' : 'employee'} branding:`, data.name);
      }
    }
    // Resolver branding genérico como fallback final
    const _brand = await resolveBranding(supabase, { isEmployee: !is_customer_email });
    const brandName = branding?.name || _brand.brandName;
    const headerColor = branding?.header_color || _brand.headerColor;
    const primaryColor = branding?.primary_color || _brand.primaryColor;
    const footerText = branding?.footer_text || _brand.footerText;
    const logoUrl = branding?.logo_url || _brand.logoUrl;
    const footerLogoUrl = branding?.footer_logo_url || _brand.footerLogoUrl;

    console.log('[send-email] Branding applied:', { brandName, headerColor, hasLogo: !!logoUrl });

    // Enviar email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('[send-email] RESEND_API_KEY not configured');
      throw new Error('RESEND_API_KEY not configured');
    }

    console.log('[send-email] Sending email via Resend API...');
    
    // Construir header com logo ou texto
    const headerContent = logoUrl 
      ? `<img src="${logoUrl}" alt="${brandName}" style="max-width: 200px; height: auto;" />`
      : `<h2 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">${brandName}</h2>`;

    // Construir footer
    const footerLogoContent = footerLogoUrl
      ? `<img src="${footerLogoUrl}" alt="${brandName}" width="100" style="display: block; max-width: 100px; height: auto;" />`
      : logoUrl
        ? `<img src="${logoUrl}" alt="${brandName}" width="100" style="display: block; max-width: 100px; height: auto;" />`
        : '';

    // Se useRawHtml = true, usar HTML exatamente como enviado (templates personalizados)
    // Caso contrário, envolver com branding padrão do sistema
    let emailHtml: string;

    if (useRawHtml) {
      // Template personalizado - usar exatamente como está, sem adicionar header/footer
      console.log('[send-email] Using raw HTML from custom template (no branding wrapper)');
      emailHtml = html;
    } else {
      // Emails do sistema - aplicar branding padrão
      console.log('[send-email] Applying default branding wrapper');
      emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, ${headerColor} 0%, ${primaryColor} 100%); padding: 30px; text-align: center;">
                ${headerContent}
              </div>
              <div style="padding: 30px; background: #f8fafc;">
                ${html}
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${headerColor};">
                <tr>
                  <td align="center" style="padding: 25px;">
                    ${footerLogoContent ? `
                      <table cellpadding="0" cellspacing="0" border="0" align="center">
                        <tr>
                          <td style="padding: 0 8px;">
                            ${footerLogoContent}
                          </td>
                        </tr>
                      </table>
                    ` : ''}
                    <p style="color: #ffffff; margin: 15px 0 10px 0; font-size: 14px; font-weight: 600;">
                      ${brandName}
                    </p>
                    <p style="color: #94a3b8; margin: 0 0 5px 0; font-size: 12px;">
                      ${footerText}
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
    }

    // Função para sanitizar nome removendo caracteres não-ASCII
    const sanitizeName = (name: string): string => {
      // Remove acentos e caracteres especiais
      return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
        .replace(/[^\x00-\x7F]/g, '')    // Remove caracteres não-ASCII restantes
        .trim();
    };

    // Função para sanitizar valores de tags do Resend (só aceita ASCII letters, numbers, underscores, dashes)
    const sanitizeTagValue = (value: string): string => {
      return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-zA-Z0-9_-]/g, '_') // Substitui caracteres inválidos por _
        .replace(/_+/g, '_')             // Remove underscores duplicados
        .replace(/^_|_$/g, '')           // Remove _ no início/fim
        .slice(0, 50);                   // Limita tamanho
    };

    // Buscar sender configurado (já resolvido via branding)
    let senderEmail = _brand.fromEmail;
    let senderName = sanitizeName(_brand.fromName);

    const { data: senderConfig } = await supabase
      .from('system_configurations')
      .select('value')
      .eq('key', 'email_sender_customer')
      .single();
    
    if (senderConfig?.value) {
      senderEmail = senderConfig.value;
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [`${recipientName} <${to}>`],
        subject,
        html: emailHtml,
        tags: [
          ...(customer_id ? [{ name: 'customer_id', value: customer_id }] : []),
          { name: 'branding', value: sanitizeTagValue(brandName) },
          ...(playbook_execution_id ? [{ name: 'playbook_execution_id', value: playbook_execution_id }] : []),
          ...(isTest ? [{ name: 'type', value: 'test' }] : [])
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

    // Só registrar tracking e interaction para emails reais (com customer_id)
    if (customer_id && !isTest) {
      // Registrar em email_sends para tracking completo (idempotente)
      const emailSendPayload = {
        contact_id: customer_id,
        resend_email_id: resendData.id,
        subject,
        recipient_email: to,
        status: 'sent',
        sent_at: new Date().toISOString(),
        variables_used: { to_name: recipientName, branding: brandName },
        playbook_execution_id: playbook_execution_id || null,
        playbook_node_id: playbook_node_id || null,
        template_id: request_template_id || null,
      };

      const { error: sendError } = await supabase
        .from('email_sends')
        .insert(emailSendPayload);

      // Se já existe (conflito 23505), atualizar só campos de correlação quando NULL
      if (sendError && sendError.code === '23505') {
        console.log('[send-email] Record exists, updating correlation fields if needed');
        await supabase
          .from('email_sends')
          .update({
            playbook_execution_id: emailSendPayload.playbook_execution_id,
            playbook_node_id: emailSendPayload.playbook_node_id,
          })
          .eq('resend_email_id', emailSendPayload.resend_email_id)
          .is('playbook_execution_id', null);
      } else if (sendError) {
        console.warn('[send-email] Warning: Failed to insert email_sends:', sendError);
      } else {
        console.log('[send-email] email_sends record created for tracking');
      }

      // Insert tracking event
      const { error: trackingError } = await supabase
        .from('email_tracking_events')
        .insert({
          email_id: resendData.id,
          customer_id,
          playbook_execution_id: playbook_execution_id || null,
          event_type: 'sent',
          metadata: { to, subject, to_name: recipientName, branding: brandName }
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
            branding: brandName,
          }
        });

      if (interactionError) {
        console.error('[send-email] Error inserting interaction:', interactionError);
        throw interactionError;
      }

      console.log('[send-email] Interaction and tracking registered successfully');
    } else {
      console.log('[send-email] Test email - skipping tracking and interaction registration');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: resendData.id,
        branding_used: brandName,
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
