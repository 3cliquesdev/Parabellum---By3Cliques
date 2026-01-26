import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { instance_id, action, code, method = "SMS", language = "pt_BR", pin } = await req.json();

    console.log(`[verify-meta-whatsapp-code] 📱 Action: ${action}, Instance: ${instance_id}`);

    // Buscar instancia
    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_meta_instances")
      .select("*")
      .eq("id", instance_id)
      .single();

    if (instanceError || !instance) {
      console.error("[verify-meta-whatsapp-code] ❌ Instance not found:", instanceError);
      return new Response(
        JSON.stringify({ error: "Instance not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiVersion = "v21.0";
    const phoneNumberId = instance.phone_number_id;
    const accessToken = instance.access_token;

    if (action === "request") {
      // Solicitar código de verificação
      const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/request_code`;
      
      console.log(`[verify-meta-whatsapp-code] 📤 Requesting code via ${method}: ${url}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code_method: method.toUpperCase(), // SMS ou VOICE
          language: language,
        }),
      });

      const result = await response.json();
      console.log(`[verify-meta-whatsapp-code] 📥 Request code response:`, JSON.stringify(result));

      if (!response.ok) {
        console.error(`[verify-meta-whatsapp-code] ❌ Request code failed: ${response.status}`, result);
        return new Response(
          JSON.stringify({ 
            error: result.error?.message || "Failed to request code", 
            details: result,
            code: result.error?.code 
          }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[verify-meta-whatsapp-code] ✅ Code requested successfully!");
      return new Response(
        JSON.stringify({ success: true, message: `Código enviado via ${method}`, result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "verify") {
      // Verificar código recebido
      if (!code) {
        return new Response(
          JSON.stringify({ error: "Code is required for verification" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/verify_code`;
      
      console.log(`[verify-meta-whatsapp-code] 📤 Verifying code: ${url}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: code,
        }),
      });

      const result = await response.json();
      console.log(`[verify-meta-whatsapp-code] 📥 Verify code response:`, JSON.stringify(result));

      if (!response.ok) {
        console.error(`[verify-meta-whatsapp-code] ❌ Verify code failed: ${response.status}`, result);
        return new Response(
          JSON.stringify({ 
            error: result.error?.message || "Failed to verify code", 
            details: result,
            code: result.error?.code 
          }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[verify-meta-whatsapp-code] ✅ Code verified! Now registering...");

      // Após verificar, registrar o número
      const registerUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/register`;
      
      const registerResponse = await fetch(registerUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          pin: pin || "123456", // PIN para 2FA
        }),
      });

      const registerResult = await registerResponse.json();
      console.log(`[verify-meta-whatsapp-code] 📥 Register response:`, JSON.stringify(registerResult));

      if (!registerResponse.ok) {
        console.error(`[verify-meta-whatsapp-code] ❌ Register failed: ${registerResponse.status}`, registerResult);
        return new Response(
          JSON.stringify({ 
            verified: true,
            registered: false,
            error: registerResult.error?.message || "Failed to register", 
            details: registerResult 
          }),
          { status: registerResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Atualizar status da instância
      await supabase
        .from("whatsapp_meta_instances")
        .update({ status: "connected" })
        .eq("id", instance_id);

      console.log("[verify-meta-whatsapp-code] ✅ Number registered successfully!");
      return new Response(
        JSON.stringify({ 
          success: true, 
          verified: true, 
          registered: true, 
          message: "Número verificado e registrado com sucesso!" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action. Use 'request' or 'verify'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[verify-meta-whatsapp-code] ❌ Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
