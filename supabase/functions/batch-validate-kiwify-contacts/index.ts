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

    console.log("[batch-validate] Iniciando validação em massa de contatos Kiwify...");

    // Executa a função RPC que faz o UPDATE em massa
    const { data, error } = await supabaseClient.rpc('batch_validate_kiwify_contacts');

    if (error) {
      console.error("[batch-validate] Erro ao executar RPC:", error);
      throw error;
    }

    console.log(`[batch-validate] ✅ Contatos atualizados: ${data}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Validação em massa concluída`,
        updated_count: data 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[batch-validate] Erro:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
