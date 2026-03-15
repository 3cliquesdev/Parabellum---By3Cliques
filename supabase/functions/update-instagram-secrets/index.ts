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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated and is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      console.log("[update-instagram-secrets] Access denied for role:", roleData?.role);
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores podem atualizar credenciais." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { secrets } = await req.json();

    if (!secrets || typeof secrets !== "object") {
      return new Response(
        JSON.stringify({ error: "Dados inválidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allowedSecrets = [
      "FACEBOOK_APP_ID",
      "FACEBOOK_APP_SECRET",
      "INSTAGRAM_WEBHOOK_VERIFY_TOKEN",
    ];

    const updates: string[] = [];

    for (const [key, value] of Object.entries(secrets)) {
      if (!allowedSecrets.includes(key)) {
        console.log("[update-instagram-secrets] Ignoring unknown secret:", key);
        continue;
      }

      if (typeof value !== "string" || value.trim() === "") {
        continue;
      }

      // Store in system_configurations that this secret is configured
      const configKey = `instagram_${key.toLowerCase()}`;
      await supabase
        .from("system_configurations")
        .upsert({
          key: configKey,
          value: "configured",
          category: "secret",
          description: `Instagram secret: ${key}`,
        }, { onConflict: "key" });

      updates.push(key);
      console.log(`[update-instagram-secrets] Marked ${key} as configured`);
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "UPDATE",
      table_name: "instagram_secrets",
      new_data: { updated_secrets: updates },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${updates.length} credencial(is) atualizada(s)`,
        updated: updates,
        note: "Para que os secrets sejam efetivados, solicite a atualização via Lovable Cloud Secrets"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[update-instagram-secrets] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
