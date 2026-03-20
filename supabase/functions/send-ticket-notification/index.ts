import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveBranding } from "../_shared/branding-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TicketNotificationRequest {
  ticket_id: string;
  ticket_number: string;
  customer_email: string;
  customer_name: string;
  subject: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
}

const priorityColors: Record<string, string> = {
  urgent: "#EF4444",
  high: "#F59E0B",
  medium: "#3B82F6",
  low: "#10B981",
};

const priorityLabels: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

// Converte markdown simples para HTML (negrito e quebras de linha)
function markdownToHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function generateTicketEmailHTML(
  ticket_number: string,
  customer_name: string,
  subject: string,
  description: string,
  priority: string,
  brandName: string,
  logoUrl: string,
  portalUrl: string
): string {
  const priorityColor = priorityColors[priority] || "#6B7280";
  const priorityLabel = priorityLabels[priority] || priority;
  const formattedDescription = markdownToHtml(description) || "Sem descrição adicional";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Criado</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; background-color: #f6f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Logo Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; text-align: center;">
              <img src="${logoUrl}" alt="${brandName}" style="max-width: 220px; height: auto;" />
            </td>
          </tr>
          
          <!-- Ticket Header -->
          <tr>
            <td style="background: ${priorityColor}; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Ticket Criado</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px 48px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 26px; color: #333;">
                Olá <strong>${customer_name}</strong>,
              </p>
              
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 26px; color: #333;">
                Recebemos sua solicitação e criamos o ticket <strong>#${ticket_number}</strong> para você.
                Nossa equipe já foi notificada e responderá em breve.
              </p>
            </td>
          </tr>

          <!-- Ticket Details Box -->
          <tr>
            <td style="padding: 0 48px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                      Assunto
                    </p>
                    <p style="margin: 0 0 20px; font-size: 15px; line-height: 22px; color: #111827; font-weight: 500;">
                      ${subject}
                    </p>
                    
                    <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                      Descrição
                    </p>
                    <div style="margin: 0 0 20px; font-size: 14px; line-height: 22px; color: #374151;">
                      ${formattedDescription}
                    </div>

                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 0 0 20px;">

                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                            Prioridade
                          </p>
                          <span style="display: inline-block; padding: 6px 14px; border-radius: 9999px; background-color: ${priorityColor}; color: #ffffff; font-size: 12px; font-weight: 600;">
                            ${priorityLabel}
                          </span>
                        </td>
                        <td style="padding-left: 32px;">
                          <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                            Número do Ticket
                          </p>
                          <span style="display: inline-block; padding: 6px 14px; border-radius: 9999px; background-color: #1e3a5f; color: #ffffff; font-size: 12px; font-weight: 600;">
                            #${ticket_number}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Additional Info + Portal Link -->
          <tr>
            <td style="padding: 0 48px 32px;">
              <p style="margin: 0 0 12px; font-size: 15px; line-height: 24px; color: #4b5563;">
                Você receberá atualizações por email sempre que houver novidades sobre seu ticket.
              </p>
              
              <p style="margin: 0 0 20px; font-size: 15px; line-height: 24px; color: #4b5563;">
                Você também pode acompanhar o status do seu ticket a qualquer momento no nosso portal:
              </p>
              
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${portalUrl}/my-tickets" 
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #2563eb 0%, #1e3a5f 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 8px;">
                      Acompanhar Meus Tickets
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0; font-size: 13px; line-height: 20px; color: #6b7280; text-align: center;">
                No portal, você pode ver todos os seus tickets, respostas da equipe e adicionar comentários.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #1e3a5f; padding: 30px; text-align: center;">
              <img src="${logoUrl}" alt="${brandName}" style="max-width: 140px; height: auto; margin-bottom: 12px; opacity: 0.9;" />
              <p style="color: #94a3b8; margin: 0 0 4px 0; font-size: 13px;">
                Equipe de Suporte
              </p>
              <p style="color: #64748b; margin: 0; font-size: 11px;">
                © ${new Date().getFullYear()} ${brandName}. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Função para sanitizar nome removendo caracteres não-ASCII
function sanitizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '')
    .trim();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      ticket_id,
      ticket_number,
      customer_email,
      customer_name,
      subject,
      description,
      priority,
    }: TicketNotificationRequest = await req.json();

    console.log("[send-ticket-notification] Request received:", {
      ticket_id,
      ticket_number,
      customer_email,
      priority,
    });

    // Validação
    if (!ticket_number || !customer_email || !customer_name || !subject || !priority) {
      console.error("[send-ticket-notification] Missing required fields");
      throw new Error("Missing required fields");
    }

    // Inicializar Supabase para buscar configurações
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resolver branding dinamicamente do banco
    const brand = await resolveBranding(supabase);
    let senderEmail = brand.fromEmail;
    let senderName = sanitizeName(brand.fromName);
    const brandName = brand.brandName;
    const logoUrl = brand.logoUrl || '';

    // Override com system_configurations se existir
    const { data: senderConfig } = await supabase
      .from('system_configurations')
      .select('value')
      .eq('key', 'email_sender_customer')
      .single();
    
    if (senderConfig?.value) {
      senderEmail = senderConfig.value;
      console.log('[send-ticket-notification] Using configured sender:', senderEmail);
    }

    // Buscar URL do portal de tickets - fallback dinâmico
    const projectId = supabaseUrl?.match(/https:\/\/([^.]+)/)?.[1];
    let portalUrl = `https://${projectId}.lovable.app`;
    
    const { data: portalConfig } = await supabase
      .from('system_configurations')
      .select('value')
      .eq('key', 'public_portal_url')
      .single();
    
    if (portalConfig?.value) {
      portalUrl = portalConfig.value;
    }

    console.log('[send-ticket-notification] Email config:', { senderEmail, senderName, brandName, logoUrl, portalUrl });

    // Gerar HTML do email
    const html = generateTicketEmailHTML(
      ticket_number,
      customer_name,
      subject,
      description,
      priority,
      brandName,
      logoUrl,
      portalUrl
    );

    // Enviar email via Resend API
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("[send-ticket-notification] RESEND_API_KEY not configured");
      throw new Error("RESEND_API_KEY not configured");
    }

    console.log("[send-ticket-notification] Sending email via Resend API...");
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [customer_email],
        subject: `Ticket #${ticket_number} - ${subject} #${ticket_id.slice(0, 8)}`,
        html,
        tags: [
          { name: "ticket_id", value: ticket_id },
          { name: "priority", value: priority },
        ],
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text();
      console.error("[send-ticket-notification] Resend API error:", errorData);
      throw new Error(`Resend API error: ${errorData}`);
    }

    const resendData = await resendResponse.json();
    console.log("[send-ticket-notification] Email sent successfully:", resendData);

    // Salvar message_id no ticket para threading de respostas por email (formato RFC 2822)
    if (ticket_id && resendData.id) {
      const formattedMessageId = `<${resendData.id}@resend.dev>`;
      const { error: updateError } = await supabase
        .from("tickets")
        .update({ last_email_message_id: formattedMessageId })
        .eq("id", ticket_id);
      
      if (updateError) {
        console.error("[send-ticket-notification] Erro ao salvar message_id:", updateError);
      } else {
        console.log("[send-ticket-notification] ✅ Message ID salvo no ticket:", formattedMessageId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_id: resendData.id,
        message: "Email de notificação enviado com sucesso",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[send-ticket-notification] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
