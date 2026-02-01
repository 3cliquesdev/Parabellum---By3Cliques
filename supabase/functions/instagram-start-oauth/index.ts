import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to get Instagram secrets from encrypted storage or env fallback
async function getInstagramSecrets(supabaseUrl: string, serviceRoleKey: string): Promise<{
  appId: string;
  appSecret: string;
}> {
  // Try to get from encrypted storage first
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/integration-decrypt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": serviceRoleKey,
      },
      body: JSON.stringify({ provider: "instagram" }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.secrets) {
        console.log("[instagram-start-oauth] Using encrypted credentials");
        return {
          appId: data.secrets.app_id,
          appSecret: data.secrets.app_secret,
        };
      }
    }
  } catch (e) {
    console.log("[instagram-start-oauth] Encrypted storage not available, using env");
  }

  // Fallback to environment variables
  return {
    appId: Deno.env.get("FACEBOOK_APP_ID") || "",
    appSecret: Deno.env.get("FACEBOOK_APP_SECRET") || "",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const secrets = await getInstagramSecrets(supabaseUrl, serviceRoleKey);

    if (!secrets.appId) {
      console.error("[instagram-start-oauth] Missing FACEBOOK_APP_ID");
      return new Response(JSON.stringify({ 
        error: "configuration_missing",
        message: "Instagram não está configurado. Configure as credenciais em Configurações → Integrações → Instagram." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/instagram-oauth-callback`;

    const scope = [
      "instagram_basic",
      "instagram_manage_comments",
      "instagram_manage_messages",
      "pages_read_engagement",
      "pages_show_list",
      "business_management"
    ].join(",");

    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?` +
      `client_id=${secrets.appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${scope}` +
      `&response_type=code`;

    console.log("[instagram-start-oauth] Generated auth URL");

    return new Response(
      JSON.stringify({ authUrl }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("[instagram-start-oauth] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao gerar URL de autenticação" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
