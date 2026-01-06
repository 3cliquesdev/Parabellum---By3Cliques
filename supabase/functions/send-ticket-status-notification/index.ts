import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatusNotificationRequest {
  ticket_id: string;
  new_status: 'waiting_customer' | 'resolved' | 'closed';
  note?: string;
}

const statusConfig = {
  waiting_customer: {
    emoji: '📋',
    subjectPrefix: 'Precisamos da sua resposta',
    badgeColor: '#f59e0b',
    badgeLabel: 'Aguardando Resposta',
    mainMessage: 'Analisamos seu chamado e precisamos de mais informações para continuar o atendimento.',
    ctaText: '💬 Responder ao Ticket',
  },
  resolved: {
    emoji: '✅',
    subjectPrefix: 'Seu ticket foi resolvido',
    badgeColor: '#10b981',
    badgeLabel: 'Resolvido',
    mainMessage: 'Temos o prazer de informar que seu chamado foi resolvido com sucesso!',
    ctaText: '📋 Ver Meus Tickets',
  },
  closed: {
    emoji: '🔒',
    subjectPrefix: 'Ticket encerrado',
    badgeColor: '#6b7280',
    badgeLabel: 'Encerrado',
    mainMessage: 'Seu ticket foi encerrado. Se precisar de ajuda adicional sobre o mesmo assunto, você pode abrir um novo chamado.',
    ctaText: '➕ Abrir Novo Ticket',
  },
};

function sanitizeName(name: string): string {
  return name.replace(/[^\x00-\x7F]/g, '').trim() || 'Suporte';
}

