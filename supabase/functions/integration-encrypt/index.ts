import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AES-GCM encryption using Web Crypto API
async function encrypt(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(plaintext);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encodedText
  );

  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  return btoa(String.fromCharCode(...combined));
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

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some(r => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { provider, secrets, public_config } = await req.json();

    if (!provider || !secrets) {
      return new Response(JSON.stringify({ error: "Missing provider or secrets" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Encrypt secrets
    const key = await deriveKey(masterKey);
    const encryptedSecrets = await encrypt(JSON.stringify(secrets), key);

    // Get or create workspace (using first available)
    const { data: existingIntegration } = await supabase
      .from("workspace_integrations")
      .select("id, workspace_id")
      .eq("provider", provider)
      .single();

    let workspaceId = existingIntegration?.workspace_id;

    if (!workspaceId) {
      // Use a default workspace ID or create one
      workspaceId = "00000000-0000-0000-0000-000000000001";
    }

    // Upsert integration
    const { data, error } = await supabase
      .from("workspace_integrations")
      .upsert({
        workspace_id: workspaceId,
        provider,
        encrypted_secrets: encryptedSecrets,
        public_config: public_config || {},
        status: "active",
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "workspace_id,provider",
      })
      .select()
      .single();

    if (error) {
      console.error("[integration-encrypt] Error saving:", error);
      throw error;
    }

    console.log(`[integration-encrypt] Saved encrypted secrets for ${provider}`);

    return new Response(JSON.stringify({ 
      success: true, 
      integration_id: data.id,
      provider 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[integration-encrypt] Error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
