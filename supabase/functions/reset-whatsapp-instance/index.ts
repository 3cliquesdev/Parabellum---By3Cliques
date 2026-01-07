import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instance_id } = await req.json();
    
    console.log('[reset-whatsapp-instance] Hard reset initiated for:', instance_id);
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: instance, error: fetchError } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("id", instance_id)
      .single();

    if (fetchError || !instance) {
      console.error('[reset-whatsapp-instance] Instance not found:', fetchError);
      throw new Error("Instance not found");
    }

    let baseUrl = instance.api_url;
    if (baseUrl.includes('/manager')) {
      baseUrl = baseUrl.split('/manager')[0];
    }
    baseUrl = baseUrl.replace(/\/$/, '');
    const apiToken = instance.api_token.trim();

    console.log('[reset-whatsapp-instance] Step 1: Logout instance');
    try {
      const logoutUrl = `${baseUrl}/instance/logout/${encodeURIComponent(instance.instance_name)}`;
      const logoutResponse = await fetch(logoutUrl, {
        method: "DELETE",
        headers: { "apikey": apiToken },
      });
      
      if (logoutResponse.ok) {
        console.log('[reset-whatsapp-instance] ✅ Logout successful');
      } else {
        console.warn('[reset-whatsapp-instance] ⚠️ Logout failed (may not exist)');
      }
    } catch (e) {
      console.warn('[reset-whatsapp-instance] ⚠️ Logout error (continuing):', e);
    }

    console.log('[reset-whatsapp-instance] Step 2: Wait 2 seconds');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('[reset-whatsapp-instance] Step 3: Delete instance');
    try {
      const deleteUrl = `${baseUrl}/instance/delete/${encodeURIComponent(instance.instance_name)}`;
      const deleteResponse = await fetch(deleteUrl, {
        method: "DELETE",
        headers: { "apikey": apiToken },
      });
      
      if (deleteResponse.ok) {
        console.log('[reset-whatsapp-instance] ✅ Delete successful');
      } else {
        console.warn('[reset-whatsapp-instance] ⚠️ Delete failed (may not exist)');
      }
    } catch (e) {
      console.warn('[reset-whatsapp-instance] ⚠️ Delete error (continuing):', e);
    }

    console.log('[reset-whatsapp-instance] Step 4: Clear database status');
    const { error: updateError } = await supabase
      .from("whatsapp_instances")
      .update({
        status: "disconnected",
        qr_code_base64: null,
        phone_number: null,
      })
      .eq("id", instance_id);

    if (updateError) {
      console.error('[reset-whatsapp-instance] Failed to clear DB:', updateError);
      throw new Error("Failed to clear database");
    }

    console.log('[reset-whatsapp-instance] ✅ Hard reset complete');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Instância resetada com sucesso" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[reset-whatsapp-instance] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
