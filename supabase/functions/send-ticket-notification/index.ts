import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

// SLA removido conforme solicitação do cliente - apenas prioridade será exibida

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

function generateTicketEmailHTML(
  ticket_number: string,
  customer_name: string,
  subject: string,
  description: string,
  priority: string
): string {
  const priorityColor = priorityColors[priority] || "#6B7280";
  const priorityLabel = priorityLabels[priority] || priority;

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
              <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold;">Seu Armazém Drop</h1>
            </td>
          </tr>
          
          <!-- Ticket Header -->
          <tr>
            <td style="background: ${priorityColor}; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🎫 Ticket Criado</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 48px;">
              <p style="margin: 16px 0; font-size: 16px; line-height: 26px; color: #333;">
                Olá <strong>${customer_name}</strong>,
              </p>
              
              <p style="margin: 16px 0; font-size: 16px; line-height: 26px; color: #333;">
                Recebemos sua solicitação e criamos o ticket <strong>#${ticket_number}</strong> para você.
                Nossa equipe já foi notificada e responderá em breve.
              </p>
            </td>
          </tr>

          <!-- Ticket Details Box -->
          <tr>
            <td style="padding: 32px 48px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">
                      Assunto:
                    </p>
                    <p style="margin: 0; font-size: 14px; line-height: 20px; color: #111827;">
                      ${subject}
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding-top: 16px;">
                    <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">
                      Descrição:
                    </p>
                    <p style="margin: 0; font-size: 14px; line-height: 20px; color: #111827;">
                      ${description || "Sem descrição adicional"}
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 20px;">
                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 0;">
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 20px;">
                    <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">
                      Prioridade:
                    </p>
                    <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background-color: ${priorityColor}; color: #ffffff; font-size: 12px; font-weight: 600; margin-top: 4px;">
                      ${priorityLabel}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Additional Info -->
          <tr>
            <td style="padding: 0 48px;">
              <p style="margin: 16px 0; font-size: 16px; line-height: 26px; color: #333;">
                Você receberá atualizações por email sempre que houver novidades sobre seu ticket.
              </p>
              
              <p style="margin: 16px 0; font-size: 16px; line-height: 26px; color: #333;">
                Se tiver alguma dúvida adicional, não hesite em nos contatar.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #1e3a5f; padding: 25px; text-align: center;">
              <p style="color: #ffffff; margin: 0 0 10px 0; font-size: 24px; font-weight: bold;">
                Seu Armazém Drop
              </p>
              <p style="color: #94a3b8; margin: 0 0 5px 0; font-size: 12px;">
                Equipe de Suporte
              </p>
              <p style="color: #64748b; margin: 0; font-size: 11px;">
                Ambiente Seguro
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

    // Gerar HTML do email
    const html = generateTicketEmailHTML(
      ticket_number,
      customer_name,
      subject,
      description,
      priority
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
        from: "Seu Armazém Drop Suporte <suporte@parabellum.work>",
        to: [customer_email],
        subject: `🎫 Ticket #${ticket_number} criado com sucesso`,
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
