import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiagnosticResult {
  instance: {
    id: string;
    phone_number_id: string;
    stored_waba_id: string;
  };
  phone_number: {
    id: string;
    display: string;
    verified_name: string;
    actual_waba_id: string;
  } | null;
  waba: {
    id: string;
    name: string;
  } | null;
  subscribed_apps: Array<{
    id: string;
    name: string;
    link: string;
  }>;
  issues: string[];
  fix_needed: boolean;
  correct_waba_id: string | null;
  token_valid: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bodyText = await req.text();
    const body = bodyText ? JSON.parse(bodyText) : {};
    
    // Handler de warmup rápido
    if (body.warmup) {
      console.log('[diagnose-meta-whatsapp] 🔥 Warmup ping received');
      return new Response(
        JSON.stringify({ status: 'warm', timestamp: new Date().toISOString() }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { instance_id } = body;

    console.log(`[diagnose-meta-whatsapp] 🔍 Starting diagnostic for instance: ${instance_id}`);

    // Buscar instância
    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_meta_instances")
      .select("*")
      .eq("id", instance_id)
      .single();

    if (instanceError || !instance) {
      console.error("[diagnose-meta-whatsapp] ❌ Instance not found:", instanceError);
      return new Response(
        JSON.stringify({ error: "Instance not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result: DiagnosticResult = {
      instance: {
        id: instance.id,
        phone_number_id: instance.phone_number_id,
        stored_waba_id: instance.business_account_id,
      },
      phone_number: null,
      waba: null,
      subscribed_apps: [],
      issues: [],
      fix_needed: false,
      correct_waba_id: null,
      token_valid: false,
    };

    const apiVersion = "v21.0";
    const accessToken = instance.access_token;

    // 1. Consultar Phone Number para descobrir o WABA correto
    console.log(`[diagnose-meta-whatsapp] 📞 Querying phone number: ${instance.phone_number_id}`);
    
    const phoneResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${instance.phone_number_id}?fields=display_phone_number,verified_name,id`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const phoneData = await phoneResponse.json();
    console.log(`[diagnose-meta-whatsapp] 📞 Phone number response:`, JSON.stringify(phoneData));

    if (phoneData.error) {
      result.issues.push(`Token error on phone_number query: ${phoneData.error.message}`);
      result.token_valid = false;
    } else {
      result.token_valid = true;
      result.phone_number = {
        id: phoneData.id,
        display: phoneData.display_phone_number || "Unknown",
        verified_name: phoneData.verified_name || "Unknown",
        actual_waba_id: "",
      };
    }

    // 2. Descobrir WABA via /debug_token para ver permissões
    console.log(`[diagnose-meta-whatsapp] 🔑 Checking token permissions...`);
    
    const debugTokenResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/debug_token?input_token=${accessToken}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const debugTokenData = await debugTokenResponse.json();
    console.log(`[diagnose-meta-whatsapp] 🔑 Debug token response:`, JSON.stringify(debugTokenData));

    const tokenScopes = debugTokenData.data?.scopes || [];
    const hasBusinessManagement = tokenScopes.includes("whatsapp_business_management");
    const hasBusinessMessaging = tokenScopes.includes("whatsapp_business_messaging");
    
    if (!hasBusinessManagement) {
      result.issues.push(`Token missing 'whatsapp_business_management' permission. Has: ${tokenScopes.join(", ")}`);
    }
    if (!hasBusinessMessaging) {
      result.issues.push(`Token missing 'whatsapp_business_messaging' permission. Has: ${tokenScopes.join(", ")}`);
    }

    // 3. Tentar listar WABAs associados ao token via business endpoint
    console.log(`[diagnose-meta-whatsapp] 🏢 Listing WABAs accessible by this token...`);
    
    // Primeiro descobrir o business ID do token
    const meResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/me?fields=id,name`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const meData = await meResponse.json();
    console.log(`[diagnose-meta-whatsapp] 👤 Token user/app:`, JSON.stringify(meData));

    // Se o token for de System User, buscar WABAs do business
    const granularScopes = debugTokenData.data?.granular_scopes || [];
    let discoveredWabaId: string | null = null;
    
    for (const scope of granularScopes) {
      if (scope.permission === "whatsapp_business_messaging" && scope.target_ids) {
        console.log(`[diagnose-meta-whatsapp] 🎯 Found WABA IDs in granular scopes:`, scope.target_ids);
        if (scope.target_ids.length > 0) {
          discoveredWabaId = scope.target_ids[0];
          result.correct_waba_id = discoveredWabaId;
          
          if (discoveredWabaId !== instance.business_account_id) {
            result.issues.push(`WABA ID mismatch! Stored: ${instance.business_account_id}, Token has access to: ${discoveredWabaId}`);
            result.fix_needed = true;
          }
        }
      }
      if (scope.permission === "whatsapp_business_management" && scope.target_ids) {
        console.log(`[diagnose-meta-whatsapp] 🎯 Found WABA IDs in management scope:`, scope.target_ids);
      }
    }

    // 2. Descobrir o WABA ID correto a partir do Phone Number
    // Usar endpoint que retorna o WABA associado ao phone number
    console.log(`[diagnose-meta-whatsapp] 🔗 Discovering WABA for phone number...`);
    
    const wabaDiscoveryResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${instance.phone_number_id}?fields=whatsapp_business_account`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const wabaDiscoveryData = await wabaDiscoveryResponse.json();
    console.log(`[diagnose-meta-whatsapp] 🔗 WABA discovery response:`, JSON.stringify(wabaDiscoveryData));

    let actualWabaId: string | null = null;

    if (wabaDiscoveryData.whatsapp_business_account) {
      actualWabaId = wabaDiscoveryData.whatsapp_business_account.id;
      if (result.phone_number) {
        result.phone_number.actual_waba_id = actualWabaId || "";
      }

      // Comparar com o WABA armazenado
      if (actualWabaId !== instance.business_account_id) {
        result.issues.push(
          `WABA ID mismatch! Stored: ${instance.business_account_id}, Actual: ${actualWabaId}`
        );
        result.fix_needed = true;
        result.correct_waba_id = actualWabaId;
      }
    } else if (wabaDiscoveryData.error) {
      result.issues.push(`Cannot discover WABA: ${wabaDiscoveryData.error.message}`);
    }

    // 3. Consultar o WABA (usando o ID correto descoberto ou o armazenado)
    const wabaIdToQuery = actualWabaId || instance.business_account_id;
    console.log(`[diagnose-meta-whatsapp] 🏢 Querying WABA: ${wabaIdToQuery}`);

    const wabaResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${wabaIdToQuery}?fields=name,id`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const wabaData = await wabaResponse.json();
    console.log(`[diagnose-meta-whatsapp] 🏢 WABA response:`, JSON.stringify(wabaData));

    if (wabaData.error) {
      result.issues.push(`Cannot access WABA ${wabaIdToQuery}: ${wabaData.error.message}`);
    } else {
      result.waba = {
        id: wabaData.id,
        name: wabaData.name || "Unknown",
      };
    }

    // 4. Listar Apps subscritos ao WABA
    console.log(`[diagnose-meta-whatsapp] 📱 Listing subscribed apps for WABA: ${wabaIdToQuery}`);

    const appsResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${wabaIdToQuery}/subscribed_apps`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const appsData = await appsResponse.json();
    console.log(`[diagnose-meta-whatsapp] 📱 Subscribed apps response:`, JSON.stringify(appsData));

    if (appsData.data && Array.isArray(appsData.data)) {
      result.subscribed_apps = appsData.data.map((app: any) => ({
        id: app.whatsapp_business_api_data?.id || app.id || "Unknown",
        name: app.whatsapp_business_api_data?.name || app.name || "Unknown",
        link: app.whatsapp_business_api_data?.link || app.link || "",
      }));

      if (result.subscribed_apps.length === 0) {
        result.issues.push("No apps subscribed to this WABA. Need to call subscribe endpoint.");
      }
    } else if (appsData.error) {
      result.issues.push(`Cannot list subscribed apps: ${appsData.error.message}`);
    }

    // 5. Resumo final
    console.log(`[diagnose-meta-whatsapp] ✅ Diagnostic complete:`, JSON.stringify(result, null, 2));

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[diagnose-meta-whatsapp] ❌ Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