function generateStatusEmailHTML(
  customerName: string,
  ticketNumber: string,
  subject: string,
  status: 'waiting_customer' | 'resolved' | 'closed',
  note: string | undefined,
  brandName: string,
  logoUrl: string,
  portalUrl: string
): string {
  const config = statusConfig[status];
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.subjectPrefix} - ${ticketNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); padding: 32px 48px; text-align: center;">
              <img src="${logoUrl}" alt="${brandName}" style="height: 48px; max-width: 200px; object-fit: contain;">
            </td>
          </tr>

          <!-- Status Badge -->
          <tr>
            <td style="padding: 32px 48px 16px; text-align: center;">
              <span style="display: inline-block; padding: 8px 20px; background-color: ${config.badgeColor}; color: #ffffff; font-size: 14px; font-weight: 600; border-radius: 20px;">
                ${config.emoji} ${config.badgeLabel}
              </span>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 16px 48px 32px;">
              <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #111827; text-align: center;">
                ${config.subjectPrefix}
              </h1>
              <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280; text-align: center;">
                Ticket ${ticketNumber}
              </p>
              
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 26px; color: #374151;">
                Olá <strong>${customerName}</strong>,
              </p>
              
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 24px; color: #4b5563;">
                ${config.mainMessage}
              </p>

              <!-- Ticket Info Card -->
              <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid ${config.badgeColor};">
                <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                  Assunto do Ticket
                </p>
                <p style="margin: 0; font-size: 15px; color: #1f2937; font-weight: 500;">
                  ${subject}
                </p>
              </div>

              ${note ? `
              <!-- Agent Note -->
              <div style="background-color: #eff6ff; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #bfdbfe;">
                <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.5px;">
                  💬 Mensagem do Atendente
                </p>
                <p style="margin: 0; font-size: 15px; color: #1e40af; line-height: 24px;">
                  ${note}
                </p>
              </div>
              ` : ''}

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="text-align: center; padding: 8px 0;">
                    <a href="${portalUrl}/my-tickets" 
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #2563eb 0%, #1e3a5f 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 8px;">
                      ${config.ctaText}
                    </a>
                  </td>
                </tr>
              </table>

              ${status === 'resolved' ? `
              <p style="margin: 24px 0 0; font-size: 14px; line-height: 22px; color: #6b7280; text-align: center;">
                Caso ainda tenha alguma dúvida, você pode reabrir o ticket respondendo a este email ou acessando o portal.
              </p>
              ` : ''}

              ${status === 'waiting_customer' ? `
              <p style="margin: 24px 0 0; font-size: 14px; line-height: 22px; color: #6b7280; text-align: center;">
                Por favor, responda o mais breve possível para que possamos dar continuidade ao seu atendimento.
              </p>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 48px; text-align: center; border-top: 1px solid #e5e7eb;">
              <img src="${logoUrl}" alt="${brandName}" style="height: 32px; margin-bottom: 12px; opacity: 0.7;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticket_id, new_status, note }: StatusNotificationRequest = await req.json();

    if (!ticket_id || !new_status) {
      throw new Error("ticket_id and new_status are required");
    }

    if (!['waiting_customer', 'resolved', 'closed'].includes(new_status)) {
      throw new Error("Invalid status. Must be waiting_customer, resolved, or closed");
    }

    console.log(`[send-ticket-status-notification] Processing status change: ${new_status} for ticket ${ticket_id}`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch ticket with customer info
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select(`
        id,
        ticket_number,
        subject,
        contact_id,
        contacts!tickets_contact_id_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq("id", ticket_id)
      .single();

    if (ticketError || !ticket) {
      throw new Error(`Ticket not found: ${ticketError?.message}`);
    }

    const contact = ticket.contacts as any;
    if (!contact?.email) {
      console.log("[send-ticket-status-notification] No customer email found, skipping notification");
      return new Response(
        JSON.stringify({ success: true, message: "No customer email, notification skipped" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customerName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Cliente';
    const customerEmail = contact.email;
    const ticketNumber = ticket.ticket_number || `#${ticket.id.slice(0, 8)}`;

    // Fetch sender config
    const { data: senderConfig } = await supabase
      .from("email_senders")
      .select("from_email, from_name")
      .eq("is_default", true)
      .single();

    const senderEmail = senderConfig?.from_email || "suporte@resend.dev";
    let senderName = senderConfig?.from_name || "Suporte";

    // Fetch branding
    const { data: brandingData } = await supabase
      .from("email_branding")
      .select("logo_url, name")
      .eq("is_default_customer", true)
      .single();

    const brandName = brandingData?.name || "Suporte";
    const logoUrl = brandingData?.logo_url || 'https://zaeozfdjhrmblfaxsyuu.supabase.co/storage/v1/object/public/avatars/logo-seuarmazemdrop.png';
    senderName = sanitizeName(brandName);

    // Fetch portal URL
    let portalUrl = 'https://seuarmazemdrop.parabellum.work';
    const { data: portalConfig } = await supabase
      .from("system_configurations")
      .select("value")
      .eq("key", "public_portal_url")
      .single();

    if (portalConfig?.value) {
      portalUrl = portalConfig.value;
    }

    console.log(`[send-ticket-status-notification] Sending to ${customerEmail}`);

    // Generate email HTML
    const config = statusConfig[new_status];
    const emailSubject = `${config.emoji} ${config.subjectPrefix} - ${ticketNumber}`;
    const html = generateStatusEmailHTML(
      customerName,
      ticketNumber,
      ticket.subject,
      new_status,
      note,
      brandName,
      logoUrl,
      portalUrl
    );

    // Send email via Resend API directly (using fetch)
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [customerEmail],
        subject: emailSubject,
        html: html,
      }),
    });

    const emailResponse = await resendResponse.json();
    
    if (!resendResponse.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(emailResponse)}`);
    }

    console.log("[send-ticket-status-notification] Email sent:", emailResponse);

    // Log the interaction
    await supabase.from("interactions").insert({
      contact_id: contact.id,
      type: "email",
      direction: "outbound",
      subject: emailSubject,
      content: `Notificação de status: ${config.badgeLabel}${note ? ` - ${note}` : ''}`,
      metadata: {
        ticket_id: ticket.id,
        status_change: new_status,
        email_id: emailResponse?.id,
      },
    });

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[send-ticket-status-notification] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
