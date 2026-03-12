import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getAIConfig } from "../_shared/ai-config-cache.ts";
import { isWithinBusinessHours as checkBizHours } from "../_shared/business-hours.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PER_RUN = 50;
const SAFE_MESSAGE = "Oi! Passando aqui para avisar que não esquecemos de você 😊 Assim que nosso time retomar o atendimento, você já está na fila de prioridade. Se precisar de algo, é só nos chamar!";
const ANCHOR_REGEX = /pedido|produto|entrega|problema|erro|compra|pagamento|duvida|dúvida|reclamacao|reclamação|suporte|boleto|pix|parcela|troca|devolução|devoluç/i;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[window-keeper] 🕐 Starting keep-alive cycle...");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing env vars" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Security: validate authorization header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
    console.warn("[window-keeper] ❌ Unauthorized request");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Check Kill Switch
  const aiConfig = await getAIConfig(supabase);
  if (!aiConfig.ai_global_enabled) {
    console.log("[window-keeper] 🛑 Kill Switch active - skipping all");
    return jsonResponse({ status: "disabled", reason: "kill_switch", processed: 0 });
  }

  // 2. Check business hours
  const isBusinessHours = await checkBizHours(supabase);
  if (!isBusinessHours) {
    console.log("[window-keeper] 🌙 Outside business hours - skipping");
    return jsonResponse({ status: "skipped", reason: "outside_business_hours", processed: 0 });
  }

  // 3. Query eligible conversations (max 50)
  const now = new Date();
  const hours23Ago = new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString();
  const hours24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Find conversations where last contact message is between 23h and 24h ago
  // and company hasn't replied after that
  const { data: eligibleConversations, error: queryError } = await supabase
    .rpc("get_window_keeper_eligible", {
      p_hours_23_ago: hours23Ago,
      p_hours_24_ago: hours24Ago,
      p_max_results: MAX_PER_RUN,
    });

  if (queryError) {
    // Fallback: direct query if RPC doesn't exist yet
    console.warn("[window-keeper] RPC not found, using direct query:", queryError.message);
    return await processWithDirectQuery(supabase, hours23Ago, hours24Ago, now, aiConfig, startTime);
  }

  if (!eligibleConversations || eligibleConversations.length === 0) {
    console.log("[window-keeper] ✅ No eligible conversations found");
    return jsonResponse({ status: "ok", processed: 0, sent: 0, skipped: 0 });
  }

  console.log(`[window-keeper] 📋 Found ${eligibleConversations.length} eligible conversations`);

  const results = { sent: 0, skipped: 0, errors: 0, skippedReasons: {} as Record<string, number> };

  for (const conv of eligibleConversations) {
    try {
      await processConversation(supabase, conv, aiConfig, results, supabaseUrl, serviceKey);
    } catch (err) {
      console.error(`[window-keeper] ❌ Error processing ${conv.id}:`, err);
      results.errors++;
      await logKeepAlive(supabase, {
        conversation_id: conv.id,
        contact_id: conv.contact_id,
        trigger_reason: "error",
        message_content: null,
        message_source: "none",
        success: false,
        error_message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`[window-keeper] ✅ Complete: sent=${results.sent} skipped=${results.skipped} errors=${results.errors} time=${totalTime}ms`);

  return jsonResponse({
    status: "ok",
    processed: eligibleConversations.length,
    ...results,
    totalTime,
  });
});

// ========================\\
// Process individual conversation
// ========================
async function processConversation(
  supabase: any,
  conv: any,
  aiConfig: any,
  results: any,
  supabaseUrl: string,
  serviceKey: string,
) {
  const { id: conversationId, contact_id, ai_mode, whatsapp_meta_instance_id, whatsapp_instance_id, whatsapp_provider } = conv;

  // Check do_not_disturb
  const { data: contact } = await supabase
    .from("contacts")
    .select("do_not_disturb, phone, whatsapp_id")
    .eq("id", contact_id)
    .single();

  if (contact?.do_not_disturb) {
    await skipAndLog(supabase, conversationId, contact_id, "do_not_disturb", results);
    return;
  }

  // Check daily limit per contact (max 1 per 24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: dailyCount } = await supabase
    .from("window_keeper_logs")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contact_id)
    .eq("success", true)
    .gte("created_at", oneDayAgo);

  if ((dailyCount || 0) >= 1) {
    await skipAndLog(supabase, conversationId, contact_id, "daily_limit_reached", results);
    return;
  }

  // Shadow mode: log suggestion but don't send
  if (aiConfig.ai_shadow_mode) {
    await skipAndLog(supabase, conversationId, contact_id, "shadow_mode", results);
    return;
  }

  // Get last 10 messages for context
  const { data: messages } = await supabase
    .from("messages")
    .select("content, sender_type, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(10);

  const messageHistory = (messages || []).reverse();
  const historyText = messageHistory.map((m: any) => m.content || "").join(" ");
  const hasAnchors = ANCHOR_REGEX.test(historyText);

  let messageContent = SAFE_MESSAGE;
  let messageSource = "safe_default";
  let aiModel: string | null = null;
  let aiTokens: number | null = null;
  let aiLatency: number | null = null;

  // Decide: AI or safe message
  if (hasAnchors && ai_mode === "autopilot") {
    // Use AI for contextual follow-up
    const aiStart = Date.now();
    try {
      const aiResult = await generateAIFollowUp(messageHistory, supabaseUrl, serviceKey);
      if (aiResult.content) {
        messageContent = aiResult.content;
        messageSource = "ai_generated";
        aiModel = "gpt-4o-mini";
        aiTokens = aiResult.tokens || null;
      }
      aiLatency = Date.now() - aiStart;
    } catch (err) {
      console.warn(`[window-keeper] AI fallback to safe message for ${conversationId}:`, err);
      aiLatency = Date.now() - aiStart;
      // Falls through to safe message
    }
  }
  // For waiting_human mode, always use safe message (already set)

  // Determine provider and send
  const provider = whatsapp_provider === "meta" || whatsapp_meta_instance_id ? "meta" : "evolution";
  let sendSuccess = false;
  let sendError: string | null = null;

  try {
    if (provider === "meta" && whatsapp_meta_instance_id) {
      // Send via Meta WhatsApp
      const recipientPhone = contact?.whatsapp_id || contact?.phone;
      if (!recipientPhone) {
        throw new Error("No phone/whatsapp_id for contact");
      }

      const sendResponse = await fetch(`${supabaseUrl}/functions/v1/send-meta-whatsapp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: messageContent,
          is_bot_message: true,
          skip_db_save: false,
        }),
      });

      if (!sendResponse.ok) {
        const errText = await sendResponse.text();
        throw new Error(`send-meta-whatsapp returned ${sendResponse.status}: ${errText}`);
      }
      sendSuccess = true;
    } else {
      // Evolution API fallback
      sendError = "evolution_not_supported_for_keepalive";
      console.warn(`[window-keeper] Evolution API not supported for keep-alive on ${conversationId}`);
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err);
    console.error(`[window-keeper] Send failed for ${conversationId}:`, sendError);
  }

  if (sendSuccess) {
    // Update conversation keep-alive timestamp
    await supabase
      .from("conversations")
      .update({ window_keep_alive_sent_at: new Date().toISOString() })
      .eq("id", conversationId);

    results.sent++;
  } else {
    results.errors++;
  }

  // Log everything
  await logKeepAlive(supabase, {
    conversation_id: conversationId,
    contact_id,
    trigger_reason: "last_contact_msg_23h_no_reply",
    message_content: sendSuccess ? messageContent : null,
    message_source: messageSource,
    ai_model: aiModel,
    ai_tokens_used: aiTokens,
    ai_latency_ms: aiLatency,
    provider,
    success: sendSuccess,
    error_message: sendError,
  });
}

// ========================\\
// AI Follow-up Generation
// ========================
async function generateAIFollowUp(
  messages: Array<{ content: string; sender_type: string }>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ content: string; tokens?: number }> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const context = messages
    .map((m) => `${m.sender_type === "contact" ? "Cliente" : "Atendente"}: ${m.content || "(mídia)"}`)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é um assistente de atendimento ao cliente. Gere uma mensagem curta (máximo 2 frases), acolhedora e natural, passando a ideia de que a empresa NÃO esqueceu do cliente e que o atendimento vai continuar em breve.
NÃO pergunte se o cliente precisa de ajuda (ele já pediu).
NÃO mencione janela de 24h, termos técnicos ou que a mensagem é automática.
Use o contexto da conversa para personalizar.
O tom deve ser caloroso, como se um atendente humano estivesse passando para dar um retorno rápido.
Responda APENAS com o texto da mensagem, sem aspas nem prefixos.`,
        },
        {
          role: "user",
          content: `Histórico da conversa:\n${context}`,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content?.trim() || SAFE_MESSAGE,
    tokens: data.usage?.total_tokens,
  };
}

// ========================\\
// Direct query fallback (if RPC not available)
// ========================
async function processWithDirectQuery(
  supabase: any,
  hours23Ago: string,
  hours24Ago: string,
  now: Date,
  aiConfig: any,
  startTime: number,
) {
  // Get open whatsapp conversations without keep-alive sent
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, contact_id, ai_mode, whatsapp_meta_instance_id, whatsapp_instance_id, whatsapp_provider")
    .eq("status", "open")
    .eq("channel", "whatsapp")
    .is("window_keep_alive_sent_at", null)
    .not("ai_mode", "in", "(copilot,disabled)")
    .limit(MAX_PER_RUN);

  if (error || !conversations) {
    console.error("[window-keeper] Query error:", error);
    return jsonResponse({ status: "error", error: error?.message, processed: 0 });
  }

  // Filter by message timing (last contact message between 23h-24h ago, no company reply after)
  const eligible: any[] = [];

  for (const conv of conversations) {
    // Get last contact message
    const { data: lastContactMsg } = await supabase
      .from("messages")
      .select("created_at")
      .eq("conversation_id", conv.id)
      .eq("sender_type", "contact")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!lastContactMsg) continue;

    const contactMsgTime = new Date(lastContactMsg.created_at).getTime();
    const h23 = new Date(hours23Ago).getTime();
    const h24 = new Date(hours24Ago).getTime();

    // Contact message must be between 23h and 24h ago
    if (contactMsgTime > h23 || contactMsgTime < h24) continue;

    // Check if company replied after this contact message
    const { count: replyCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conv.id)
      .in("sender_type", ["user", "system"])
      .gt("created_at", lastContactMsg.created_at);

    if ((replyCount || 0) > 0) continue;

    eligible.push(conv);
    if (eligible.length >= MAX_PER_RUN) break;
  }

  if (eligible.length === 0) {
    return jsonResponse({ status: "ok", processed: 0, sent: 0, skipped: 0 });
  }

  console.log(`[window-keeper] 📋 Direct query found ${eligible.length} eligible conversations`);

  const results = { sent: 0, skipped: 0, errors: 0, skippedReasons: {} as Record<string, number> };
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  for (const conv of eligible) {
    try {
      await processConversation(supabase, conv, aiConfig, results, supabaseUrl, serviceKey);
    } catch (err) {
      console.error(`[window-keeper] ❌ Error:`, err);
      results.errors++;
    }
  }

  const totalTime = Date.now() - startTime;
  return jsonResponse({ status: "ok", processed: eligible.length, ...results, totalTime });
}

// ========================\\
// Helpers
// ========================
// checkBusinessHours replaced by shared _shared/business-hours.ts

async function skipAndLog(
  supabase: any,
  conversationId: string,
  contactId: string,
  reason: string,
  results: any,
) {
  results.skipped++;
  results.skippedReasons[reason] = (results.skippedReasons[reason] || 0) + 1;
  console.log(`[window-keeper] ⏭️ Skipped ${conversationId}: ${reason}`);

  await logKeepAlive(supabase, {
    conversation_id: conversationId,
    contact_id: contactId,
    trigger_reason: "eligibility_check",
    message_content: null,
    message_source: "none",
    success: false,
    skipped_reason: reason,
  });
}

async function logKeepAlive(supabase: any, data: Record<string, any>) {
  try {
    await supabase.from("window_keeper_logs").insert(data);
  } catch (err) {
    console.error("[window-keeper] Failed to log:", err);
  }
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
  });
}
