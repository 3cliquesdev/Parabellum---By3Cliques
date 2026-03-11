import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Process Buffered Messages
 * 
 * Two modes:
 * A) CRON/SCAN mode (no conversationId): scans ALL conversations with pending messages
 * B) DIRECT mode (with conversationId): processes a specific conversation (legacy compat)
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // Empty body = cron mode
    }

    const { conversationId, triggerTimestamp, contactId, instanceId, fromNumber, flowContext, flowData: originalFlowData } = body as any;

    // ============================
    // MODE A: CRON/SCAN — no conversationId
    // ============================
    if (!conversationId) {
      console.log("[process-buffered-messages] 🔄 CRON SCAN mode — checking all pending buffers");

      // Get batch delay config
      let batchDelaySeconds = 8;
      try {
        const { data: batchConfig } = await supabase
          .from("system_configurations")
          .select("value")
          .eq("key", "ai_message_batch_delay_seconds")
          .maybeSingle();
        if (batchConfig?.value) {
          batchDelaySeconds = parseInt(batchConfig.value, 10) || 8;
        }
      } catch (e) {
        console.error("[process-buffered-messages] ⚠️ Error fetching batch config:", e);
      }

      // Find distinct conversations with unprocessed messages
      // where the newest message is older than batchDelaySeconds
      const cutoffTime = new Date(Date.now() - batchDelaySeconds * 1000).toISOString();

      const { data: pendingConversations, error: pendingErr } = await supabase
        .rpc("get_ready_buffer_conversations", { p_cutoff: cutoffTime });

      // If RPC doesn't exist yet, fallback to a manual query
      let conversationsToProcess: Array<{ conversation_id: string }> = [];

      if (pendingErr) {
        console.log("[process-buffered-messages] ⚠️ RPC fallback — using manual query");
        // Fallback: get all distinct conversation_ids with unprocessed messages
        const { data: rawPending } = await supabase
          .from("message_buffer")
          .select("conversation_id, created_at")
          .eq("processed", false)
          .lte("created_at", cutoffTime)
          .order("created_at", { ascending: true })
          .limit(500);

        if (rawPending && rawPending.length > 0) {
          // Deduplicate by conversation_id
          const seen = new Set<string>();
          for (const row of rawPending) {
            if (!seen.has(row.conversation_id)) {
              seen.add(row.conversation_id);
              conversationsToProcess.push({ conversation_id: row.conversation_id });
            }
          }
        }
      } else {
        conversationsToProcess = pendingConversations || [];
      }

      if (conversationsToProcess.length === 0) {
        console.log("[process-buffered-messages] ✅ No pending conversations to process");
        return new Response(
          JSON.stringify({ status: "ok", processed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[process-buffered-messages] 📋 Found ${conversationsToProcess.length} conversations to process`);

      let processedCount = 0;
      let errorCount = 0;

      for (const { conversation_id: convId } of conversationsToProcess) {
        try {
          // Advisory lock — skip if another worker is processing this conversation
          const { data: gotLock } = await supabase.rpc("try_lock_conversation_buffer", { conv_id: convId });
          if (gotLock === false) {
            console.log(`[process-buffered-messages] 🔒 Lock not acquired for ${convId} — skipping`);
            continue;
          }

          // Double-check: still has unprocessed messages after lock
          const { data: msgs, error: msgsErr } = await supabase
            .from("message_buffer")
            .select("id, message_content, created_at, contact_id, instance_id, from_number, flow_context, flow_data")
            .eq("conversation_id", convId)
            .eq("processed", false)
            .order("created_at", { ascending: true });

          if (msgsErr || !msgs || msgs.length === 0) {
            continue;
          }

          // Check newest message is old enough (re-verify after lock)
          const newestMsg = msgs[msgs.length - 1];
          const newestAge = (Date.now() - new Date(newestMsg.created_at).getTime()) / 1000;
          if (newestAge < batchDelaySeconds) {
            console.log(`[process-buffered-messages] ⏳ Conv ${convId}: newest msg is ${newestAge.toFixed(1)}s old < ${batchDelaySeconds}s — waiting`);
            continue;
          }

          // Concatenate messages
          const concatenatedMessage = msgs.map((m: any) => m.message_content).join("\n");
          console.log(`[process-buffered-messages] 📝 Conv ${convId}: ${msgs.length} msgs → "${concatenatedMessage.substring(0, 100)}..."`);

          // Get metadata from the first message that has it
          const metaMsg = msgs.find((m: any) => m.contact_id) || msgs[0];
          const effContactId = metaMsg.contact_id;
          const effInstanceId = metaMsg.instance_id;
          const effFromNumber = metaMsg.from_number;
          const effFlowContext = metaMsg.flow_context;
          const effFlowData = metaMsg.flow_data;

          // Fetch conversation state
          const { data: conversation } = await supabase
            .from("conversations")
            .select("id, ai_mode, status, assigned_to, whatsapp_meta_instance_id")
            .eq("id", convId)
            .single();

          if (!conversation) {
            console.error(`[process-buffered-messages] ❌ Conversation not found: ${convId}`);
            // Mark as processed to avoid infinite retry
            await supabase.from("message_buffer").update({ processed: true }).in("id", msgs.map((m: any) => m.id));
            continue;
          }

          // Check still autopilot
          if (conversation.ai_mode !== "autopilot") {
            console.log(`[process-buffered-messages] ⏭️ Conv ${convId} no longer autopilot (${conversation.ai_mode}) — marking processed`);
            await supabase.from("message_buffer").update({ processed: true }).in("id", msgs.map((m: any) => m.id));
            processedCount++;
            continue;
          }

          // Process via pipeline
          const pipelineSuccess = await callPipeline(supabase, {
            conversationId: convId,
            concatenatedMessage,
            contactId: effContactId,
            instanceId: effInstanceId || conversation.whatsapp_meta_instance_id,
            fromNumber: effFromNumber,
            flowContext: effFlowContext,
            flowData: effFlowData,
          });

          if (pipelineSuccess) {
            // Mark processed ONLY on success
            await supabase.from("message_buffer").update({ processed: true }).in("id", msgs.map((m: any) => m.id));
            processedCount++;
            console.log(`[process-buffered-messages] ✅ Conv ${convId} processed successfully`);
          } else {
            errorCount++;
            console.error(`[process-buffered-messages] ❌ Conv ${convId} pipeline failed — will retry next cycle`);
            // Do NOT mark as processed — retry on next cron cycle
          }
        } catch (convErr) {
          errorCount++;
          console.error(`[process-buffered-messages] ❌ Error processing conv ${convId}:`, convErr);
          // Do NOT mark as processed — retry on next cron cycle
        }
      }

      // ---- Stuck messages alert ----
      try {
        const { data: stuckData } = await supabase
          .from("message_buffer")
          .select("conversation_id", { count: "exact", head: false })
          .eq("processed", false)
          .lt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

        const stuckCount = stuckData?.length || 0;
        if (stuckCount > 0) {
          const uniqueConvs = [...new Set(stuckData!.map((r: any) => r.conversation_id))];
          console.warn(`[process-buffered-messages] 🚨 ALERT: ${stuckCount} messages stuck > 5min across ${uniqueConvs.length} conversations: ${uniqueConvs.slice(0, 5).join(", ")}`);
        }
      } catch (alertErr) {
        console.error("[process-buffered-messages] ⚠️ Stuck alert check failed:", alertErr);
      }

      console.log(`[process-buffered-messages] 🏁 CRON complete: ${processedCount} processed, ${errorCount} errors`);
      return new Response(
        JSON.stringify({ status: "ok", processed: processedCount, errors: errorCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================
    // MODE B: DIRECT — with conversationId (legacy compat)
    // ============================
    console.log("[process-buffered-messages] 📦 DIRECT mode for conversation:", conversationId);

    // Step 1: Check if newer unprocessed messages exist after our trigger timestamp
    if (triggerTimestamp) {
      const { data: newerMessages } = await supabase
        .from("message_buffer")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("processed", false)
        .gt("created_at", triggerTimestamp)
        .limit(1);

      if (newerMessages && newerMessages.length > 0) {
        console.log("[process-buffered-messages] ⏭️ Newer messages found — skipping");
        return new Response(
          JSON.stringify({ status: "skipped", reason: "newer_messages_exist" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Step 2: Fetch all unprocessed messages
    const { data: bufferedMessages, error: fetchError } = await supabase
      .from("message_buffer")
      .select("id, message_content, created_at")
      .eq("conversation_id", conversationId)
      .eq("processed", false)
      .order("created_at", { ascending: true });

    if (fetchError) throw fetchError;

    if (!bufferedMessages || bufferedMessages.length === 0) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "no_messages" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const concatenatedMessage = bufferedMessages.map((m) => m.message_content).join("\n");
    console.log(`[process-buffered-messages] 📝 Concatenated ${bufferedMessages.length} messages`);

    // Mark processed
    const bufferIds = bufferedMessages.map((m) => m.id);
    await supabase.from("message_buffer").update({ processed: true }).in("id", bufferIds);

    // Fetch conversation
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, ai_mode, status, assigned_to, whatsapp_meta_instance_id")
      .eq("id", conversationId)
      .single();

    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "conversation_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (conversation.ai_mode !== "autopilot") {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "no_longer_autopilot", ai_mode: conversation.ai_mode }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const effectiveInstanceId = instanceId || conversation.whatsapp_meta_instance_id;

    await callPipeline(supabase, {
      conversationId,
      concatenatedMessage,
      contactId,
      instanceId: effectiveInstanceId,
      fromNumber,
      flowContext,
      flowData: originalFlowData,
    });

    return new Response(
      JSON.stringify({
        status: "processed",
        messages_count: bufferedMessages.length,
        concatenated_length: concatenatedMessage.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[process-buffered-messages] ❌ Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================
// Pipeline caller — shared between CRON and DIRECT modes
// ============================
async function callPipeline(
  supabase: any,
  params: {
    conversationId: string;
    concatenatedMessage: string;
    contactId?: string;
    instanceId?: string;
    fromNumber?: string;
    flowContext?: Record<string, unknown>;
    flowData?: Record<string, unknown>;
  }
): Promise<boolean> {
  const { conversationId, concatenatedMessage, contactId, instanceId, fromNumber, flowContext, flowData } = params;

  try {
    if (flowContext || (flowData?.useAI && flowData?.aiNodeActive)) {
      // Flow AI node path
      console.log("[process-buffered-messages] 🤖 Calling ai-autopilot-chat with flow_context");

      const autopilotBody: Record<string, unknown> = {
        conversationId,
        customerMessage: concatenatedMessage,
        contact_id: contactId,
        whatsapp_provider: "meta",
        whatsapp_meta_instance_id: instanceId,
      };

      if (flowContext) {
        autopilotBody.flow_context = flowContext;
      } else if (flowData) {
        autopilotBody.flow_context = {
          flow_id: flowData.flowId,
          node_id: flowData.nodeId,
          node_type: "ai_response",
          allowed_sources: flowData.allowedSources || ["kb"],
          response_format: "text_only",
          personaId: flowData.personaId || null,
          kbCategories: flowData.kbCategories || null,
          contextPrompt: flowData.contextPrompt || null,
          fallbackMessage: flowData.fallbackMessage || null,
          objective: flowData.objective || null,
          maxSentences: flowData.maxSentences ?? 3,
          forbidQuestions: flowData.forbidQuestions ?? true,
          forbidOptions: flowData.forbidOptions ?? true,
          forbidFinancial: flowData.forbidFinancial ?? false,
          forbidCommercial: flowData.forbidCommercial ?? false,
        };
      }

      const autopilotResponse = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-autopilot-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify(autopilotBody),
        }
      );

      if (!autopilotResponse.ok) {
        const errorText = await autopilotResponse.text();
        console.error("[process-buffered-messages] ❌ ai-autopilot-chat error:", autopilotResponse.status, errorText);

        // 🆕 FIX 1: Distinguir quota error (temporário) de erro técnico real
        let isQuotaError = autopilotResponse.status === 503 || autopilotResponse.status === 429;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.status === 'quota_error' || errorData.code === 'QUOTA_EXCEEDED' || errorData.retry_suggested === true) {
            isQuotaError = true;
          }
        } catch { /* non-JSON */ }

        if (isQuotaError) {
          console.warn("[process-buffered-messages] ⚠️ QUOTA ERROR — NÃO disparar forceAIExit, retry no próximo ciclo");
          // 🆕 FIX 3: Anti-retry infinito — contar tentativas via retry_count
          const retryCount = await incrementBufferRetryCount(supabase, conversationId);
          if (retryCount >= 3) {
            console.warn(`[process-buffered-messages] 🚨 Conv ${conversationId}: ${retryCount} retries — enviando msg de alta demanda e avançando`);
            // Enviar mensagem de alta demanda para o contato
            if (instanceId && fromNumber) {
              await supabase.functions.invoke("send-meta-whatsapp", {
                body: {
                  instance_id: instanceId,
                  phone_number: fromNumber,
                  message: "Estamos com alta demanda no momento. Sua mensagem será respondida em breve. Agradecemos a paciência! 🙏",
                  conversation_id: conversationId,
                  skip_db_save: false,
                  is_bot_message: true,
                },
              });
            }
            // Marcar como processed para não ficar retentando infinitamente
            return true; // caller marcará processed=true
          }
          return false; // Não marcar como processed → retry no próximo cron
        }

        // Erro técnico real → safety net (forceAIExit)
        if (flowContext || flowData?.aiNodeActive) {
          console.log("[process-buffered-messages] 🔄 Safety net: IA falhou com erro técnico → re-invocando com forceAIExit");
          await handleFlowReInvoke(supabase, conversationId, concatenatedMessage, instanceId, fromNumber, { forceAIExit: true });
        }
        return false;
      }

      let autopilotData: Record<string, unknown> = {};
      try {
        autopilotData = await autopilotResponse.json();
      } catch { /* non-JSON is ok */ }

      console.log("[process-buffered-messages] ✅ ai-autopilot-chat completed:", JSON.stringify({
        status: autopilotData.status,
        hasFlowContext: autopilotData.hasFlowContext,
        financialBlocked: autopilotData.financialBlocked,
      }));

      // Handle flow_advance_needed
      if (autopilotData.status === "flow_advance_needed" && autopilotData.hasFlowContext) {
        await handleFlowReInvoke(supabase, conversationId, concatenatedMessage, instanceId, fromNumber, { forceAIExit: true });
      }

      // 🆕 Handle contractViolation / flowExit (IA fabricou transferência ou escape)
      // 🆕 Pular re-invoke se email acabou de ser verificado (evita loop de reinício do fluxo)
      if ((autopilotData.contractViolation || autopilotData.flowExit) && autopilotData.hasFlowContext && autopilotData.status !== "flow_advance_needed" && !autopilotData.emailVerified) {
        console.log("[process-buffered-messages] 🔄 contractViolation/flowExit → re-invocando process-chat-flow com forceAIExit");
        await handleFlowReInvoke(supabase, conversationId, concatenatedMessage, instanceId, fromNumber, { forceAIExit: true });
      } else if (autopilotData.emailVerified && (autopilotData.contractViolation || autopilotData.flowExit)) {
        console.log("[process-buffered-messages] ⏭️ Skipping flow re-invoke: email was just verified, flow should continue naturally");
      }

      // Handle financial/commercial blocked
      if ((autopilotData.financialBlocked || autopilotData.commercialBlocked) && autopilotData.hasFlowContext) {
        const exitType = autopilotData.financialBlocked ? "forceFinancialExit" : "forceCommercialExit";
        await handleFlowReInvoke(supabase, conversationId, concatenatedMessage, instanceId, fromNumber, { [exitType]: true });
      }

      // 🆕 FIX 2: Refresh updated_at do flow state após sucesso do buffer
      await supabase
        .from('chat_flow_states')
        .update({ updated_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .in('status', ['active', 'in_progress', 'waiting_input']);

      return true;
    } else {
      // Global autopilot path — call process-chat-flow first
      console.log("[process-buffered-messages] 🔄 Calling process-chat-flow (global autopilot)");

      const flowResponse = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-chat-flow`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            conversationId,
            userMessage: concatenatedMessage,
          }),
        }
      );

      let flowResult: Record<string, unknown> = {};
      if (flowResponse.ok) {
        flowResult = await flowResponse.json();
        console.log("[process-buffered-messages] 📋 Flow result:", JSON.stringify(flowResult));
      }

      if (flowResult.useAI || (!flowResult.skipAutoResponse && !flowResult.response)) {
        console.log("[process-buffered-messages] 🤖 Calling ai-autopilot-chat (global)");

        const autopilotResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-autopilot-chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              conversationId,
              customerMessage: concatenatedMessage,
              contact_id: contactId,
              whatsapp_provider: "meta",
              whatsapp_meta_instance_id: instanceId,
              flow_context: flowResult.flow_context || undefined,
            }),
          }
        );

        if (!autopilotResponse.ok) {
          const gErrorText = await autopilotResponse.text();
          console.error("[process-buffered-messages] ❌ ai-autopilot-chat (global) error:", autopilotResponse.status, gErrorText);
          // FIX 1 (global path): Não matar em quota error
          let isGlobalQuotaError = autopilotResponse.status === 503 || autopilotResponse.status === 429;
          try {
            const gErr = JSON.parse(gErrorText);
            if (gErr.status === 'quota_error' || gErr.code === 'QUOTA_EXCEEDED' || gErr.retry_suggested === true) {
              isGlobalQuotaError = true;
            }
          } catch { /* non-JSON */ }
          if (isGlobalQuotaError) {
            console.warn("[process-buffered-messages] ⚠️ QUOTA ERROR (global) — retry no próximo ciclo");
            const retryCount = await incrementBufferRetryCount(supabase, conversationId);
            if (retryCount >= 3) {
              console.warn(`[process-buffered-messages] 🚨 Conv ${conversationId}: ${retryCount} retries (global) — enviando msg`);
              if (instanceId && fromNumber) {
                await supabase.functions.invoke("send-meta-whatsapp", {
                  body: {
                    instance_id: instanceId,
                    phone_number: fromNumber,
                    message: "Estamos com alta demanda no momento. Sua mensagem será respondida em breve. Agradecemos a paciência! 🙏",
                    conversation_id: conversationId,
                    skip_db_save: false,
                    is_bot_message: true,
                  },
                });
              }
              return true;
            }
            return false;
          }
          return false;
        }
      } else if (flowResult.response && instanceId && fromNumber) {
        console.log("[process-buffered-messages] 📝 Sending flow static response");
        await supabase.functions.invoke("send-meta-whatsapp", {
          body: {
            instance_id: instanceId,
            phone_number: fromNumber,
            message: flowResult.response as string,
            conversation_id: conversationId,
            skip_db_save: false,
            is_bot_message: true,
          },
        });
      }

      return true;
    }
  } catch (err) {
    console.error("[process-buffered-messages] ❌ Pipeline error:", err);
    return false;
  }
}

