import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/v135/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instance_id } = await req.json();
    
    console.log('[reconfigure-whatsapp-webhook] Processing instance:', instance_id);
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar instância no banco
    const { data: instance, error: fetchError } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("id", instance_id)
      .single();

    if (fetchError || !instance) {
      console.error('[reconfigure-whatsapp-webhook] Instance not found:', fetchError);
      throw new Error("Instância não encontrada");
    }

    // Normalizar a URL
    let baseUrl = instance.api_url;
    if (baseUrl.includes('/manager')) {
      baseUrl = baseUrl.split('/manager')[0];
    }
    baseUrl = baseUrl.replace(/\/$/, '');

    const apiToken = instance.api_token.trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const webhookUrl = `${supabaseUrl}/functions/v1/handle-whatsapp-event`;
    
    console.log('[reconfigure-whatsapp-webhook] Base URL:', baseUrl);
    console.log('[reconfigure-whatsapp-webhook] Webhook URL:', webhookUrl);
    console.log('[reconfigure-whatsapp-webhook] Instance name:', instance.instance_name);

    // Tentar configurar webhook com retries
    let lastError: string | null = null;
    let success = false;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[reconfigure-whatsapp-webhook] Attempt ${attempt}/3...`);
        
        const webhookSetUrl = `${baseUrl}/webhook/set/${encodeURIComponent(instance.instance_name)}`;
        console.log('[reconfigure-whatsapp-webhook] Calling:', webhookSetUrl);
        
        const response = await fetch(webhookSetUrl, {
          method: "POST",
          headers: {
            "apikey": apiToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: webhookUrl,
            enabled: true,
            events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT", "QRCODE_UPDATED"],
            webhook_by_events: false,
          }),
        });

        const responseText = await response.text();
        console.log('[reconfigure-whatsapp-webhook] Response status:', response.status);
        console.log('[reconfigure-whatsapp-webhook] Response body:', responseText);

        if (response.ok) {
          success = true;
          
          // Verificar configuração atual
          const verifyUrl = `${baseUrl}/webhook/find/${encodeURIComponent(instance.instance_name)}`;
          const verifyResponse = await fetch(verifyUrl, {
            method: "GET",
            headers: { "apikey": apiToken },
          });
          
          let currentConfig = null;
          if (verifyResponse.ok) {
            currentConfig = await verifyResponse.json();
            console.log('[reconfigure-whatsapp-webhook] Current webhook config:', currentConfig);
          }

          return new Response(JSON.stringify({
            success: true,
            message: "Webhook reconfigurado com sucesso!",
            webhookUrl,
            currentConfig,
            attempts: attempt,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        lastError = `HTTP ${response.status}: ${responseText}`;
        
        // Esperar antes de retry
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.error(`[reconfigure-whatsapp-webhook] Attempt ${attempt} failed:`, lastError);
        
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // Todas as tentativas falharam
    throw new Error(`Falha ao configurar webhook após 3 tentativas: ${lastError}`);

  } catch (error) {
    console.error("[reconfigure-whatsapp-webhook] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
