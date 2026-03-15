import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AES-GCM decryption
async function decrypt(ciphertext: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  return new TextDecoder().decode(decrypted);
}

async function deriveKey(masterKey: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(masterKey),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("lovable-integrations-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Helper to get Instagram secrets from encrypted storage
async function getInstagramSecrets(supabaseUrl: string, serviceRoleKey: string, masterKey: string): Promise<{
  appId: string;
  appSecret: string;
} | null> {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Get encrypted integration from DB
    const { data: integration, error } = await supabase
      .from("workspace_integrations")
      .select("*")
      .eq("provider", "instagram")
      .eq("workspace_id", "00000000-0000-0000-0000-000000000001")
      .single();

    if (error || !integration) {
      console.log("[instagram-start-oauth] No integration found:", error?.message);
      return null;
    }

    const integrationData = integration as { encrypted_secrets?: string };
    if (!integrationData.encrypted_secrets) {
      console.log("[instagram-start-oauth] No encrypted secrets found");
      return null;
    }

    // Decrypt secrets
    const key = await deriveKey(masterKey);
    const decrypted = await decrypt(integrationData.encrypted_secrets, key);
    const secrets = JSON.parse(decrypted);

    console.log("[instagram-start-oauth] Found encrypted secrets with keys:", Object.keys(secrets));

    return {
      appId: secrets.app_id || "",
      appSecret: secrets.app_secret || "",
    };
  } catch (e) {
    console.error("[instagram-start-oauth] Error getting secrets:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const masterKey = Deno.env.get("INTEGRATIONS_MASTER_KEY");

    // First try to get from encrypted storage
    let secrets: { appId: string; appSecret: string } | null = null;

    if (masterKey) {
      secrets = await getInstagramSecrets(supabaseUrl, serviceRoleKey, masterKey);
    }

    // Fallback to environment variables if not found
    if (!secrets || !secrets.appId) {
      console.log("[instagram-start-oauth] Fallback to env vars");
      secrets = {
        appId: Deno.env.get("FACEBOOK_APP_ID") || "",
        appSecret: Deno.env.get("FACEBOOK_APP_SECRET") || "",
      };
    }

    if (!secrets.appId) {
      console.error("[instagram-start-oauth] Missing FACEBOOK_APP_ID in both DB and env");
      return new Response(JSON.stringify({ 
        error: "configuration_missing",
        message: "Instagram não está configurado. Configure as credenciais em Painel Super Admin → Credenciais Globais → Instagram." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[instagram-start-oauth] Using App ID:", secrets.appId.slice(0, 6) + "...");

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

    console.log("[instagram-start-oauth] Generated auth URL successfully");

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
