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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("[fix-leads-kiwify] Iniciando correção de leads que são clientes Kiwify...");

    const { data, error } = await supabaseClient.rpc('fix_leads_that_are_kiwify_customers');

    if (error) {
      console.error("[fix-leads-kiwify] Erro:", error);
      throw error;
    }

    const result = data?.[0] || { contacts_updated: 0, conversations_updated: 0 };
    
    console.log(`[fix-leads-kiwify] ✅ Contatos: ${result.contacts_updated}, Conversas: ${result.conversations_updated}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        contacts_updated: result.contacts_updated,
        conversations_updated: result.conversations_updated,
        message: `Corrigidos ${result.contacts_updated} contatos e ${result.conversations_updated} conversas`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[fix-leads-kiwify] ❌ Erro:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
