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
  primaryHex: "#2563eb",
  foregroundColor: "#0f172a",
  mutedColor: "#64748b",
  logoUrl: "https://nexxoai.lovable.app/logo-parabellum-light.png",
  footerText: "Parabellum - Equipe de Suporte",
  senderEmail: "contato@mail.3cliques.net",
  senderName: "Parabellum",
};

function buildRecoveryEmailHtml(resetLink: string): string {
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
        Redefinição de Senha
      </h1>
      <p style="color: #334155; font-size: 15px; margin: 0 0 24px 0; text-align: center;">
        Você solicitou a redefinição de sua senha. Clique no botão abaixo para criar uma nova senha. Este link expira em 24 horas.
      </p>
      
      <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 30px auto;">
        <tr>
          <td align="center" style="background: ${BRAND.primaryHex}; border-radius: 8px;">
            <a href="${resetLink}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; font-family: Arial, sans-serif;">
              Redefinir Senha
            </a>
          </td>
        </tr>
      </table>

      <p style="color: ${BRAND.mutedColor}; font-size: 12px; margin-top: 20px; word-break: break-all; text-align: center;">
        Se o botão não funcionar, copie e cole este link no seu navegador:<br/>
        <a href="${resetLink}" style="color: ${BRAND.primaryHex};">${resetLink}</a>
      </p>
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
    const { email, redirect_to } = await req.json();

    if (!email) {
      throw new Error("Email é obrigatório");
    }

    console.log("[send-recovery-email] Request for:", email);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate recovery link via Admin API
    const redirectUrl = redirect_to || "https://nexxoai.lovable.app/setup-password";
    
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (linkError) {
      console.error("[send-recovery-email] Error generating link:", linkError);
      // Don't reveal if user exists or not
      return new Response(
        JSON.stringify({ success: true, message: "Se o email estiver cadastrado, você receberá as instruções." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the confirmation URL with the token
    const { properties } = linkData;
    const resetLink = properties?.action_link || "";

    console.log("[send-recovery-email] Generated reset link for:", email);

    // Send via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const html = buildRecoveryEmailHtml(resetLink);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${BRAND.senderName} <${BRAND.senderEmail}>`,
        to: [email],
        subject: "Redefinir sua senha - Parabellum",
        html,
        tags: [
          { name: "type", value: "auth_recovery" },
        ],
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text();
      console.error("[send-recovery-email] Resend error:", errorData);
      throw new Error(`Resend error: ${errorData}`);
    }

    const resendData = await resendResponse.json();
    console.log("[send-recovery-email] Email sent:", resendData.id);

    // Log
    try {
      await supabase.from("email_send_log").insert({
        message_id: resendData.id,
        template_name: "auth_recovery",
        recipient_email: email,
        status: "sent",
        metadata: { type: "password_recovery" },
      });
    } catch (logErr) {
      console.warn("[send-recovery-email] Failed to log:", logErr);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email de recuperação enviado com sucesso." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-recovery-email] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
