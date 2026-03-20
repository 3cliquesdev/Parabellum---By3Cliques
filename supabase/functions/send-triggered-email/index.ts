import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveBranding } from "../_shared/branding-resolver.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SendTriggeredEmailRequest {
  trigger_type: string;
  contact_id?: string;
  contact_email?: string;
  variables: Record<string, string | number | null>;
}

/**
 * Replace variables in text with actual values
 * Supports [VARIABLE_NAME] format
 */
function replaceVariables(text: string, variables: Record<string, string | number | null>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    // Support both [KEY] and [key] formats
    const regexBrackets = new RegExp(`\\[${key}\\]`, 'gi');
    result = result.replace(regexBrackets, String(value ?? ''));
  }
  return result;
}

/**
 * Format currency value in BRL
 */
function formatCurrency(value: number | string | null): string {
  if (value === null || value === undefined) return 'R$ 0,00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(num);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { 
      trigger_type, 
      contact_id, 
      contact_email,
      variables = {} 
    }: SendTriggeredEmailRequest = await req.json();

    console.log("[send-triggered-email] Request:", { trigger_type, contact_id, contact_email });

    if (!trigger_type) {
      throw new Error("trigger_type is required");
    }

    // 1. Buscar templates ATIVOS com trigger_types contendo o gatilho
    const { data: templates, error: templateError } = await supabase
      .from("email_templates")
      .select("*, email_branding(*), email_senders(*)")
      .contains("trigger_types", [trigger_type])
      .eq("is_active", true);

    // Se não encontrar template ativo, retornar silenciosamente (sem erro)
    if (templateError || !templates || templates.length === 0) {
      console.log("[send-triggered-email] No active template for trigger:", trigger_type);
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true, 
          reason: "no_active_template",
          trigger_type 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-triggered-email] Found ${templates.length} template(s) for trigger: ${trigger_type}`);

    // 2. Buscar email do contato se não foi fornecido (shared across templates)
    let recipientEmail = contact_email;
    let recipientName = variables.CUSTOMER_FULL_NAME || variables.CUSTOMER_FIRST_NAME || '';

    if (!recipientEmail && contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("email, first_name, last_name")
        .eq("id", contact_id)
        .single();

      if (contact) {
        recipientEmail = contact.email;
        recipientName = recipientName || `${contact.first_name} ${contact.last_name}`.trim();
      }
    }

    if (!recipientEmail) {
      console.log("[send-triggered-email] No recipient email, skipping");
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true, 
          reason: "no_recipient_email" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Preparar variáveis com formatação de moeda
    const processedVariables: Record<string, string> = {};
    for (const [key, value] of Object.entries(variables)) {
      if (key.includes('VALUE') || key.includes('LTV') || key.includes('PRICE')) {
        processedVariables[key] = formatCurrency(value as number);
      } else {
        processedVariables[key] = String(value ?? '');
      }
    }

    const now = new Date();
    processedVariables.CURRENT_DATE = now.toLocaleDateString('pt-BR');
    processedVariables.CURRENT_TIME = now.toLocaleTimeString('pt-BR');
    processedVariables.CURRENT_YEAR = now.getFullYear().toString();

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const sanitizeName = (name: string): string => {
      return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x00-\x7F]/g, '')
        .trim();
    };

    // Process each matching template
    const results = [];
    for (const template of templates) {
      try {
        const processedSubject = replaceVariables(template.subject, processedVariables);
        const processedBody = replaceVariables(template.html_body, processedVariables);

        console.log("[send-triggered-email] Processing template:", template.name);

        let branding = template.email_branding;
        if (!branding) {
          const { data: defaultBranding } = await supabase
            .from("email_branding")
            .select("*")
            .eq("is_default_customer", true)
            .single();
          branding = defaultBranding;
        }

        let sender = template.email_senders;
        if (!sender) {
          const { data: defaultSender } = await supabase
            .from("email_senders")
            .select("*")
            .eq("is_default", true)
            .single();
          sender = defaultSender;
        }

        const _brand = await resolveBranding(supabase);
        const fromName = sender?.from_name || branding?.name || _brand.fromName;
        const fromEmail = sender?.from_email || _brand.fromEmail;
        const headerColor = branding?.header_color || _brand.headerColor;
        const brandName = branding?.name || _brand.brandName;
        const footerText = branding?.footer_text || _brand.footerText;
        const logoUrl = branding?.logo_url || _brand.logoUrl;

        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, ${headerColor} 0%, ${headerColor}dd 100%); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      ${logoUrl 
        ? `<img src="${logoUrl}" alt="${brandName}" style="max-height: 40px; max-width: 200px;" />`
        : `<h2 style="color: white; margin: 0; font-size: 24px;">${brandName}</h2>`
      }
    </div>
    <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; background: #ffffff; border-radius: 0 0 8px 8px;">
      ${processedBody}
    </div>
    <div style="margin-top: 20px; padding: 20px; text-align: center; background: ${headerColor}; border-radius: 8px;">
      ${branding?.footer_logo_url 
        ? `<img src="${branding.footer_logo_url}" alt="${brandName}" style="max-height: 30px; margin-bottom: 10px;" /><br/>`
        : ''
      }
      <p style="color: #94a3b8; margin: 0; font-size: 12px;">${footerText}</p>
    </div>
  </div>
</body>
</html>`;

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${sanitizeName(fromName)} <${fromEmail}>`,
            to: [recipientEmail],
            subject: processedSubject,
            html: emailHtml,
            tags: [
              { name: 'trigger_type', value: trigger_type },
              { name: 'template_id', value: template.id },
              ...(contact_id ? [{ name: 'contact_id', value: contact_id }] : [])
            ]
          }),
        });

        if (!resendResponse.ok) {
          const errorData = await resendResponse.text();
          console.error('[send-triggered-email] Resend API error for template', template.id, ':', errorData);
          results.push({ template_id: template.id, success: false, error: errorData });
          continue;
        }

        const resendData = await resendResponse.json();
        console.log('[send-triggered-email] Email sent successfully:', resendData.id);

        await supabase
          .from('email_tracking_events')
          .insert({
            email_id: resendData.id,
            customer_id: contact_id || null,
            event_type: 'sent',
            metadata: {
              trigger_type,
              template_id: template.id,
              template_name: template.name,
              to: recipientEmail,
              subject: processedSubject,
              variables: Object.keys(processedVariables)
            }
          });

        if (contact_id) {
          await supabase
            .from('interactions')
            .insert({
              customer_id: contact_id,
              type: 'email_sent',
              content: `Email automático enviado: ${processedSubject} (Trigger: ${trigger_type})`,
              channel: 'email',
              metadata: {
                email_id: resendData.id,
                trigger_type,
                template_id: template.id,
                template_name: template.name
              }
            });
        }

        results.push({
          template_id: template.id,
          template_name: template.name,
          email_id: resendData.id,
          success: true
        });
      } catch (templateError: any) {
        console.error('[send-triggered-email] Error processing template', template.id, ':', templateError);
        results.push({ template_id: template.id, success: false, error: templateError.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        trigger_type,
        templates_processed: results.length,
        results,
        recipient: recipientEmail
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[send-triggered-email] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
