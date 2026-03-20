import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveBranding } from "../_shared/branding-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface EmailReplyRequest {
  ticket_id: string;
  message_content: string;
}

// Replace variables in text with actual values
function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\[${key}\\]`, 'gi');
    result = result.replace(regex, value || '');
  }
  return result;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { ticket_id, message_content }: EmailReplyRequest = await req.json();

    console.log("[send-ticket-email-reply] Request received:", { ticket_id });

    // Validação
    if (!ticket_id || !message_content) {
      throw new Error("Missing required fields: ticket_id, message_content");
    }

    // Buscar dados do ticket com customer
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select(`
        id,
        subject,
        channel,
        ticket_number,
        last_email_message_id,
        customer_id
      `)
      .eq("id", ticket_id)
      .single();

    if (ticketError) throw ticketError;

    // Log do canal para debug
    console.log("[send-ticket-email-reply] Ticket channel:", ticket.channel);

    // Buscar dados do cliente
    const { data: customer, error: customerError } = await supabase
      .from("contacts")
      .select("id, email, first_name, last_name")
      .eq("id", ticket.customer_id)
      .single();

    if (customerError || !customer?.email) {
      throw new Error("Customer email not found");
    }

    console.log("[send-ticket-email-reply] Sending email to:", customer.email);

    // Resolver branding dinamicamente do banco
    const brand = await resolveBranding(supabase);
    const fromName = brand.fromName;
    const fromEmail = brand.fromEmail;
    const headerColor = brand.headerColor;
    const brandName = brand.brandName;
    const footerText = brand.footerText;

    // Gerar HTML do email com branding configurado
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, ${headerColor} 0%, ${headerColor}dd 100%); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="color: white; margin: 0;">${brandName}</h2>
    </div>
    
    <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
      <p style="margin: 0 0 20px 0;">Olá <strong>${customer.first_name}</strong>,</p>
      
      <p style="margin: 0 0 20px 0;">
        Recebemos sua mensagem sobre o ticket <strong>#${ticket.ticket_number || ticket_id.slice(0, 8)}</strong>.
      </p>
      
      <div style="background: #f9fafb; padding: 20px; border-left: 4px solid #2563eb; margin: 20px 0;">
        ${message_content.replace(/\n/g, '<br/>')}
      </div>
      
      <p style="margin: 20px 0 0 0; font-size: 14px; color: #6b7280;">
        Para responder, basta responder a este email. Sua resposta será automaticamente adicionada ao ticket.
      </p>
    </div>
    
    <div style="margin-top: 20px; padding: 20px; text-align: center; background: ${headerColor}; border-radius: 8px;">
      <p style="color: #94a3b8; margin: 0; font-size: 12px;">
        ${footerText}<br/>
        Ambiente Seguro
      </p>
    </div>
  </div>
</body>
</html>
    `;

    // Enviar email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resendPayload: any = {
      from: `${fromName} <${fromEmail}>`,
      to: [customer.email],
      subject: `Re: ${ticket.subject} [Ticket #${ticket.ticket_number || ticket_id.slice(0, 8)}]`,
      html: emailHtml,
      tags: [
        { name: "ticket_id", value: ticket_id },
        { name: "type", value: "reply" },
      ],
    };

    // Adicionar header In-Reply-To para threading (formato RFC 2822)
    if (ticket.last_email_message_id) {
      // Formatar Message-ID no padrão RFC 2822: <id@domain>
      const messageId = ticket.last_email_message_id.includes('@') 
        ? ticket.last_email_message_id 
        : `<${ticket.last_email_message_id}@resend.dev>`;
      
      resendPayload.headers = {
        "In-Reply-To": messageId,
        "References": messageId,
      };
      console.log("[send-ticket-email-reply] Threading headers set:", messageId);
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text();
      console.error("[send-ticket-email-reply] Resend error:", errorData);
      throw new Error(`Resend API error: ${errorData}`);
    }

    const resendData = await resendResponse.json();
    console.log("[send-ticket-email-reply] Email sent:", resendData);

    // Atualizar last_email_message_id do ticket com formato RFC 2822
    const formattedMessageId = `<${resendData.id}@resend.dev>`;
    await supabase
      .from("tickets")
      .update({ last_email_message_id: formattedMessageId })
      .eq("id", ticket_id);
    console.log("[send-ticket-email-reply] Message ID salvo:", formattedMessageId);

    return new Response(
      JSON.stringify({
        success: true,
        email_id: resendData.id,
        message: "Email reply sent successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[send-ticket-email-reply] Error:", error);
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
