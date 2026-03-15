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

    const { provider, secrets, public_config, workspace_id } = await req.json();

    if (!provider) {
      return new Response(JSON.stringify({ error: "Missing provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetWorkspaceId = workspace_id || "00000000-0000-0000-0000-000000000001";

    // Build update/insert data
    const updateData: Record<string, unknown> = {
      workspace_id: targetWorkspaceId,
      provider,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    // Only update public_config if provided
    if (public_config !== undefined) {
      updateData.public_config = public_config;
    }

    // Only encrypt and update secrets if provided
    if (secrets && Object.keys(secrets).length > 0) {
      const key = await deriveKey(masterKey);
      updateData.encrypted_secrets = await encrypt(JSON.stringify(secrets), key);
      updateData.status = "active";
    }

    // Upsert integration
    const { data, error } = await supabase
      .from("workspace_integrations")
      .upsert(updateData, {
        onConflict: "workspace_id,provider",
      })
      .select()
      .single();

    if (error) {
      console.error("[integrations-set] Error saving:", error);
      throw error;
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "integration_updated",
      table_name: "workspace_integrations",
      record_id: data.id,
      new_data: {
        provider,
        workspace_id: targetWorkspaceId,
        has_secrets: !!secrets,
        has_public_config: !!public_config,
      },
    });

    console.log(`[integrations-set] Saved integration for ${provider}`);

    return new Response(JSON.stringify({ 
      success: true, 
      integration_id: data.id,
      provider,
      status: data.status,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[integrations-set] Error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
