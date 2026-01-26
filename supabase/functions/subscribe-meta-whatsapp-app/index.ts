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

    const { instance_id } = await req.json();

    console.log(`[subscribe-meta-whatsapp-app] 🔗 Subscribing app for instance: ${instance_id}`);

    // Buscar instancia
    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_meta_instances")
      .select("*")
      .eq("id", instance_id)
      .single();

    if (instanceError || !instance) {
      console.error("[subscribe-meta-whatsapp-app] ❌ Instance not found:", instanceError);
      return new Response(
        JSON.stringify({ error: "Instance not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[subscribe-meta-whatsapp-app] 📞 WABA ID: ${instance.business_account_id}`);

    // Subscrever app ao WABA
    const apiVersion = "v21.0";
    const wabaId = instance.business_account_id;
    const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/subscribed_apps`;
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-whatsapp-webhook`;

    console.log(`[subscribe-meta-whatsapp-app] 📤 POST to: ${url}`);
    console.log(`[subscribe-meta-whatsapp-app] 🔗 Webhook URL: ${webhookUrl}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${instance.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        override_callback_uri: webhookUrl,
        verify_token: instance.verify_token,
      }),
    });

    const result = await response.json();

    console.log(`[subscribe-meta-whatsapp-app] 📥 Meta API response:`, JSON.stringify(result));

    if (!response.ok) {
      console.error(`[subscribe-meta-whatsapp-app] ❌ Subscription failed: ${response.status}`, result);
      return new Response(
        JSON.stringify({ error: result.error?.message || "Subscription failed", details: result }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[subscribe-meta-whatsapp-app] ✅ App subscribed successfully!");

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[subscribe-meta-whatsapp-app] ❌ Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
