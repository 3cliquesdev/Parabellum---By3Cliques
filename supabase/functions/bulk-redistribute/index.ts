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

    const {
      conversationIds,
      destinationType,
      targetAgentId,
      targetDepartmentId,
      sendCsat,
      sourceAgentId,
    } = await req.json();

    console.log("[bulk-redistribute] Processing", conversationIds.length, "conversations");
    console.log("[bulk-redistribute] Destination type:", destinationType);
    console.log("[bulk-redistribute] Target department:", targetDepartmentId);
    console.log("[bulk-redistribute] Send CSAT:", sendCsat);

    if (!conversationIds || conversationIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "No conversation IDs provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar agentes online para distribuição automática ou por departamento
    let onlineAgents: string[] = [];
    let departmentOnlineAgents: string[] = [];

    // IMPORTANT: Roles elegíveis para auto-distribuição.
    // Consultores e financeiros NÃO devem receber conversas automaticamente.
    const AUTO_DISTRIBUTE_ROLES = [
      "support_agent",
      "sales_rep",
      "cs_manager",
      "support_manager",
      "manager",
      "general_manager",
      "admin",
    ];

    const { data: agentRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", AUTO_DISTRIBUTE_ROLES);

    const agentIds = [...new Set(agentRoles?.map((r) => r.user_id) || [])];

    if (destinationType === "auto") {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .in("id", agentIds)
        .eq("availability_status", "online")
        .neq("id", sourceAgentId);

      onlineAgents = profiles?.map((p) => p.id) || [];
      console.log("[bulk-redistribute] Online agents for auto distribution:", onlineAgents.length);
    }

    if (destinationType === "department" && targetDepartmentId) {
      const { data: deptProfiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("department", targetDepartmentId)
        .in("id", agentIds)
        .eq("availability_status", "online")
        .neq("id", sourceAgentId);

      departmentOnlineAgents = deptProfiles?.map((p) => p.id) || [];
      console.log("[bulk-redistribute] Online agents in department:", departmentOnlineAgents.length);
    }

    // Buscar dados das conversas
    const { data: conversations, error: convError } = await supabase
      .from("conversations")
      .select("id, contact_id, channel, whatsapp_instance_id")
      .in("id", conversationIds);

    if (convError) throw convError;

    // Buscar contatos separadamente
    const contactIds = conversations?.map((c) => c.contact_id).filter(Boolean) || [];
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, first_name, whatsapp_id")
      .in("id", contactIds);

    const contactMap = new Map((contacts || []).map((c) => [c.id, c]));

    let successCount = 0;
    let errorCount = 0;
    let agentIndex = 0;

    for (const conv of conversations || []) {
      try {
        const contact = contactMap.get(conv.contact_id);

        // Enviar CSAT se solicitado e for WhatsApp
        if (sendCsat && conv.channel === "whatsapp" && contact?.whatsapp_id && conv.whatsapp_instance_id) {
          console.log("[bulk-redistribute] Sending CSAT for conversation", conv.id);

          // Buscar instância WhatsApp
          const { data: instance } = await supabase
            .from("whatsapp_instances")
            .select("id, api_endpoint, api_token")
            .eq("id", conv.whatsapp_instance_id)
            .single();

          if (instance) {
            const csatMessage = `Olá ${contact.first_name || ""}! Como foi sua experiência conosco?\n\nResponda com um número de 1 a 5:\n⭐ 1 = Muito ruim\n⭐⭐ 2 = Ruim\n⭐⭐⭐ 3 = Regular\n⭐⭐⭐⭐ 4 = Bom\n⭐⭐⭐⭐⭐ 5 = Excelente\n\nSua opinião é muito importante para nós!`;

            try {
              const sendMessageUrl = `${instance.api_endpoint}/message/sendText/${instance.id}`;
              await fetch(sendMessageUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: instance.api_token,
                },
                body: JSON.stringify({
                  number: contact.whatsapp_id,
                  text: csatMessage,
                }),
              });

              // Marcar conversa como aguardando avaliação
              await supabase
                .from("conversations")
                .update({
                  awaiting_rating: true,
                  rating_sent_at: new Date().toISOString(),
                })
                .eq("id", conv.id);

              // Registrar mensagem no histórico
              await supabase.from("messages").insert({
                conversation_id: conv.id,
                content: csatMessage,
                sender_type: "system",
                channel: "whatsapp",
              });
            } catch (sendErr) {
              console.error("[bulk-redistribute] Error sending CSAT:", sendErr);
            }
          }
        }

        // Determinar novo assigned_to
        // 🆕 ROUND-ROBIN POR DEPARTAMENTO - Ignora sobrecarga, distribui uniformemente
        let newAssignedTo: string | null = null;
        let newAiMode = "copilot";

        switch (destinationType) {
          case "agent":
            newAssignedTo = targetAgentId;
            break;
          case "pool":
            newAssignedTo = null;
            newAiMode = "autopilot";
            break;
          case "auto":
            // Round-robin simples entre agentes online
            if (onlineAgents.length > 0) {
              newAssignedTo = onlineAgents[agentIndex % onlineAgents.length];
              agentIndex++;
              console.log(`[bulk-redistribute] Round-robin auto: assigned to agent ${agentIndex} of ${onlineAgents.length}`);
            } else {
              // Se não há agentes online, vai para pool
              newAssignedTo = null;
              newAiMode = "autopilot";
            }
            break;
          case "department":
            // 🆕 ROUND-ROBIN PURO POR DEPARTAMENTO
            // Se tem 1 agente, ele recebe tudo
            // Se tem 2+, distribui em round-robin sem considerar sobrecarga
            if (departmentOnlineAgents.length === 1) {
              // Único agente no departamento - recebe todas
              newAssignedTo = departmentOnlineAgents[0];
              console.log(`[bulk-redistribute] Single agent in department receives all`);
            } else if (departmentOnlineAgents.length > 1) {
              // 2+ agentes - round-robin rotativo
              newAssignedTo = departmentOnlineAgents[agentIndex % departmentOnlineAgents.length];
              agentIndex++;
              console.log(`[bulk-redistribute] Round-robin department: agent ${agentIndex % departmentOnlineAgents.length + 1} of ${departmentOnlineAgents.length}`);
            } else {
              // Nenhum agente online no departamento - vai para pool
              newAssignedTo = null;
              newAiMode = "autopilot";
              console.log("[bulk-redistribute] No online agents in department, sending to pool");
            }
            break;
        }

        // Atualizar conversa (incluindo department se for redistribuição por departamento)
        const updateData: Record<string, unknown> = {
          assigned_to: newAssignedTo,
          ai_mode: newAiMode,
          previous_agent_id: sourceAgentId,
        };
        
        if (destinationType === "department" && targetDepartmentId) {
          updateData.department = targetDepartmentId;
        }

        const { error: updateError } = await supabase
          .from("conversations")
          .update(updateData)
          .eq("id", conv.id);

        if (updateError) throw updateError;

        // Registrar mensagem de sistema
        await supabase.from("messages").insert({
          conversation_id: conv.id,
          content: newAssignedTo
            ? "Conversa redistribuída pelo gerente para outro atendente."
            : "Conversa redistribuída pelo gerente para o pool geral (IA).",
          sender_type: "system",
          channel: conv.channel,
        });

        // Remover da fila se estava lá
        await supabase
          .from("conversation_queue")
          .delete()
          .eq("conversation_id", conv.id);

        successCount++;
      } catch (err) {
        console.error("[bulk-redistribute] Error processing conversation", conv.id, err);
        errorCount++;
      }
    }

    console.log("[bulk-redistribute] Complete. Success:", successCount, "Errors:", errorCount);

    return new Response(
      JSON.stringify({
        success: true,
        successCount,
        errorCount,
        totalProcessed: conversationIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[bulk-redistribute] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
