import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Get integrations
    let query = supabase
      .from("workspace_integrations")
      .select("id, provider, public_config, status, last_checked_at, last_error, created_at, updated_at");

    if (provider) {
      query = query.eq("provider", provider);
    }

    const { data: integrations, error } = await query;

    if (error) {
      throw error;
    }

    // Format response (never expose encrypted_secrets)
    const formatted = (integrations || []).map(int => ({
      id: int.id,
      provider: int.provider,
      public_config: int.public_config,
      status: int.status,
      is_configured: int.status === "active",
      last_checked_at: int.last_checked_at,
      last_error: int.last_error,
      created_at: int.created_at,
      updated_at: int.updated_at,
    }));

    if (provider) {
      return new Response(JSON.stringify(formatted[0] || { 
        provider, 
        is_configured: false,
        status: "not_configured" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ integrations: formatted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[integration-status] Error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
