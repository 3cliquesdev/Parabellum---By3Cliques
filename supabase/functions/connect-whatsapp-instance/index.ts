import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    
    console.log('[connect-whatsapp-instance] Processing instance:', instance_id);
    
    // Buscar instância no banco com service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: instance, error: fetchError } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("id", instance_id)
      .single();

    if (fetchError || !instance) {
      console.error('[connect-whatsapp-instance] Instance not found:', fetchError);
      throw new Error("Instance not found");
    }

    console.log('[connect-whatsapp-instance] Instance data:', {
      name: instance.name,
      api_url: instance.api_url,
      instance_name: instance.instance_name
    });

    // Chamar Evolution API (server-side, sem CORS)
    const evolutionUrl = `${instance.api_url}/instance/create`;
    console.log('[connect-whatsapp-instance] Calling Evolution API:', evolutionUrl);

    const response = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "apikey": instance.api_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instanceName: instance.instance_name,
        qrcode: true,
        webhook: {
          enabled: true,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[connect-whatsapp-instance] Evolution API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Failed to create instance: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[connect-whatsapp-instance] Evolution API response:', result);

    // Atualizar QR Code no banco
    if (result.qrcode?.base64) {
      const { error: updateError } = await supabase
        .from("whatsapp_instances")
        .update({
          qr_code_base64: result.qrcode.base64,
          status: "qr_pending",
        })
        .eq("id", instance_id);

      if (updateError) {
        console.error('[connect-whatsapp-instance] Failed to update QR code:', updateError);
      } else {
        console.log('[connect-whatsapp-instance] QR code updated successfully');
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[connect-whatsapp-instance] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
