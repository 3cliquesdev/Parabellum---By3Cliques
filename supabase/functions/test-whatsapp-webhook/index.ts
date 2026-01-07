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
    
    console.log('[test-whatsapp-webhook] Testing webhook for instance:', instance_id);
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar instância
    const { data: instance, error: fetchError } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("id", instance_id)
      .single();

    if (fetchError || !instance) {
      throw new Error("Instância não encontrada");
    }

    // Normalizar URL
    let baseUrl = instance.api_url;
    if (baseUrl.includes('/manager')) {
      baseUrl = baseUrl.split('/manager')[0];
    }
    baseUrl = baseUrl.replace(/\/$/, '');
    
    const apiToken = instance.api_token.trim();
    const diagnostics: any = {
      instanceId: instance_id,
      instanceName: instance.instance_name,
      instanceStatus: instance.status,
      checks: [],
    };

    // CHECK 1: Verificar configuração do webhook na Evolution API
    console.log('[test-whatsapp-webhook] Check 1: Webhook configuration');
    try {
      const webhookFindUrl = `${baseUrl}/webhook/find/${encodeURIComponent(instance.instance_name)}`;
      const webhookResponse = await fetch(webhookFindUrl, {
        method: "GET",
        headers: { "apikey": apiToken },
      });
      
      if (webhookResponse.ok) {
        const webhookConfig = await webhookResponse.json();
        const expectedUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-whatsapp-event`;
        const isCorrectUrl = webhookConfig?.url === expectedUrl || webhookConfig?.webhook?.url === expectedUrl;
        const isEnabled = webhookConfig?.enabled === true || webhookConfig?.webhook?.enabled === true;
        
        diagnostics.checks.push({
          name: "Webhook Configuration",
          status: isCorrectUrl && isEnabled ? "pass" : "fail",
          details: {
            configuredUrl: webhookConfig?.url || webhookConfig?.webhook?.url || "Não configurado",
            expectedUrl,
            isCorrectUrl,
            isEnabled,
            events: webhookConfig?.events || webhookConfig?.webhook?.events || [],
          },
        });
        
        diagnostics.webhookConfig = webhookConfig;
      } else {
        diagnostics.checks.push({
          name: "Webhook Configuration",
          status: "fail",
          details: {
            error: `HTTP ${webhookResponse.status}`,
            message: "Não foi possível obter configuração do webhook",
          },
        });
      }
    } catch (e) {
      diagnostics.checks.push({
        name: "Webhook Configuration",
        status: "error",
        details: { error: e instanceof Error ? e.message : String(e) },
      });
    }

    // CHECK 2: Verificar estado da conexão WhatsApp
    console.log('[test-whatsapp-webhook] Check 2: Connection state');
    try {
      const stateUrl = `${baseUrl}/instance/connectionState/${encodeURIComponent(instance.instance_name)}`;
      const stateResponse = await fetch(stateUrl, {
        method: "GET",
        headers: { "apikey": apiToken },
      });
      
      if (stateResponse.ok) {
        const stateData = await stateResponse.json();
        const isConnected = stateData?.instance?.state === 'open' || stateData?.state === 'open';
        
        diagnostics.checks.push({
          name: "WhatsApp Connection",
          status: isConnected ? "pass" : "warn",
          details: {
            state: stateData?.instance?.state || stateData?.state || "unknown",
            isConnected,
            raw: stateData,
          },
        });
        
        diagnostics.connectionState = stateData;
      } else {
        diagnostics.checks.push({
          name: "WhatsApp Connection",
          status: "fail",
          details: { error: `HTTP ${stateResponse.status}` },
        });
      }
    } catch (e) {
      diagnostics.checks.push({
        name: "WhatsApp Connection",
        status: "error",
        details: { error: e instanceof Error ? e.message : String(e) },
      });
    }

    // CHECK 3: Contar mensagens recentes no banco
    console.log('[test-whatsapp-webhook] Check 3: Recent messages');
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { count: recentMessages } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", oneDayAgo);
      
      const { count: instanceConversations } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("whatsapp_instance_id", instance_id);
      
      diagnostics.checks.push({
        name: "Database Messages",
        status: (recentMessages || 0) > 0 ? "pass" : "warn",
        details: {
          messagesLast24h: recentMessages || 0,
          conversationsForInstance: instanceConversations || 0,
          note: recentMessages === 0 ? "Nenhuma mensagem nas últimas 24h - webhook pode não estar funcionando" : "Mensagens chegando normalmente",
        },
      });
    } catch (e) {
      diagnostics.checks.push({
        name: "Database Messages",
        status: "error",
        details: { error: e instanceof Error ? e.message : String(e) },
      });
    }

    // CHECK 4: Verificar Edge Function logs (últimas invocações)
    console.log('[test-whatsapp-webhook] Check 4: Edge function health');
    diagnostics.checks.push({
      name: "Edge Function",
      status: "info",
      details: {
        functionUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-whatsapp-event`,
        note: "Verifique os logs da Edge Function para erros específicos",
      },
    });

    // Calcular resultado geral
    const hasFailure = diagnostics.checks.some((c: any) => c.status === "fail");
    const hasWarning = diagnostics.checks.some((c: any) => c.status === "warn");
    
    diagnostics.overallStatus = hasFailure ? "fail" : hasWarning ? "warn" : "pass";
    diagnostics.summary = hasFailure 
      ? "❌ Problemas críticos encontrados - webhook provavelmente não está funcionando"
      : hasWarning 
      ? "⚠️ Possíveis problemas - verifique os detalhes"
      : "✅ Webhook parece estar configurado corretamente";

    return new Response(JSON.stringify(diagnostics), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[test-whatsapp-webhook] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
