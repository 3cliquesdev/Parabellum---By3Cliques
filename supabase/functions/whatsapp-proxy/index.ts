import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProxyRequest {
  instance_id: string;
  endpoint: string; // e.g., "/instance/fetchInstances" or "/instance/connect/instanceName"
  method?: "GET" | "POST" | "PUT" | "DELETE";
  data?: any;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instance_id, endpoint, method = "GET", data }: ProxyRequest = await req.json();
    
    console.log('[whatsapp-proxy] Request:', { instance_id, endpoint, method });
    
    // Buscar credenciais da instância no banco
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: instance, error: fetchError } = await supabase
      .from("whatsapp_instances")
      .select("api_url, api_token")
      .eq("id", instance_id)
      .single();

    if (fetchError || !instance) {
      console.error('[whatsapp-proxy] Instance not found:', fetchError);
      throw new Error("Instance not found");
    }

    // Normalizar a URL base
    let baseUrl = instance.api_url;
    if (baseUrl.includes('/manager')) {
      baseUrl = baseUrl.split('/manager')[0];
    }
    baseUrl = baseUrl.replace(/\/$/, '');

    const apiToken = instance.api_token.trim();
    
    // Construir URL completa
    const fullUrl = `${baseUrl}${endpoint}`;
    console.log('[whatsapp-proxy] Proxying to:', fullUrl);

    // Fazer a requisição para a Evolution API
    const response = await fetch(fullUrl, {
      method,
      headers: {
        "apikey": apiToken,
        "Content-Type": "application/json",
      },
      ...(data && method !== "GET" ? { body: JSON.stringify(data) } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[whatsapp-proxy] Evolution API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Evolution API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[whatsapp-proxy] Success');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[whatsapp-proxy] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
