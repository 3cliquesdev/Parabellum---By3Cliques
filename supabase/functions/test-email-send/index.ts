import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveBranding } from "../_shared/branding-resolver.ts";

const RESEND_API_URL = "https://api.resend.com/emails";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  to: string;
  type: "customer" | "employee";
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[test-email-send] Request received:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, type = "customer" }: TestEmailRequest = await req.json();
    console.log("[test-email-send] Sending test email to:", to, "type:", type);

    if (!to || !to.includes("@")) {
      throw new Error("Email inválido");
    }

    // Initialize Supabase client to fetch configurations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch email sender configuration
    const configKey = type === "customer" ? "email_sender_customer" : "email_sender_employee";
    const { data: config, error: configError } = await supabase
      .from("system_configurations")
      .select("value")
      .eq("key", configKey)
      .single();

    if (configError) {
      console.error("[test-email-send] Error fetching config:", configError);
      throw new Error("Erro ao buscar configuração de email");
    }

    const _brand = await resolveBranding(supabase, { isEmployee: type !== 'customer' });
    const fromEmail = config?.value || `${_brand.fromName} <${_brand.fromEmail}>`;
    console.log("[test-email-send] Using sender:", fromEmail);

    // Initialize Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurado");
    }

    // Send test email via Resend API
    const emailPayload = {
      from: fromEmail,
      to: [to],
      subject: "Email de Teste - Sistema CRM",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
              .badge { display: inline-block; background: #22c55e; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; }
              .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 28px;">Email de Teste</h1>
              </div>
              <div class="content">
                <p><span class="badge">Sucesso!</span></p>
                <p>Este é um email de teste enviado pela <strong>Central de Integrações</strong> do seu CRM.</p>
                <p><strong>Detalhes do teste:</strong></p>
                <ul>
                  <li><strong>Tipo:</strong> ${type === "customer" ? "Cliente" : "Funcionário"}</li>
                  <li><strong>Remetente:</strong> ${fromEmail}</li>
                  <li><strong>Provedor:</strong> Resend</li>
                  <li><strong>Data/Hora:</strong> ${new Date().toLocaleString("pt-BR")}</li>
                </ul>
                <p style="background: #f3f4f6; padding: 15px; border-left: 4px solid #2563eb; border-radius: 4px; margin-top: 20px;">
                  <strong>Dica:</strong> Se você recebeu este email, sua configuração está funcionando perfeitamente!
                </p>
              </div>
              <div class="footer">
                <p>Enviado pelo sistema CRM • ${new Date().getFullYear()}</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };

    const emailResponse = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("[test-email-send] Resend API error:", errorData);
      throw new Error(`Resend API error: ${errorData.message || emailResponse.statusText}`);
    }

    const emailResult = await emailResponse.json();
    console.log("[test-email-send] Email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: emailResult.id,
        to,
        from: fromEmail,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("[test-email-send] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
