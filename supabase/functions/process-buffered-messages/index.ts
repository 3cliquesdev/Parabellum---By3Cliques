import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Process Buffered Messages
 * 
 * Called after the batch delay expires. Checks if there are newer messages
 * (meaning another timer will handle it). If not, concatenates all unprocessed
 * messages and triggers the AI pipeline.
 * 
 * Flow:
 * 1. Receive conversationId + triggerTimestamp
 * 2. Check if any unprocessed messages arrived AFTER triggerTimestamp
 *    - If yes → skip (a newer timer will process)
 *    - If no → this is the latest timer, process the buffer
 * 3. Fetch all unprocessed messages, concatenate with \n
 * 4. Mark as processed
 * 5. Call the appropriate pipeline (process-chat-flow or ai-autopilot-chat)
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      conversationId,
      triggerTimestamp,
      contactId,
      instanceId,
      fromNumber,
      flowContext,
      flowData: originalFlowData,
    } = await req.json();

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "conversationId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("[process-buffered-messages] 📦 Processing buffer for conversation:", conversationId);

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
        console.log("[process-buffered-messages] ⏭️ Newer messages found after", triggerTimestamp, "- skipping (newer timer will handle)");
        return new Response(
          JSON.stringify({ status: "skipped", reason: "newer_messages_exist" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Step 2: Fetch all unprocessed messages for this conversation (ordered by time)
    const { data: bufferedMessages, error: fetchError } = await supabase
      .from("message_buffer")
      .select("id, message_content, created_at")
      .eq("conversation_id", conversationId)
      .eq("processed", false)
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("[process-buffered-messages] ❌ Error fetching buffer:", fetchError);
      throw fetchError;
    }

    if (!bufferedMessages || bufferedMessages.length === 0) {
      console.log("[process-buffered-messages] ℹ️ No unprocessed messages found - already processed");
      return new Response(
        JSON.stringify({ status: "skipped", reason: "no_messages" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Concatenate all messages
    const concatenatedMessage = bufferedMessages
      .map((m) => m.message_content)
      .join("\n");

    console.log(`[process-buffered-messages] 📝 Concatenated ${bufferedMessages.length} messages: "${concatenatedMessage.substring(0, 200)}..."`);

    // Step 4: Mark all as processed (atomically)
    const bufferIds = bufferedMessages.map((m) => m.id);
    const { error: updateError } = await supabase
      .from("message_buffer")
      .update({ processed: true })
      .in("id", bufferIds);

    if (updateError) {
      console.error("[process-buffered-messages] ❌ Error marking as processed:", updateError);
      // Continue anyway — better to double-process than not process at all
    }

    // Step 5: Fetch conversation state
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, ai_mode, status, assigned_to, whatsapp_meta_instance_id")
      .eq("id", conversationId)
      .single();

    if (!conversation) {
      console.error("[process-buffered-messages] ❌ Conversation not found:", conversationId);
      return new Response(
        JSON.stringify({ error: "conversation_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 6: Re-check conversation is still in AI mode (could have changed during delay)
    if (conversation.ai_mode !== "autopilot") {
      console.log("[process-buffered-messages] ⏭️ Conversation no longer in autopilot mode:", conversation.ai_mode);
      return new Response(
        JSON.stringify({ status: "skipped", reason: "no_longer_autopilot", ai_mode: conversation.ai_mode }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 7: Determine pipeline — if we have flowContext, call ai-autopilot-chat with it
    // Otherwise, call process-chat-flow first, then ai-autopilot-chat if needed
    const effectiveInstanceId = instanceId || conversation.whatsapp_meta_instance_id;

    if (flowContext || (originalFlowData?.useAI && originalFlowData?.aiNodeActive)) {
      // Flow AI node path — call ai-autopilot-chat directly with flow_context
      console.log("[process-buffered-messages] 🤖 Calling ai-autopilot-chat with flow_context");
      
      const autopilotBody: Record<string, unknown> = {
        conversationId,
        customerMessage: concatenatedMessage,
        contact_id: contactId,
        whatsapp_provider: "meta",
        whatsapp_meta_instance_id: effectiveInstanceId,
      };

      if (flowContext) {
        autopilotBody.flow_context = flowContext;
      } else if (originalFlowData) {
        autopilotBody.flow_context = {
          flow_id: originalFlowData.flowId,
          node_id: originalFlowData.nodeId,
          node_type: "ai_response",
          allowed_sources: originalFlowData.allowedSources || ["kb"],
          response_format: "text_only",
          personaId: originalFlowData.personaId || null,
          kbCategories: originalFlowData.kbCategories || null,
          contextPrompt: originalFlowData.contextPrompt || null,
          fallbackMessage: originalFlowData.fallbackMessage || null,
          objective: originalFlowData.objective || null,
          maxSentences: originalFlowData.maxSentences ?? 3,
          forbidQuestions: originalFlowData.forbidQuestions ?? true,
          forbidOptions: originalFlowData.forbidOptions ?? true,
          forbidFinancial: originalFlowData.forbidFinancial ?? false,
          forbidCommercial: originalFlowData.forbidCommercial ?? false,
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
        const errText = await autopilotResponse.text();
        console.error("[process-buffered-messages] ❌ ai-autopilot-chat error:", errText);
        return new Response(
          JSON.stringify({ status: "error", error: errText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Handle autopilot response (flow_advance_needed, financialBlocked, etc.)
      let autopilotData: Record<string, unknown> = {};
      try {
        autopilotData = await autopilotResponse.json();
      } catch { /* non-JSON response is fine */ }

      console.log("[process-buffered-messages] ✅ ai-autopilot-chat completed:", JSON.stringify({
        status: autopilotData.status,
        hasFlowContext: autopilotData.hasFlowContext,
        financialBlocked: autopilotData.financialBlocked,
      }));

      // Handle flow_advance_needed — re-invoke process-chat-flow
      if (autopilotData.status === "flow_advance_needed" && autopilotData.hasFlowContext) {
        console.log("[process-buffered-messages] 🔄 flow_advance_needed → re-invoking process-chat-flow with forceAIExit");
        
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
              forceAIExit: true,
            }),
          }
        );

        if (flowResponse.ok) {
          const flowResult = await flowResponse.json();
          console.log("[process-buffered-messages] ✅ Flow advanced:", JSON.stringify(flowResult));

          // Send flow response message if any
          const flowMessage = flowResult.response || flowResult.message;
          if (flowMessage && effectiveInstanceId && fromNumber) {
            await supabase.functions.invoke("send-meta-whatsapp", {
              body: {
                instance_id: effectiveInstanceId,
                phone_number: fromNumber,
                message: flowMessage,
                conversation_id: conversationId,
                skip_db_save: true,
              },
            });
            await supabase.from("messages").insert({
              conversation_id: conversationId,
              content: flowMessage,
              sender_type: "system",
              message_type: "text",
            });
          }

          // Handle transfer
          const transferDept = flowResult.departmentId || flowResult.department;
          if ((flowResult.transfer === true || flowResult.action === "transfer") && transferDept) {
            await supabase
              .from("conversations")
              .update({ ai_mode: "waiting_human", department: transferDept, assigned_to: null })
              .eq("id", conversationId);
          }
        } else {
          console.error("[process-buffered-messages] ❌ process-chat-flow re-invoke failed:", await flowResponse.text());
        }
      }

      // Handle financialBlocked / commercialBlocked with flow context
      if ((autopilotData.financialBlocked || autopilotData.commercialBlocked) && autopilotData.hasFlowContext) {
        const exitType = autopilotData.financialBlocked ? "forceFinancialExit" : "forceCommercialExit";
        console.log(`[process-buffered-messages] 🔒 ${exitType} → re-invoking process-chat-flow`);

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
              [exitType]: true,
            }),
          }
        );

        if (flowResponse.ok) {
          const flowResult = await flowResponse.json();
          const flowMessage = flowResult.response || flowResult.message;
          if (flowMessage && effectiveInstanceId && fromNumber) {
            await supabase.functions.invoke("send-meta-whatsapp", {
              body: {
                instance_id: effectiveInstanceId,
                phone_number: fromNumber,
                message: flowMessage,
                conversation_id: conversationId,
                skip_db_save: true,
              },
            });
            await supabase.from("messages").insert({
              conversation_id: conversationId,
              content: flowMessage,
              sender_type: "system",
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
        }
      }

      return new Response(
        JSON.stringify({
          status: "processed",
          messages_count: bufferedMessages.length,
          concatenated_length: concatenatedMessage.length,
          autopilot_result: autopilotData,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Global autopilot path (no active flow) — call process-chat-flow first
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

      // If flow says useAI, call autopilot
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
              whatsapp_meta_instance_id: effectiveInstanceId,
              flow_context: flowResult.flow_context || undefined,
            }),
          }
        );

        if (!autopilotResponse.ok) {
          console.error("[process-buffered-messages] ❌ ai-autopilot-chat error:", await autopilotResponse.text());
        }
      } else if (flowResult.response && effectiveInstanceId && fromNumber) {
        // Flow returned a static response — send it
        console.log("[process-buffered-messages] 📝 Sending flow static response");
        await supabase.functions.invoke("send-meta-whatsapp", {
          body: {
            instance_id: effectiveInstanceId,
            phone_number: fromNumber,
            message: flowResult.response as string,
            conversation_id: conversationId,
            skip_db_save: false,
            is_bot_message: true,
          },
        });
      }

      return new Response(
        JSON.stringify({
          status: "processed",
          messages_count: bufferedMessages.length,
          concatenated_length: concatenatedMessage.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("[process-buffered-messages] ❌ Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