// Helper: re-invoke process-chat-flow with special flags
async function handleFlowReInvoke(
  supabase: any,
  conversationId: string,
  userMessage: string,
  instanceId?: string,
  fromNumber?: string,
  flags: Record<string, boolean> = {}
): Promise<void> {
  const flagName = Object.keys(flags)[0] || "unknown";
  console.log(`[process-buffered-messages] 🔄 ${flagName} → re-invoking process-chat-flow`);

  const flowResponse = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-chat-flow`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        conversationId,
        userMessage,
        ...flags,
      }),
    }
  );

  if (flowResponse.ok) {
    const flowResult = await flowResponse.json();
    console.log(`[process-buffered-messages] ✅ Flow re-invoked (${flagName}):`, JSON.stringify(flowResult));

    const flowMessage = flowResult.response || flowResult.message;
    if (flowMessage && instanceId && fromNumber) {
      await supabase.functions.invoke("send-meta-whatsapp", {
        body: {
          instance_id: instanceId,
          phone_number: fromNumber,
          message: flowMessage,
          conversation_id: conversationId,
          skip_db_save: true,
        },
      });
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        content: flowMessage,
        sender_type: "user",
        is_ai_generated: true,
        message_type: "text",
      });
    }

    const transferDept = flowResult.departmentId || flowResult.department;
    if ((flowResult.transfer === true || flowResult.action === "transfer") && transferDept) {
      await supabase
        .from("conversations")
        .update({ ai_mode: "waiting_human", department: transferDept, assigned_to: null })
        .eq("id", conversationId);
    }
  } else {
    console.error(`[process-buffered-messages] ❌ Flow re-invoke failed (${flagName}):`, await flowResponse.text());
  }
}

// 🆕 FIX 3: Contador de retries por conversa para evitar retry infinito em quota errors
// Usa um campo em memória baseado nos buffers não-processados mais antigos
async function incrementBufferRetryCount(
  supabase: any,
  conversationId: string
): Promise<number> {
  try {
    // Contar quantos ciclos de cron este buffer já sobreviveu
    // Aproximação: idade do buffer mais antigo não-processado / intervalo do cron (60s)
    const { data: oldestBuffer } = await supabase
      .from("message_buffer")
      .select("created_at")
      .eq("conversation_id", conversationId)
      .eq("processed", false)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!oldestBuffer) return 0;

    const ageSeconds = (Date.now() - new Date(oldestBuffer.created_at).getTime()) / 1000;
    // Cada ciclo de cron é ~60s, batch delay ~8s
    // Retry count = quantos ciclos completos já passaram
    const retryCount = Math.floor(ageSeconds / 60);
    console.log(`[process-buffered-messages] 📊 Conv ${conversationId}: buffer age ${ageSeconds.toFixed(0)}s → ~${retryCount} retries`);
    return retryCount;
  } catch (err) {
    console.error("[process-buffered-messages] ⚠️ Error counting retries:", err);
    return 0;
  }
}
