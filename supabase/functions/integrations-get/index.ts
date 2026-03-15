import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mask sensitive values showing only first 4 and last 4 chars
function maskSecret(value: string): string {
  if (!value || value.length < 12) {
    return "••••••••";
  }
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

// Mask all secrets in an object
function maskSecrets(secrets: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(secrets)) {
    masked[key] = maskSecret(value);
  }
  return masked;
}

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

    const url = new URL(req.url);
    const provider = url.searchParams.get("provider");
    const workspaceId = url.searchParams.get("workspace_id") || "00000000-0000-0000-0000-000000000001";

    let integrations: unknown;
    let error: unknown;

    if (provider) {
      const result = await supabase
        .from("workspace_integrations")
        .select("*")
        .eq("provider", provider)
        .eq("workspace_id", workspaceId)
        .single();
      integrations = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from("workspace_integrations")
        .select("*")
        .eq("workspace_id", workspaceId);
      integrations = result.data;
      error = result.error;
    }

    if (error && (error as any).code !== "PGRST116") {
      console.error("[integrations-get] Query error:", error);
      throw error;
    }

    // If no integration found for specific provider
    if (provider && !integrations) {
      return new Response(JSON.stringify({
        provider,
        workspace_id: workspaceId,
        is_configured: false,
        status: "not_configured",
        public_config: {},
        secrets_masked: {},
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if we need to decrypt and mask secrets
    const masterKey = Deno.env.get("INTEGRATIONS_MASTER_KEY");
    const key = masterKey ? await deriveKey(masterKey) : null;

    // Format response with masked secrets
    const formatIntegration = async (int: any) => {
      let secretsMasked: Record<string, string> = {};
      
      if (int.encrypted_secrets && key) {
        try {
          const decrypted = await decrypt(int.encrypted_secrets, key);
          const secrets = JSON.parse(decrypted);
          secretsMasked = maskSecrets(secrets);
        } catch (e) {
          console.error("[integrations-get] Decryption error:", e);
          secretsMasked = { error: "Decryption failed" };
        }
      }

      return {
        id: int.id,
        provider: int.provider,
        workspace_id: int.workspace_id,
        public_config: int.public_config || {},
        secrets_masked: secretsMasked,
        status: int.status,
        is_configured: int.status === "active",
        last_error: int.last_error,
        last_checked_at: int.last_checked_at,
        created_at: int.created_at,
        updated_at: int.updated_at,
      };
    };

    if (provider) {
      const formatted = await formatIntegration(integrations);
      return new Response(JSON.stringify(formatted), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Multiple integrations
    const integrationsArray = Array.isArray(integrations) ? integrations : [];
    const formatted = await Promise.all(integrationsArray.map(formatIntegration));

    return new Response(JSON.stringify({ integrations: formatted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[integrations-get] Error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
