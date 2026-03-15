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

// Test WhatsApp Meta API
async function testWhatsAppMeta(secrets: Record<string, string>): Promise<{ success: boolean; error?: string; details?: unknown }> {
  const { phone_number_id, access_token } = secrets;
  
  if (!phone_number_id || !access_token) {
    return { success: false, error: "Missing phone_number_id or access_token" };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phone_number_id}`,
      {
        headers: {
          "Authorization": `Bearer ${access_token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { 
        success: false, 
        error: error.error?.message || `HTTP ${response.status}`,
        details: error,
      };
    }

    const data = await response.json();
    return { 
      success: true, 
      details: {
        display_phone_number: data.display_phone_number,
        verified_name: data.verified_name,
        quality_rating: data.quality_rating,
      },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}

// Test Resend API
async function testEmailResend(secrets: Record<string, string>): Promise<{ success: boolean; error?: string; details?: unknown }> {
  const { api_key } = secrets;
  
  if (!api_key) {
    return { success: false, error: "Missing api_key" };
  }

  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: {
        "Authorization": `Bearer ${api_key}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return { 
        success: false, 
        error: error.message || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return { 
      success: true, 
      details: {
        domains_count: data.data?.length || 0,
        domains: data.data?.map((d: any) => d.name) || [],
      },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}

// Test Kiwify API (validate credentials via token endpoint)
async function testKiwify(secrets: Record<string, string>): Promise<{ success: boolean; error?: string; details?: unknown }> {
  const { client_id, client_secret } = secrets;
  
  if (!client_id || !client_secret) {
    return { success: false, error: "Missing client_id or client_secret" };
  }

  try {
    // Kiwify uses OAuth2 - try to get a token
    const response = await fetch("https://api.kiwify.com.br/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id,
        client_secret,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { 
        success: false, 
        error: error.error_description || error.message || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return { 
      success: true, 
      details: {
        token_type: data.token_type,
        expires_in: data.expires_in,
      },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}

// Test Instagram API (validate App ID via basic Graph API call)
async function testInstagram(secrets: Record<string, string>): Promise<{ success: boolean; error?: string; details?: unknown }> {
  const { app_id, app_secret } = secrets;
  
  if (!app_id) {
    return { success: false, error: "Missing app_id" };
  }

  try {
    // Get an app access token to validate credentials
    const tokenUrl = `https://graph.facebook.com/oauth/access_token?client_id=${app_id}&client_secret=${app_secret}&grant_type=client_credentials`;
    
    const response = await fetch(tokenUrl);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { 
        success: false, 
        error: error.error?.message || `HTTP ${response.status}`,
        details: error,
      };
    }

    const data = await response.json();
    
    return { 
      success: true, 
      details: {
        token_type: data.token_type || "bearer",
        app_configured: true,
      },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
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

    const { provider, workspace_id } = await req.json();

    if (!provider) {
      return new Response(JSON.stringify({ error: "Missing provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetWorkspaceId = workspace_id || "00000000-0000-0000-0000-000000000001";

    // Get integration
    const { data: integration, error } = await supabase
      .from("workspace_integrations")
      .select("*")
      .eq("provider", provider)
      .eq("workspace_id", targetWorkspaceId)
      .single();

    if (error || !integration) {
      return new Response(JSON.stringify({ 
        success: false,
        error: "Integration not configured",
        provider,
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decrypt secrets
    const key = await deriveKey(masterKey);
    let secrets: Record<string, string>;
    
    try {
      const decrypted = await decrypt(integration.encrypted_secrets, key);
      secrets = JSON.parse(decrypted);
    } catch (e) {
      return new Response(JSON.stringify({ 
        success: false,
        error: "Failed to decrypt credentials",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Test based on provider
    let result: { success: boolean; error?: string; details?: unknown };
    
    switch (provider) {
      case "whatsapp_meta":
        result = await testWhatsAppMeta(secrets);
        break;
      case "email_resend":
        result = await testEmailResend(secrets);
        break;
      case "kiwify":
        result = await testKiwify(secrets);
        break;
      case "instagram":
        result = await testInstagram(secrets);
        break;
      default:
        result = { success: false, error: `Unknown provider: ${provider}` };
    }

    // Update integration status
    await supabase
      .from("workspace_integrations")
      .update({
        status: result.success ? "active" : "error",
        last_error: result.success ? null : result.error,
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    console.log(`[integrations-test] Tested ${provider}: ${result.success ? "SUCCESS" : "FAILED"}`);

    return new Response(JSON.stringify({
      success: result.success,
      provider,
      error: result.error,
      details: result.details,
      tested_at: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[integrations-test] Error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
