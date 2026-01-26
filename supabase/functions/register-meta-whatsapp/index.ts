import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    const { instance_id, pin } = await req.json();

    console.log(`[register-meta-whatsapp] 📱 Registering instance: ${instance_id}`);

    // Buscar instancia
    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_meta_instances")
      .select("*")
      .eq("id", instance_id)
      .single();

    if (instanceError || !instance) {
      console.error("[register-meta-whatsapp] ❌ Instance not found:", instanceError);
      return new Response(
        JSON.stringify({ error: "Instance not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[register-meta-whatsapp] 📞 Phone Number ID: ${instance.phone_number_id}`);

    // Registrar numero na Meta
    const apiVersion = "v21.0";
    const url = `https://graph.facebook.com/${apiVersion}/${instance.phone_number_id}/register`;

    console.log(`[register-meta-whatsapp] 📤 Calling Meta API: ${url}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${instance.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        pin: pin || "123456", // PIN para 2FA
      }),
    });

    const result = await response.json();

    console.log(`[register-meta-whatsapp] 📥 Meta API response:`, JSON.stringify(result));

    if (!response.ok) {
      console.error(`[register-meta-whatsapp] ❌ Registration failed: ${response.status}`, result);
      return new Response(
        JSON.stringify({ error: result.error?.message || "Registration failed", details: result }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[register-meta-whatsapp] ✅ Registration successful!");

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[register-meta-whatsapp] ❌ Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
