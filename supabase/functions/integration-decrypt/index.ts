import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AES-GCM decryption using Web Crypto API
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const masterKey = Deno.env.get("INTEGRATIONS_MASTER_KEY");
    if (!masterKey) {
      throw new Error("INTEGRATIONS_MASTER_KEY not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // This function is internal-only (called by other edge functions)
    // Check for internal service header or valid auth
    const internalKey = req.headers.get("X-Internal-Key");
    const authHeader = req.headers.get("Authorization");

    let isAuthorized = false;

    // Check internal key (for edge function to edge function calls)
    if (internalKey === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      isAuthorized = true;
    }

    // Or check user auth with admin role
    if (!isAuthorized && authHeader) {
      const { data: { user } } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );

      if (user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        isAuthorized = roles?.some(r => r.role === "admin") || false;
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { provider } = await req.json();

    if (!provider) {
      return new Response(JSON.stringify({ error: "Missing provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get integration
    const { data: integration, error } = await supabase
      .from("workspace_integrations")
      .select("*")
      .eq("provider", provider)
      .eq("status", "active")
      .single();

    if (error || !integration) {
      return new Response(JSON.stringify({ 
        error: "Integration not found",
        configured: false 
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decrypt secrets
    const key = await deriveKey(masterKey);
    const decryptedSecrets = await decrypt(integration.encrypted_secrets, key);
    const secrets = JSON.parse(decryptedSecrets);

    console.log(`[integration-decrypt] Decrypted secrets for ${provider}`);

    return new Response(JSON.stringify({ 
      success: true,
      secrets,
      public_config: integration.public_config,
      status: integration.status,
      last_checked_at: integration.last_checked_at
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[integration-decrypt] Error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
