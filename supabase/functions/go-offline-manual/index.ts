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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { agentId } = await req.json();

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: "agentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[go-offline-manual] 🔴 Agent ${agentId} going offline manually`);

    // 1. Buscar informações do agente
    const { data: agent, error: agentError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      console.error("[go-offline-manual] Agent not found:", agentError);
      return new Response(
        JSON.stringify({ error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Buscar todas as conversas abertas desse agente
    const { data: conversations, error: convError } = await supabaseAdmin
      .from("conversations")
      .select("id, contact_id, channel, whatsapp_instance_id, ai_mode")
      .eq("assigned_to", agentId)
      .eq("status", "open");

    if (convError) {
      console.error("[go-offline-manual] Error fetching conversations:", convError);
      throw convError;
    }

    console.log(`[go-offline-manual] Agent has ${conversations?.length || 0} active conversations`);

    // CONTRATO v2.2 §1: Mudar status NUNCA encerra conversas
    // CONTRATO v2.2 §7: Conversas NÃO são redistribuídas automaticamente
    // Comportamento: apenas desatribuir e mover para fila humana

    let movedToQueue = 0;

    // 3. Para cada conversa: mover para waiting_human (NÃO fechar, NÃO enviar CSAT)
    for (const conv of conversations || []) {
      try {
        // §1 e §7: Apenas desatribuir e mover para fila humana
        // NÃO fechar, NÃO enviar CSAT (CSAT só em fechamento explícito - §8)
        await supabaseAdmin
          .from("conversations")
          .update({ 
            assigned_to: null,
            previous_agent_id: agentId,
            // Preservar copilot/disabled como waiting_human para não dar à IA
            ai_mode: "waiting_human",
            dispatch_status: "pending",
          })
          .eq("id", conv.id);

        // Adicionar à fila de distribuição
        await supabaseAdmin.from("conversation_dispatch_jobs").upsert({
          conversation_id: conv.id,
          status: "pending",
          priority: 1,
          created_at: new Date().toISOString(),
        }, { onConflict: "conversation_id" });

        // Mensagem de sistema informando que agente saiu
        await supabaseAdmin.from("messages").insert({
          conversation_id: conv.id,
          content: `📤 ${agent.full_name} ficou offline. Aguardando próximo atendente disponível.`,
          sender_type: "system",
          channel: conv.channel,
        });

        movedToQueue++;
        console.log(`[go-offline-manual] ✅ Conversation ${conv.id} → waiting_human queue`);
      } catch (convProcessError) {
        console.error(`[go-offline-manual] Error processing conversation ${conv.id}:`, convProcessError);
      }
    }

    // 4. Marcar agente como offline (manual)
    await supabaseAdmin
      .from("profiles")
      .update({ 
        availability_status: "offline",
        manual_offline: true,
        last_status_change: new Date().toISOString(),
      })
      .eq("id", agentId);

    console.log(`[go-offline-manual] ✅ Agent ${agent.full_name} is now offline`);
    console.log(`[go-offline-manual] 📊 Conversations moved to queue: ${movedToQueue}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        agentName: agent.full_name,
        conversationsMovedToQueue: movedToQueue,
        // CONTRATO v2.2: Conversas permanecem abertas e na fila
        message: "Você está offline. Suas conversas permanecem abertas e aguardam redistribuição.",
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[go-offline-manual] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
