import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Branding Parabellum
const BRAND = {
  name: "Parabellum",
  headerColor: "#1e3a5f",
  primaryColor: "hsl(221, 83%, 53%)",
  primaryHex: "#2563eb",
  foregroundColor: "#0f172a",
  mutedColor: "#64748b",
  logoUrl: "https://nexxoai.lovable.app/logo-parabellum-light.png",
  footerText: "Parabellum - Equipe de Suporte",
  senderEmail: "contato@mail.3cliques.net",
  senderName: "Parabellum",
  portalUrl: "https://nexxoai.lovable.app",
};

interface AuthEmailPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type: string;
    site_url?: string;
    confirmation_url?: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function getEmailContent(type: string, confirmationUrl: string, token?: string): { subject: string; heading: string; body: string; buttonText: string; buttonUrl: string } {
  switch (type) {
    case "recovery":
      return {
        subject: "Redefinir sua senha - Parabellum",
        heading: "Redefinição de Senha",
        body: "Você solicitou a redefinição de sua senha. Clique no botão abaixo para criar uma nova senha. Este link expira em 24 horas.",
        buttonText: "Redefinir Senha",
        buttonUrl: confirmationUrl,
      };
    case "signup":
    case "confirmation":
      return {
        subject: "Confirme seu email - Parabellum",
        heading: "Confirme seu Email",
        body: "Obrigado por se cadastrar! Clique no botão abaixo para confirmar seu endereço de email e ativar sua conta.",
        buttonText: "Confirmar Email",
        buttonUrl: confirmationUrl,
      };
    case "magiclink":
      return {
        subject: "Seu link de acesso - Parabellum",
        heading: "Link de Acesso",
        body: "Clique no botão abaixo para acessar sua conta. Este link é válido por tempo limitado.",
        buttonText: "Acessar Conta",
        buttonUrl: confirmationUrl,
      };
    case "invite":
      return {
        subject: "Você foi convidado - Parabellum",
        heading: "Convite de Acesso",
        body: "Você foi convidado a participar da plataforma Parabellum. Clique no botão abaixo para aceitar o convite e criar sua conta.",
        buttonText: "Aceitar Convite",
        buttonUrl: confirmationUrl,
      };
    case "email_change":
      return {
        subject: "Confirme a alteração de email - Parabellum",
        heading: "Alteração de Email",
        body: "Você solicitou a alteração do seu endereço de email. Clique no botão abaixo para confirmar.",
        buttonText: "Confirmar Alteração",
        buttonUrl: confirmationUrl,
      };
    case "reauthentication":
      return {
        subject: `Código de verificação: ${token || ""} - Parabellum`,
        heading: "Código de Verificação",
        body: `Seu código de verificação é: <strong style="font-size: 28px; letter-spacing: 4px; color: ${BRAND.primaryHex};">${token || ""}</strong><br/><br/>Use este código para confirmar sua identidade. Ele expira em poucos minutos.`,
        buttonText: "",
        buttonUrl: "",
      };
    default:
      return {
        subject: "Notificação - Parabellum",
        heading: "Notificação",
        body: "Você tem uma ação pendente na plataforma.",
        buttonText: "Acessar Plataforma",
        buttonUrl: confirmationUrl || BRAND.portalUrl,
      };
  }
}

function buildEmailHtml(content: { subject: string; heading: string; body: string; buttonText: string; buttonUrl: string }): string {
  const buttonHtml = content.buttonText && content.buttonUrl ? `
    <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 30px auto;">
      <tr>
        <td align="center" style="background: ${BRAND.primaryHex}; border-radius: 8px;">
          <a href="${content.buttonUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; font-family: Arial, sans-serif;">
            ${content.buttonText}
          </a>
        </td>
      </tr>
    </table>
  ` : "";

  const urlFallback = content.buttonUrl ? `
    <p style="color: ${BRAND.mutedColor}; font-size: 12px; margin-top: 20px; word-break: break-all;">
      Se o botão não funcionar, copie e cole este link no seu navegador:<br/>
      <a href="${content.buttonUrl}" style="color: ${BRAND.primaryHex};">${content.buttonUrl}</a>
    </p>
  ` : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: ${BRAND.foregroundColor}; margin: 0; padding: 0; background-color: #f1f5f9;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${BRAND.headerColor} 0%, #2c5282 100%); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
      <img src="${BRAND.logoUrl}" alt="${BRAND.name}" style="max-height: 44px; max-width: 200px;" />
    </div>
    
    <!-- Content -->
    <div style="background: #ffffff; padding: 40px 30px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
      <h1 style="color: ${BRAND.foregroundColor}; font-size: 22px; margin: 0 0 16px 0; text-align: center;">
        ${content.heading}
      </h1>
      <p style="color: #334155; font-size: 15px; margin: 0 0 24px 0; text-align: center;">
        ${content.body}
      </p>
      ${buttonHtml}
      ${urlFallback}
    </div>
    
    <!-- Footer -->
    <div style="background: ${BRAND.headerColor}; padding: 24px; text-align: center; border-radius: 0 0 12px 12px;">
      <p style="color: #94a3b8; margin: 0; font-size: 12px;">
        ${BRAND.footerText}
      </p>
      <p style="color: #64748b; margin: 8px 0 0 0; font-size: 11px;">
        Se você não solicitou esta ação, ignore este email.
      </p>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: AuthEmailPayload = await req.json();
    const { user, email_data } = payload;
    
    console.log("[auth-email-hook] Received:", {
      email: user.email,
      type: email_data.email_action_type,
      has_token: !!email_data.token,
      has_confirmation_url: !!email_data.confirmation_url,
    });

    const emailType = email_data.email_action_type;
    const confirmationUrl = email_data.confirmation_url || "";
    const token = email_data.token;

    const content = getEmailContent(emailType, confirmationUrl, token);
    const html = buildEmailHtml(content);

    // Send via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${BRAND.senderName} <${BRAND.senderEmail}>`,
        to: [user.email],
        subject: content.subject,
        html,
        tags: [
          { name: "type", value: "auth" },
          { name: "auth_type", value: emailType },
        ],
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text();
      console.error("[auth-email-hook] Resend error:", errorData);
      throw new Error(`Resend API error: ${errorData}`);
    }

    const resendData = await resendResponse.json();
    console.log("[auth-email-hook] Email sent successfully:", {
      email_id: resendData.id,
      type: emailType,
      to: user.email,
    });

    // Log no email_send_log se existir
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabase.from("email_send_log").insert({
        message_id: resendData.id,
        template_name: `auth_${emailType}`,
        recipient_email: user.email,
        status: "sent",
        metadata: { auth_type: emailType, user_id: user.id },
      });
    } catch (logErr) {
      console.warn("[auth-email-hook] Failed to log email send:", logErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[auth-email-hook] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
