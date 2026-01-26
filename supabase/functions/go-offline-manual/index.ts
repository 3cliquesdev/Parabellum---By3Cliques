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
      .select("id, contact_id, channel, whatsapp_instance_id")
      .eq("assigned_to", agentId)
      .in("status", ["open", "pending"]);

    if (convError) {
      console.error("[go-offline-manual] Error fetching conversations:", convError);
      throw convError;
    }

    console.log(`[go-offline-manual] Agent has ${conversations?.length || 0} active conversations`);

    let csatSent = 0;
    let redistributed = 0;

    // 3. Buscar agentes online para redistribuição
    const { data: onlineAgents } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("availability_status", "online")
      .neq("id", agentId);

    let agentIndex = 0;

    // 4. Para cada conversa: enviar CSAT, fechar, redistribuir
    for (const conv of conversations || []) {
      try {
        // 4a. Enviar pesquisa CSAT via WhatsApp (se for canal WhatsApp)
        if (conv.channel === "whatsapp" && conv.whatsapp_instance_id) {
          // Buscar dados do contato
          const { data: contact } = await supabaseAdmin
            .from("contacts")
            .select("phone, whatsapp_id")
            .eq("id", conv.contact_id)
            .single();

          if (contact?.phone) {
            const csatMessage = `📊 *Pesquisa de Satisfação*\n\nSeu atendimento com *${agent.full_name}* foi encerrado.\n\nPor favor, avalie o atendimento de 1 a 5:\n\n1️⃣ Péssimo\n2️⃣ Ruim\n3️⃣ Regular\n4️⃣ Bom\n5️⃣ Excelente\n\n_Responda apenas com o número._`;

            try {
              await supabaseAdmin.functions.invoke("send-whatsapp-message", {
                body: {
                  instance_id: conv.whatsapp_instance_id,
                  phone_number: contact.phone,
                  whatsapp_id: contact.whatsapp_id,
                  message: csatMessage,
                },
              });

              // Marcar que está aguardando rating
              await supabaseAdmin
                .from("conversations")
                .update({ 
                  awaiting_rating: true,
                  rating_sent_at: new Date().toISOString(),
                })
                .eq("id", conv.id);

              csatSent++;
              console.log(`[go-offline-manual] ✅ CSAT sent for conversation ${conv.id}`);
            } catch (csatError) {
              console.error(`[go-offline-manual] ❌ Failed to send CSAT for ${conv.id}:`, csatError);
            }
          }
        }

        // 4b. Fechar a conversa
        await supabaseAdmin
          .from("conversations")
          .update({ 
            status: "closed",
            closed_at: new Date().toISOString(),
            closed_by: agentId,
          })
          .eq("id", conv.id);

        // 4c. Inserir mensagem de sistema
        await supabaseAdmin.from("messages").insert({
          conversation_id: conv.id,
          content: `📤 ${agent.full_name} encerrou o atendimento e ficou offline.`,
          sender_type: "system",
          channel: conv.channel,
        });

        // 4d. Redistribuir para outro agente (se houver)
        if (onlineAgents && onlineAgents.length > 0) {
          const targetAgent = onlineAgents[agentIndex % onlineAgents.length];
          
          // Reabrir conversa para novo agente
          await supabaseAdmin
            .from("conversations")
            .update({ 
              status: "open",
              assigned_to: targetAgent.id,
              previous_agent_id: agentId,
              ai_mode: "waiting_human",
              closed_at: null,
              closed_by: null,
            })
            .eq("id", conv.id);

          await supabaseAdmin.from("messages").insert({
            conversation_id: conv.id,
            content: `🔄 Conversa transferida para ${targetAgent.full_name}`,
            sender_type: "system",
            channel: conv.channel,
          });

          agentIndex++;
          redistributed++;
          console.log(`[go-offline-manual] 🔄 Conversation ${conv.id} → ${targetAgent.full_name}`);
        } else {
          // Nenhum agente online: verificar ai_mode antes de decidir destino
          // Se conversa estava em copilot/disabled, manter na fila humana
          const shouldKeepInHumanQueue = conv.channel === 'whatsapp' || 
            (await supabaseAdmin
              .from("conversations")
              .select("ai_mode")
              .eq("id", conv.id)
              .single()
              .then(res => res.data?.ai_mode === 'copilot' || res.data?.ai_mode === 'disabled'));
          
          await supabaseAdmin
            .from("conversations")
            .update({ 
              status: "pending",
              assigned_to: null,
              previous_agent_id: agentId,
              // Preserve copilot conversations for human queue, don't give to AI
              ai_mode: shouldKeepInHumanQueue ? "waiting_human" : "autopilot",
              closed_at: null,
              closed_by: null,
            })
            .eq("id", conv.id);

          // Adicionar à fila
          await supabaseAdmin.from("conversation_queue").upsert({
            conversation_id: conv.id,
            priority: 1,
            queued_at: new Date().toISOString(),
          }, { onConflict: "conversation_id" });

          await supabaseAdmin.from("messages").insert({
            conversation_id: conv.id,
            content: "🤖 Nenhum atendente disponível. A IA está pronta para ajudar.",
            sender_type: "system",
            channel: conv.channel,
          });

          redistributed++;
          console.log(`[go-offline-manual] 🤖 Conversation ${conv.id} → AI pool`);
        }
      } catch (convProcessError) {
        console.error(`[go-offline-manual] Error processing conversation ${conv.id}:`, convProcessError);
      }
    }

    // 5. Marcar agente como offline (manual)
    await supabaseAdmin
      .from("profiles")
      .update({ 
        availability_status: "offline",
        manual_offline: true,
        last_status_change: new Date().toISOString(),
      })
      .eq("id", agentId);

    console.log(`[go-offline-manual] ✅ Agent ${agent.full_name} is now offline`);
    console.log(`[go-offline-manual] 📊 CSAT sent: ${csatSent}, Redistributed: ${redistributed}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        agentName: agent.full_name,
        conversationsClosed: conversations?.length || 0,
        csatSent,
        redistributed,
        hasOnlineAgents: (onlineAgents?.length || 0) > 0,
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
