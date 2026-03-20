import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getAIConfig } from "../_shared/ai-config-cache.ts";
import { resolveDepartments } from "../_shared/department-resolver.ts";

// ============================================
// 📦 MESSAGE BATCHING HELPERS
// ============================================

/**
 * Saves a message to the buffer and schedules delayed processing.
 * Uses a cooldown/debounce approach: the process-buffered-messages function
 * checks if newer messages arrived before processing.
 */
async function bufferAndSchedule(
  supabase: any,
  conversationId: string,
  messageContent: string,
  _delaySeconds: number,
  metadata: {
    contactId: string;
    instanceId: string;
    fromNumber: string;
    flowContext?: Record<string, unknown>;
    flowData?: Record<string, unknown>;
  }
): Promise<void> {
  // Save to buffer WITH metadata — cron will pick it up
  const { data: bufferEntry, error: bufferError } = await supabase
    .from("message_buffer")
    .insert({
      conversation_id: conversationId,
      message_content: messageContent,
      contact_id: metadata.contactId,
      instance_id: metadata.instanceId,
      from_number: metadata.fromNumber,
      flow_context: metadata.flowContext || null,
      flow_data: metadata.flowData || null,
    })
    .select("id, created_at")
    .single();

  if (bufferError) {
    console.error("[meta-whatsapp-webhook] ❌ Error saving to buffer:", bufferError);
    throw bufferError;
  }

  console.log(`[meta-whatsapp-webhook] 📦 Message buffered: ${bufferEntry.id} — cron will process after delay`);
  // NO setTimeout — the cron job (process-buffered-messages) handles processing
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta WhatsApp Cloud API Webhook
 * 
 * Handles:
 * - Webhook verification (GET requests)
 * - Incoming messages (POST requests)
 * - Message status updates (delivered, read, etc.)
 */

// Função auxiliar: Extrair rating (1-5) da mensagem
// ✅ STRICT: Apenas texto puro "1", "2", "3", "4" ou "5" - NADA MAIS
// Ignora: "nota 5", "5 estrelas", "⭐⭐⭐⭐⭐", "1.", etc.
function extractRating(message: string): number | null {
  const normalized = message.trim();
  const numMatch = normalized.match(/^[1-5]$/);
  return numMatch ? parseInt(numMatch[0]) : null;
}
// Função para formatar opções do ask_options como texto com emojis numéricos
function formatOptionsAsText(options: Array<{label: string; value?: string; id?: string}> | null | undefined): string {
  if (!options || options.length === 0) return '';
  
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  
  const formatted = options.map((opt, idx) => {
    const emoji = emojis[idx] || `${idx + 1}.`;
    return `${emoji} ${opt.label}`;
  }).join('\n');
  
  return `\n\n${formatted}`;
}

interface MetaWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: "text" | "image" | "audio" | "video" | "document" | "sticker" | "location" | "contacts" | "button" | "interactive";
          text?: { body: string };
          image?: { id: string; mime_type: string; sha256: string; caption?: string };
          audio?: { id: string; mime_type: string };
          video?: { id: string; mime_type: string; caption?: string };
          document?: { id: string; mime_type: string; filename: string; caption?: string };
          sticker?: { id: string; mime_type: string };
          location?: { latitude: number; longitude: number; name?: string; address?: string };
          contacts?: Array<{ name: { formatted_name: string }; phones?: Array<{ phone: string }> }>;
          button?: { payload: string; text: string };
          interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
        }>;
        statuses?: Array<{
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id: string;
          errors?: Array<{ code: number; title: string }>;
        }>;
      };
      field: string;
    }>;
  }>;
}

async function verifyMetaSignature(
  body: string,
  signature: string | null,
  appSecret: string | null
): Promise<boolean> {
  // Validate that we have the required inputs
  if (!appSecret) {
    console.error("[meta-whatsapp-webhook] ❌ WHATSAPP_APP_SECRET not configured");
    return false;
  }

  if (!signature || !signature.startsWith("sha256=")) {
    console.error("[meta-whatsapp-webhook] ❌ Missing or invalid x-hub-signature-256 header");
    return false;
  }

  try {
    const signatureHash = signature.replace("sha256=", "");
    const encoder = new TextEncoder();
    const keyData = encoder.encode(appSecret);
    const messageData = encoder.encode(body);

    // Import key for HMAC-SHA256
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Sign the message body
    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const isValid = expectedSignature === signatureHash;
    
    if (!isValid) {
      console.error("[meta-whatsapp-webhook] ❌ HMAC signature mismatch");
    } else {
      console.log("[meta-whatsapp-webhook] ✅ HMAC signature verified");
    }

    return isValid;
  } catch (error) {
    console.error("[meta-whatsapp-webhook] ❌ Signature verification error:", error);
    return false;
  }
}

serve(async (req) => {
  const url = new URL(req.url);

  // ============================================
  // GET: Webhook Verification (Meta Challenge) + Warmup
  // ============================================
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // Handler de warmup rápido
    if (mode === "warmup") {
      console.log("[meta-whatsapp-webhook] 🔥 Warmup ping received");
      return new Response(
        JSON.stringify({ status: "warm", timestamp: new Date().toISOString() }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[meta-whatsapp-webhook] 🔐 Verification request:", { mode, token: token?.slice(0, 10) + "..." });

    // Buscar token de verificação do banco
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: instances } = await supabase
      .from("whatsapp_meta_instances")
      .select("verify_token")
      .eq("status", "active");

    const validTokens = instances?.map(i => i.verify_token) || [];

    if (mode === "subscribe" && token && validTokens.includes(token)) {
      console.log("[meta-whatsapp-webhook] ✅ Webhook verified successfully");

      // Marcar instância como verificada
      await supabase
        .from("whatsapp_meta_instances")
        .update({ webhook_verified: true })
        .eq("verify_token", token);

      return new Response(challenge, { status: 200 });
    }

    console.error("[meta-whatsapp-webhook] ❌ Verification failed");
    return new Response("Forbidden", { status: 403 });
  }

  // ============================================
  // OPTIONS: CORS preflight
  // ============================================
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ============================================
  // POST: Webhook Events
  // ============================================
  if (req.method === "POST") {
    try {
      const rawBody = await req.text();
      const signature = req.headers.get("x-hub-signature-256");
      const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") || null;

      // Verify signature
      const isValid = await verifyMetaSignature(rawBody, signature, appSecret);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const payload: MetaWebhookPayload = JSON.parse(rawBody);
      console.log("[meta-whatsapp-webhook] 📥 Received event:", payload.object);

      if (payload.object !== "whatsapp_business_account") {
        console.log("[meta-whatsapp-webhook] ℹ️ Ignoring non-WhatsApp event");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field !== "messages") continue;

          const value = change.value;
          const phoneNumberId = value.metadata.phone_number_id;

          // Buscar instância pelo phone_number_id
          const { data: instance } = await supabase
            .from("whatsapp_meta_instances")
            .select("*")
            .eq("phone_number_id", phoneNumberId)
            .eq("status", "active")
            .single();

          if (!instance) {
            console.error("[meta-whatsapp-webhook] ❌ Instance not found for phone_number_id:", phoneNumberId);
            continue;
          }

          // ============================================
          // Process Messages
          // ============================================
          const flowExitHandledByConversation = new Set<string>();
          if (value.messages && value.messages.length > 0) {
            for (const msg of value.messages) {
              const contactInfo = value.contacts?.[0];
              const fromNumber = msg.from;
              const pushName = contactInfo?.profile?.name || "";

              console.log("[meta-whatsapp-webhook] 📨 Message from:", fromNumber, "Type:", msg.type);

              // Extrair conteúdo da mensagem
              let messageContent = "";
              let mediaType: string | null = null;
              let mediaId: string | null = null;

              switch (msg.type) {
                case "text":
                  messageContent = msg.text?.body || "";
                  break;
                case "image":
                  messageContent = msg.image?.caption || "📷 Imagem";
                  mediaType = "image";
                  mediaId = msg.image?.id || null;
                  break;
                case "audio":
                  messageContent = "🎵 Áudio";
                  mediaType = "audio";
                  mediaId = msg.audio?.id || null;
                  break;
                case "video":
                  messageContent = msg.video?.caption || "🎬 Vídeo";
                  mediaType = "video";
                  mediaId = msg.video?.id || null;
                  break;
                case "document":
                  messageContent = msg.document?.caption || `📎 ${msg.document?.filename || "Documento"}`;
                  mediaType = "document";
                  mediaId = msg.document?.id || null;
                  break;
                case "sticker":
                  messageContent = "🎭 Sticker";
                  mediaType = "sticker";
                  mediaId = msg.sticker?.id || null;
                  break;
                case "location":
                  messageContent = `📍 ${msg.location?.name || "Localização"}: ${msg.location?.latitude}, ${msg.location?.longitude}`;
                  break;
                case "button":
                  messageContent = msg.button?.text || msg.button?.payload || "Botão clicado";
                  break;
                case "interactive":
                  messageContent = msg.interactive?.button_reply?.title || 
                                   msg.interactive?.list_reply?.title || 
                                   "Interação";
                  break;
                default:
                  messageContent = `[${msg.type}]`;
              }

              // Normalizar número
              const normalizedPhone = fromNumber.startsWith("55") ? fromNumber : `55${fromNumber}`;
              const whatsappId = `${fromNumber}@s.whatsapp.net`;

              // Buscar ou criar contato — DEDUP CRUZADA
              // 1. Buscar por phone/whatsapp_id (match exato)
              let { data: contact } = await supabase
                .from("contacts")
                .select("id")
                .or(`phone.eq.${normalizedPhone},whatsapp_id.eq.${whatsappId}`)
                .single();

              // 2. Se não encontrou, tentar variações do telefone (com/sem 55, formatado)
              if (!contact) {
                const phoneVariations = [
                  normalizedPhone,
                  fromNumber,
                  normalizedPhone.replace(/^55/, ''),
                ];
                // Buscar por telefone parcial (últimos 8+ dígitos)
                const lastDigits = normalizedPhone.slice(-8);
                const { data: phoneMatch } = await supabase
                  .from("contacts")
                  .select("id, phone")
                  .or(`phone.ilike.%${lastDigits},whatsapp_id.ilike.%${lastDigits}`)
                  .limit(1)
                  .maybeSingle();

                if (phoneMatch) {
                  contact = phoneMatch;
                  // Atualizar o contato existente com dados normalizados
                  await supabase
                    .from("contacts")
                    .update({ 
                      whatsapp_id: whatsappId,
                      phone: normalizedPhone,
                    })
                    .eq("id", phoneMatch.id);
                  console.log("[meta-whatsapp-webhook] 🔗 Matched existing contact by phone variation:", phoneMatch.id);
                }
              }

              if (!contact) {
                // 3. Criar novo contato somente se não há match algum
                const { data: newContact } = await supabase
                  .from("contacts")
                  .insert({
                    first_name: pushName || "Novo",
                    last_name: "Contato",
                    phone: normalizedPhone,
                    whatsapp_id: whatsappId,
                    source: "meta_whatsapp",
                  })
                  .select("id")
                  .single();

                contact = newContact;
                console.log("[meta-whatsapp-webhook] 👤 New contact created:", contact?.id);
              }

              if (!contact) {
                console.error("[meta-whatsapp-webhook] ❌ Failed to find/create contact");
                continue;
              }

              // ============================================
              // PRÉ-VERIFICAÇÃO CSAT - ANTES de criar conversa nova
              // Se cliente respondeu avaliação, processar e MANTER fechada
              // ============================================
              
              // 🆕 Validar instance.id antes de rodar guard (segurança multi-instância)
              let csatConversation = null;
              if (instance?.id) {
                // Janela de 24h usando Date.now() - defensivo e sem timezone issues
                const CSAT_WINDOW_HOURS = 24;
                const csatWindowLimitIso = new Date(Date.now() - CSAT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
                
                const { data: csatResult, error: csatError } = await supabase
                  .from("conversations")
                  .select("id, awaiting_rating, status, whatsapp_meta_instance_id, rating_sent_at")
                  .eq("contact_id", contact.id)
                  .eq("awaiting_rating", true)
                  .eq("status", "closed")
                  .eq("whatsapp_meta_instance_id", instance.id) // 🆕 Filtrar pela instância atual
                  .not("rating_sent_at", "is", null)            // 🆕 Garantir que CSAT foi enviado
                  .gte("rating_sent_at", csatWindowLimitIso)    // 🆕 Apenas últimas 24h DESDE ENVIO
                  .order("rating_sent_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                
                if (csatError) {
                  console.error("[meta-whatsapp-webhook] ⚠️ CSAT Guard query error:", csatError);
                } else {
                  csatConversation = csatResult;
                }
              } else {
                console.warn("[meta-whatsapp-webhook] ⚠️ CSAT Guard skipped: no instance.id");
              }

              if (csatConversation && csatConversation.awaiting_rating) {
                const csatRating = extractRating(messageContent);
                
                if (csatRating !== null) {
                  console.log(`[meta-whatsapp-webhook] ⭐ CSAT PRE-CHECK: Rating ${csatRating} detected BEFORE reopen`);
                  
                  // Buscar department_id para relatórios
                  const { data: convForDept } = await supabase
                    .from("conversations")
                    .select("department")
                    .eq("id", csatConversation.id)
                    .single();

                  // 🆕 IDEMPOTÊNCIA ATÔMICA: Tentar inserir rating (unique constraint protege)
                  const { error: ratingError } = await supabase
                    .from("conversation_ratings")
                    .insert({
                      conversation_id: csatConversation.id,
                      rating: csatRating,
                      channel: "whatsapp",
                      feedback_text: messageContent,
                      department_id: convForDept?.department || null,
                    });
                  
                  // Verificar se é erro de duplicação (evento reenviado pelo webhook)
                  const isDuplicateError = ratingError?.code === "23505" || 
                                           ratingError?.message?.includes("duplicate") ||
                                           ratingError?.message?.includes("unique");
                  
                  if (isDuplicateError) {
                    // Evento duplicado - ignorar silenciosamente (idempotência)
                    console.log("[meta-whatsapp-webhook] ⚠️ CSAT já registrado (duplicado) - ignorando");
                    continue; // Pular para próxima mensagem
                  }
                  
                  if (ratingError) {
                    console.error("[meta-whatsapp-webhook] ❌ Error saving CSAT rating:", ratingError);
                  } else {
                    console.log("[meta-whatsapp-webhook] ✅ CSAT rating saved successfully");
                    
                    // Limpar flag - MANTER status = 'closed'
                    await supabase
                      .from("conversations")
                      .update({ awaiting_rating: false })
                      .eq("id", csatConversation.id);
                    
                    // Enviar agradecimento
                    let thankYouMessage = "";
                    if (csatRating >= 4) {
                      thankYouMessage = `🎉 Obrigado pela avaliação de ${csatRating} estrela${csatRating > 1 ? "s" : ""}!\n\nFicamos muito felizes em ter ajudado. Conte sempre conosco! 💚`;
                    } else if (csatRating === 3) {
                      thankYouMessage = `👍 Obrigado pela sua avaliação!\n\nEstamos sempre buscando melhorar. Se tiver sugestões, fique à vontade para compartilhar!`;
                    } else {
                      thankYouMessage = `🙏 Agradecemos seu feedback.\n\nLamentamos que sua experiência não tenha sido ideal. Vamos trabalhar para melhorar!`;
                    }
                    
                    // Enviar via send-meta-whatsapp
                    await supabase.functions.invoke("send-meta-whatsapp", {
                      body: {
                        instance_id: instance.id,
                        phone_number: fromNumber,
                        message: thankYouMessage,
                        conversation_id: csatConversation.id,
                        skip_db_save: true,
                        is_bot_message: true, // Agradecimento automático - NÃO mudar ai_mode
                      },
                    });
                    
                    // Inserir mensagem da avaliação na conversa fechada
                    await supabase.from("messages").insert({
                      conversation_id: csatConversation.id,
                      content: `⭐ Avaliação: ${csatRating}/5`,
                      sender_type: "contact",
                      channel: "whatsapp",
                    });
                  }
                  
                  console.log("[meta-whatsapp-webhook] ✅ CSAT processed - conversation stays CLOSED");
                  continue; // ⚠️ CRÍTICO: Pular para próxima mensagem, NÃO criar conversa
                } else {
                  // Cliente enviou mensagem não-numérica após CSAT
                  // Intenção clara: novo contato, não avaliação
                  // Limpar flag para não interceptar próximas mensagens
                  console.log(`[meta-whatsapp-webhook] 🧹 CSAT Guard: mensagem "${messageContent}" não é rating. Limpando awaiting_rating da conversa ${csatConversation.id}`);
                  await supabase
                    .from("conversations")
                    .update({ awaiting_rating: false })
                    .eq("id", csatConversation.id);
                  // NÃO usar continue - deixar mensagem seguir para fluxo normal
                }
              }
              // ============================================
              // FIM PRÉ-VERIFICAÇÃO CSAT
              // ============================================

              // Buscar conversa existente (QUALQUER provider) - priorizar aberta
              let { data: conversation } = await supabase
                .from("conversations")
                .select("id, ai_mode, status, assigned_to, awaiting_rating, whatsapp_provider, customer_metadata")
                .eq("contact_id", contact.id)
                .neq("status", "closed")
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

              if (!conversation) {
                // Nova conversa — sempre autopilot, sem pré-atribuição
                // Roteamento para consultor é 100% responsabilidade do Chat Flow
                const { data: newConv } = await supabase
                  .from("conversations")
                  .insert({
                    contact_id: contact.id,
                    channel: "whatsapp",
                    status: "open",
                    ai_mode: "autopilot",
                    assigned_to: null,
                    whatsapp_provider: "meta",
                    whatsapp_meta_instance_id: instance.id,
                  })
                  .select("id, ai_mode, status, assigned_to, awaiting_rating, whatsapp_provider, customer_metadata")
                  .single();

                conversation = newConv;
                console.log("[meta-whatsapp-webhook] 💬 New conversation created:", conversation?.id);
              } else {
                // Migrar de Evolution para Meta se necessário
                if (conversation.whatsapp_provider !== "meta") {
                  console.log("[meta-whatsapp-webhook] 🔄 Migrando conversa de", conversation.whatsapp_provider, "para Meta");
                }

                const reopenUpdate: Record<string, any> = {
                  whatsapp_provider: "meta",
                  whatsapp_meta_instance_id: instance.id,
                  whatsapp_instance_id: null, // Limpar referência Evolution
                  last_message_at: new Date().toISOString(),
                  status: "open",
                };

                // Se conversa estava fechada, resetar ai_mode para autopilot
                // para que Master Flow/IA possa assumir novamente
                if (conversation.status === "closed") {
                  reopenUpdate.ai_mode = "autopilot";
                  reopenUpdate.awaiting_rating = false;
                  reopenUpdate.closed_at = null;
                  reopenUpdate.closed_by = null;
                  reopenUpdate.closed_reason = null;
                  console.log("[meta-whatsapp-webhook] 🔄 Conversa reaberta: ai_mode resetado para autopilot");
                }

                await supabase
                  .from("conversations")
                  .update(reopenUpdate)
                  .eq("id", conversation.id);
                console.log("[meta-whatsapp-webhook] 💬 Conversation updated to Meta provider:", conversation.id);
              }

              if (!conversation) {
                console.error("[meta-whatsapp-webhook] ❌ Failed to find/create conversation");
                continue;
              }

              // Inserir mensagem (sem external_id - coluna não existe)
              const { data: savedMessage, error: msgError } = await supabase
                .from("messages")
                .insert({
                  conversation_id: conversation.id,
                  content: messageContent,
                  sender_type: "contact",
                  channel: "whatsapp",
                  message_type: mediaType || "text",
                  attachment_url: mediaId ? `meta:${mediaId}` : null,
                  attachment_type: mediaType || null,
                })
                .select("id")
                .single();

              if (msgError) {
                console.error("[meta-whatsapp-webhook] ❌ Error saving message:", msgError);
              } else {
                console.log("[meta-whatsapp-webhook] ✅ Message saved:", savedMessage?.id);

                // Trigger download de mídia se houver mediaId
                if (mediaId && savedMessage?.id) {
                  console.log("[meta-whatsapp-webhook] 📥 Triggering media download...");
                  fetch(
                    `${Deno.env.get("SUPABASE_URL")}/functions/v1/download-meta-media`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                      },
                      body: JSON.stringify({
                        meta_media_id: mediaId,
                        message_id: savedMessage.id,
                        media_type: mediaType,
                        instance_id: instance.id,
                        conversation_id: conversation.id,
                      }),
                    }
                  ).then(res => {
                    if (res.ok) {
                      console.log("[meta-whatsapp-webhook] ✅ Media download triggered");
                    } else {
                      res.text().then(txt => console.error("[meta-whatsapp-webhook] ❌ Media download failed:", txt));
                    }
                  }).catch(err => console.error("[meta-whatsapp-webhook] ❌ Media download error:", err));
                }
              }

              // ============================================
              // 🛑 KILL SWITCH CHECK - ANTES de qualquer automação
              // ============================================
              const aiConfig = await getAIConfig(supabase);
              const { data: convForTest } = await supabase
                .from("conversations")
                .select("is_test_mode")
                .eq("id", conversation.id)
                .single();
              const isTestMode = convForTest?.is_test_mode === true;

              if (!aiConfig.ai_global_enabled && !isTestMode) {
                console.log("[meta-whatsapp-webhook] 🛑 KILL SWITCH ATIVO - Bloqueando TUDO (IA/Fluxo/Fallback)");
                
                // Mover conversa para fila humana
                await supabase
                  .from("conversations")
                  .update({ ai_mode: "waiting_human" })
                  .eq("id", conversation.id);
                
                console.log("[AUTO-DECISION] [WhatsApp Meta] Kill Switch → waiting_human");
                continue; // Pular toda automação, ir para próxima mensagem
              }

              // ============================================
              // 📦 BATCH DELAY CONFIG - Buscar tempo de espera para mensagens picotadas
              // ============================================
              let batchDelaySeconds = 0; // 0 = desativado (comportamento instantâneo)
              try {
                const { data: batchConfig } = await supabase
                  .from("system_configurations")
                  .select("value")
                  .eq("key", "ai_message_batch_delay_seconds")
                  .maybeSingle();
                
                if (batchConfig?.value) {
                  batchDelaySeconds = parseInt(batchConfig.value, 10) || 0;
                }
                console.log("[meta-whatsapp-webhook] ⏱️ Batch delay:", batchDelaySeconds, "seconds");
              } catch (configErr) {
                console.error("[meta-whatsapp-webhook] ⚠️ Error fetching batch config:", configErr);
              }

              // ============================================
              // ============================================
              let flowData: {
                useAI?: boolean;
                aiNodeActive?: boolean;
                response?: string;
                options?: Array<{label: string; value?: string; id?: string}>;
                skipAutoResponse?: boolean;
                reason?: string;
                flow_context?: Record<string, unknown>;
                transfer?: boolean;
                transferType?: string;
                departmentId?: string;
                // 🆕 Novas flags para proteção de retry/invalidOption
                retry?: boolean;
                invalidOption?: boolean;
                preventAI?: boolean;
                flowId?: string;
                nodeId?: string;
              } = {};

              try {
                console.log("[meta-whatsapp-webhook] 🔄 Chamando process-chat-flow...");
                const flowResponse = await fetch(
                  `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-chat-flow`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                    },
                    body: JSON.stringify({
                      conversationId: conversation.id,
                      customerMessage: messageContent,
                    }),
                  }
                );

                if (flowResponse.ok) {
                  flowData = await flowResponse.json();
                  console.log("[meta-whatsapp-webhook] 📋 Flow response:", JSON.stringify(flowData));
                } else {
                  console.error("[meta-whatsapp-webhook] ⚠️ Flow error:", await flowResponse.text());
                }
              } catch (flowErr) {
                console.error("[meta-whatsapp-webhook] ⚠️ Flow exception:", flowErr);
              }

              // ============================================
              // 📊 DECISÃO BASEADA NO FLUXO
              // ============================================
              
              // CASO 1: skipAutoResponse = true → Cliente na fila/copilot/disabled
              // 🆕 GUARD: Se awaiting_close_confirmation, bypass skipAutoResponse → ai-autopilot-chat
              const convMeta = (conversation as any).customer_metadata || {};
              const hasAwaitingCloseConfirmation = convMeta.awaiting_close_confirmation === true;

              if (flowData.skipAutoResponse && hasAwaitingCloseConfirmation) {
                console.log("[meta-whatsapp-webhook] 🔓 BYPASS skipAutoResponse: awaiting_close_confirmation=true → chamando ai-autopilot-chat");
                try {
                  const closeConfirmResponse = await fetch(
                    `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-autopilot-chat`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                      },
                      body: JSON.stringify({
                        conversationId: conversation.id,
                        customerMessage: messageContent,
                        contact_id: contact.id,
                        whatsapp_provider: "meta",
                        whatsapp_meta_instance_id: instance.id,
                      }),
                    }
                  );
                  if (!closeConfirmResponse.ok) {
                    console.error("[meta-whatsapp-webhook] ❌ Close confirmation autopilot error:", await closeConfirmResponse.text());
                  } else {
                    console.log("[meta-whatsapp-webhook] ✅ Close confirmation processed by ai-autopilot-chat");
                  }
                } catch (closeErr) {
                  console.error("[meta-whatsapp-webhook] ⚠️ Close confirmation exception:", closeErr);
                }
                continue;
              }

              if (flowData.skipAutoResponse) {
                console.log("[AUTO-DECISION] [WhatsApp Meta] Flow skipAutoResponse → waiting_human, reason:", flowData.reason);
                
                
                // 🆕 MENSAGEM DE AGUARDE: Enviar confirmação ao cliente na fila
                // APENAS se reason indica que está esperando humano E NÃO TEM AGENTE ATRIBUÍDO
                // Se já tem agente atribuído, o atendente humano está responsável - não interferir
                const hasAssignedAgent = !!conversation.assigned_to;
                
                if (flowData.reason === 'ai_mode_waiting_human' && !hasAssignedAgent) {
                  console.log("[meta-whatsapp-webhook] 📨 Verificando rate limit para mensagem de aguarde...");
                  
                  // 🛡️ ANTI-SPAM: Verificar última mensagem de fila pelo CONTEÚDO (não por is_ai_generated)
                  // FIX: send-meta-whatsapp salva com is_ai_generated=false, então filtrar por conteúdo
                  const { data: lastQueueMsg } = await supabase
                    .from("messages")
                    .select("created_at, content")
                    .eq("conversation_id", conversation.id)
                    .eq("sender_type", "user") // "user" = bot/sistema no modelo atual
                    .ilike("content", "%fila de atendimento%")
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  
                  // Só enviar se última mensagem de fila foi há mais de 2 minutos
                  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
                  const lastMsgDate = lastQueueMsg?.created_at ? new Date(lastQueueMsg.created_at) : null;
                  const shouldSendQueueMsg = !lastMsgDate || lastMsgDate < twoMinutesAgo;
                  
                  if (shouldSendQueueMsg) {
                    console.log("[meta-whatsapp-webhook] ✅ Rate limit OK, enviando mensagem de aguarde...");
                    
                    // 🆕 FIX #2: Verificar se há agentes ONLINE no departamento
                    let queueMessage = "💬 Sua conversa já está na fila de atendimento.\n\nFique tranquilo, em breve um especialista irá te atender. 🙂";
                    
                    if ((conversation as any).department_id || (conversation as any).department) {
                      const deptId = (conversation as any).department_id || (conversation as any).department;
                      const { data: deptAgentIds } = await supabase
                        .from("agent_departments")
                        .select("profile_id")
                        .eq("department_id", deptId);
                      
                      const agentIds = (deptAgentIds || []).map((a: any) => a.profile_id);
                      const { data: onlineAgents } = await supabase
                        .from("profiles")
                        .select("id")
                        .eq("availability_status", "online")
                        .in("id", agentIds.length > 0 ? agentIds : ['__none__']);
                      
                      // Se query falhou ou retornou vazio, tentar contagem direta
                      let hasOnlineAgents = (onlineAgents && onlineAgents.length > 0);
                      
                      if (!hasOnlineAgents) {
                        // Fallback: query direta nos agent_departments + profiles
                        const { data: deptAgents } = await supabase
                          .from("agent_departments")
                          .select("profile_id, profiles!inner(availability_status)")
                          .eq("department_id", (conversation as any).department_id)
                          .eq("profiles.availability_status", "online")
                          .limit(1);

                        hasOnlineAgents = (deptAgents && deptAgents.length > 0);
                      }

                      if (!hasOnlineAgents) {
                        console.log("[meta-whatsapp-webhook] ⚠️ Nenhum agente online no departamento:", (conversation as any).department_id);
                        queueMessage = "⏳ Nosso time de atendimento não está disponível no momento.\n\nAssim que um especialista ficar online, você será atendido automaticamente. Obrigado pela paciência! 🙏";
                      }
                    }
                    
                    try {
                      await supabase.functions.invoke("send-meta-whatsapp", {
                        body: {
                          instance_id: instance.id,
                          phone_number: fromNumber,
                          message: queueMessage,
                          conversation_id: conversation.id,
                          skip_db_save: false,
                          is_bot_message: true,
                        },
                      });
                      console.log("[meta-whatsapp-webhook] ✅ Mensagem de aguarde enviada");
                    } catch (queueErr) {
                      console.error("[meta-whatsapp-webhook] ⚠️ Erro ao enviar mensagem de aguarde:", queueErr);
                    }
                  } else {
                    console.log("[meta-whatsapp-webhook] ⏱️ Rate limit ativo, última msg de fila:", lastMsgDate?.toISOString());
                  }
                }

                // 🛡️ REGRA CRÍTICA: NÃO rebaixar copilot/disabled para waiting_human
                // Quando existe agente atribuído, a conversa está sob controle humano.
                // A proteção do process-chat-flow retorna skipAutoResponse para evitar automação,
                // mas isso NÃO deve mudar o ai_mode.
                const shouldForceWaitingHuman =
                  flowData.reason === 'ai_mode_waiting_human' && !hasAssignedAgent;

                if (shouldForceWaitingHuman && conversation.ai_mode !== 'waiting_human') {
                  await supabase
                    .from("conversations")
                    .update({ ai_mode: "waiting_human" })
                    .eq("id", conversation.id);
                }
                
                continue;
              }

              // CASO 2: Fluxo retornou resposta estática (Message/AskOptions/etc)
              // 🆕 INCLUI proteção para retry de opção inválida
              if (!flowData.useAI && flowData.response) {
                // 🆕 Log de auditoria para retry de opção inválida
                if (flowData.retry && flowData.invalidOption) {
                  console.log("[meta-whatsapp-webhook] 🔄 RETRY opção inválida - preventAI:", flowData.preventAI);
                  console.log("[meta-whatsapp-webhook] 📋 Enviando APENAS resposta estática do fluxo");
                }
                
                // 🆕 Formatar opções junto com a mensagem se existirem
                const formattedMessage = flowData.response + formatOptionsAsText(flowData.options);
                
                console.log("[AUTO-DECISION] [WhatsApp Meta] Flow static response → send-meta-whatsapp");
                console.log("[meta-whatsapp-webhook] 📝 Message with options:", formattedMessage.substring(0, 200));
                
                try {
                  const sendResponse = await supabase.functions.invoke("send-meta-whatsapp", {
                    body: {
                      instance_id: instance.id,
                      phone_number: fromNumber,
                      message: formattedMessage,
                      conversation_id: conversation.id,
                      skip_db_save: false,
                      is_bot_message: true,
                      metadata: (flowData as any).flowName ? { flow_id: (flowData as any).flowId, flow_name: (flowData as any).flowName } : undefined,
                    },
                  });
                  
                  if (sendResponse.error) {
                    console.error("[meta-whatsapp-webhook] ❌ Erro ao enviar resposta do fluxo:", sendResponse.error);
                  } else {
                    console.log("[meta-whatsapp-webhook] ✅ Resposta do fluxo enviada com opções");
                  }
                } catch (sendErr) {
                  console.error("[meta-whatsapp-webhook] ❌ Exception ao enviar resposta do fluxo:", sendErr);
                }
                
                // 🆕 EXECUTAR TRANSFERÊNCIA SE NECESSÁRIO
                if (flowData.transfer) {
                  console.log("[meta-whatsapp-webhook] 🔄 Executing transfer to department:", flowData.departmentId, "type:", flowData.transferType);
                  
                  const updateData: Record<string, unknown> = {
                    ai_mode: 'waiting_human',
                    handoff_executed_at: new Date().toISOString(),
                  };
                  
                  // 🆕 Fallback: se flow não retornou departmentId, usar Suporte
                  const DEPT_SUPORTE_FALLBACK = depts.SUPORTE_ID;
                  updateData.department = flowData.departmentId || DEPT_SUPORTE_FALLBACK;

                  // ═══════════════════════════════════════════════════════════════
                  // 🔒 TRAVA TRANSFER-PERSIST-LOCK v1.1 — 2026-03-03
                  // UPGRADE: transfer_type=consultant força busca de consultor
                  //   mesmo quando consultant_manually_removed=true (vai pro pool)
                  // ═══════════════════════════════════════════════════════════════
                  const isConsultantTransfer = flowData.transferType === 'consultant';
                  const isPreferredTransfer = flowData.transferType === 'preferred';
                  
                  const { data: contactConsultantData } = await supabase
                    .from('contacts')
                    .select('consultant_id, consultant_manually_removed, preferred_agent_id, preferred_department_id, organization_id')
                    .eq('id', contact.id)
                    .maybeSingle();

                  // ═══════════════════════════════════════════════════════════════
                  // 🆕 PREFERRED TRANSFER: Cadeia de prioridade
                  // 1. preferred_agent_id → 2. preferred_department_id → 3. org default dept → 4. fallback
                  // ═══════════════════════════════════════════════════════════════
                  if (isPreferredTransfer && contactConsultantData) {
                    let resolved = false;

                    // 1. Atendente preferido
                    if (contactConsultantData.preferred_agent_id) {
                      const { data: agentStatus } = await supabase
                        .from('profiles')
                        .select('id, availability_status')
                        .eq('id', contactConsultantData.preferred_agent_id)
                        .maybeSingle();
                      
                      if (agentStatus) {
                        updateData.assigned_to = agentStatus.id;
                        updateData.ai_mode = 'copilot';
                        console.log("[meta-whatsapp-webhook] 👤 Preferred: atribuindo ao atendente preferido:", agentStatus.id, "status:", agentStatus.availability_status);
                        resolved = true;
                      }
                    }

                    // 2. Departamento preferido
                    if (!resolved && contactConsultantData.preferred_department_id) {
                      updateData.department = contactConsultantData.preferred_department_id;
                      console.log("[meta-whatsapp-webhook] 🏢 Preferred: departamento preferido do contato:", contactConsultantData.preferred_department_id);
                      resolved = true;
                    }

                    // 3. Departamento padrão da organização
                    if (!resolved && contactConsultantData.organization_id) {
                      const { data: orgData } = await supabase
                        .from('organizations')
                        .select('default_department_id')
                        .eq('id', contactConsultantData.organization_id)
                        .maybeSingle();
                      
                      if (orgData?.default_department_id) {
                        updateData.department = orgData.default_department_id;
                        console.log("[meta-whatsapp-webhook] 🏢 Preferred: departamento padrão da organização:", orgData.default_department_id);
                        resolved = true;
                      }
                    }

                    // 4. Fallback: usa department_id do nó (já definido acima)
                    if (!resolved) {
                      console.log("[meta-whatsapp-webhook] 🔄 Preferred: usando fallback do nó:", updateData.department);
                    }
                  }

                  // 🛡️ consultantId só é populado quando transfer_type=consultant
                  let consultantId: string | null = null;

                  if (isConsultantTransfer) {
                    // Só busca consultor quando é transferência explícita para consultor
                    if (contactConsultantData?.consultant_manually_removed) {
                      console.log("[meta-whatsapp-webhook] 🚫 consultant_manually_removed=true, consultor não será atribuído para contato:", contact.id);
                    } else {
                      consultantId = contactConsultantData?.consultant_id || null;
                    }

                    // 🆕 Se não tem consultor pelo contato, buscar pelo email coletado no fluxo
                    if (!consultantId) {
                      let emailToSearch: string | null = null;

                      // 1. Tentar do collectedData do fluxo
                      const collectedEmail = (flowData as any).collectedData?.email;
                      if (collectedEmail && typeof collectedEmail === 'string') {
                        emailToSearch = collectedEmail.toLowerCase().trim();
                        console.log("[meta-whatsapp-webhook] 📧 Email encontrado no collectedData:", emailToSearch);
                      }

                      // 2. Fallback: buscar email nas mensagens recentes
                      if (!emailToSearch) {
                        const { data: recentMsgs } = await supabase
                          .from('messages')
                          .select('content')
                          .eq('conversation_id', conversation.id)
                          .eq('sender_type', 'contact')
                          .order('created_at', { ascending: false })
                          .limit(10);

                        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
                        for (const msg of recentMsgs || []) {
                          const match = msg.content?.match(emailRegex);
                          if (match) {
                            emailToSearch = match[0].toLowerCase();
                            console.log("[meta-whatsapp-webhook] 📧 Email encontrado nas mensagens:", emailToSearch);
                            break;
                          }
                        }
                      }

                      // 3. Buscar contato com esse email que tenha consultor
                      if (emailToSearch) {
                        const { data: emailContact } = await supabase
                          .from('contacts')
                          .select('consultant_id')
                          .ilike('email', emailToSearch)
                          .not('consultant_id', 'is', null)
                          .maybeSingle();

                        if (emailContact?.consultant_id) {
                          consultantId = emailContact.consultant_id;
                          console.log("[meta-whatsapp-webhook] 👤 Consultor encontrado pelo email:", emailToSearch, "→", consultantId);
                        }
                      }
                    }
                  } else {
                    console.log("[meta-whatsapp-webhook] 🏢 transfer_type não é 'consultant', consultantId=null → pool do departamento");
                  }

                  if (consultantId) {
                    updateData.assigned_to = consultantId;
                    updateData.ai_mode = 'copilot';
                    console.log("[meta-whatsapp-webhook] 👤 Atribuindo ao consultor:", consultantId);

                    // Persistir consultant_id no contato para routing futuro
                    const { error: contactUpdateError } = await supabase
                      .from('contacts')
                      .update({ consultant_id: consultantId })
                      .eq('id', contact.id);

                    if (contactUpdateError) {
                      console.error("[meta-whatsapp-webhook] ❌ Erro ao salvar consultant_id no contato:", contactUpdateError);
                    } else {
                      console.log("[meta-whatsapp-webhook] ✅ consultant_id salvo no contato:", contact.id, "→", consultantId);
                    }
                  }
                  
                  const { error: updateError } = await supabase
                    .from("conversations")
                    .update(updateData)
                    .eq("id", conversation.id);
                  
                  if (updateError) {
                    console.error("[meta-whatsapp-webhook] ❌ Error executing transfer:", updateError);
                  } else {
                    console.log("[meta-whatsapp-webhook] ✅ Transfer executed → department:", updateData.department, 
                      "ai_mode:", consultantId ? 'copilot' : 'waiting_human',
                      "assigned_to:", consultantId || 'pool');
                    
                    // 🆕 Chamar route-conversation para distribuir ao agente automaticamente
                    if (!consultantId) {
                      try {
                        console.log("[meta-whatsapp-webhook] 🚀 Calling route-conversation for:", conversation.id);
                        const routeResp = await fetch(
                          `${Deno.env.get("SUPABASE_URL")}/functions/v1/route-conversation`,
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                            },
                            body: JSON.stringify({ conversationId: conversation.id }),
                          }
                        );
                        if (!routeResp.ok) {
                          console.error("[meta-whatsapp-webhook] ❌ route-conversation error:", await routeResp.text());
                        } else {
                          const routeResult = await routeResp.json();
                          console.log("[meta-whatsapp-webhook] ✅ route-conversation result:", JSON.stringify(routeResult));
                        }
                      } catch (routeErr) {
                        console.error("[meta-whatsapp-webhook] ⚠️ route-conversation exception:", routeErr);
                      }
                    }
                  }
                }
                
                continue;
              }

              // CASO 2.5: 🆕 preventAI=true sem response → Proteção adicional
              if (flowData.preventAI === true) {
                console.log("[meta-whatsapp-webhook] 🛡️ preventAI ativo sem response - bloqueando IA");
                continue;
              }

              // CASO 3: Fluxo ativou AIResponseNode → Chamar IA com flow_context
              if (flowData.useAI && flowData.aiNodeActive) {
                // 🆕 FIX v2: Se skipInitialMessage=true (transição ask_options → ai_response),
                // NÃO enviar o dígito de menu — mas CHAMAR a IA com mensagem vazia para saudação proativa
                if ((flowData as any).skipInitialMessage === true) {
                  console.log("[meta-whatsapp-webhook] ⏭️ V15 Bug27: skipInitialMessage=true — chamando IA com mensagem vazia para saudação proativa", {
                    conversationId: conversation.id,
                    contactId: contact.id,
                    nodeId: (flowData as any).nodeId,
                    flowId: (flowData as any).flowId,
                    timestamp: new Date().toISOString(),
                    originalMessage: messageContent?.substring(0, 20),
                  });
                  try {
                    const greetResponse = await fetch(
                      `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-autopilot-chat`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                        },
                        body: JSON.stringify({
                          conversationId: conversation.id,
                          customerMessage: "",
                          contact_id: contact.id,
                          whatsapp_provider: "meta",
                          whatsapp_meta_instance_id: instance.id,
                          flow_context: flowData.flow_context || {
                            flow_id: flowData.flowId,
                            node_id: flowData.nodeId,
                            node_type: 'ai_response',
                            stateId: (flowData as any).debug?.stateId || (flowData as any).stateId || null,
                            allowed_sources: (flowData as any).allowedSources || ['kb'],
                            response_format: 'text_only',
                            personaId: (flowData as any).personaId || null,
                            kbCategories: (flowData as any).kbCategories || null,
                            kbProductFilter: (flowData as any).kbProductFilter || null,
                            contextPrompt: (flowData as any).contextPrompt || null,
                            fallbackMessage: (flowData as any).fallbackMessage || null,
                            objective: (flowData as any).objective || null,
                            maxSentences: (flowData as any).maxSentences ?? 3,
                            forbidQuestions: (flowData as any).forbidQuestions ?? true,
                            forbidOptions: (flowData as any).forbidOptions ?? true,
                            forbidFinancial: (flowData as any).forbidFinancial ?? false,
                            forbidCommercial: (flowData as any).forbidCommercial ?? false,
                            forbidCancellation: (flowData as any).forbidCancellation ?? false,
                            forbidConsultant: (flowData as any).forbidConsultant ?? false,
                            forbidSupport: (flowData as any).forbidSupport ?? false,
                            returnReasons: (flowData as any).returnReasons || null,
                            ticketConfig: (flowData as any).ticketConfig || null,
                            otpVerified: (flowData as any).otpVerified || false,
                            collectedData: (flowData as any).collectedData || null,
                            smartCollectionEnabled: (flowData as any).smartCollectionEnabled ?? false,
                            smartCollectionFields: (flowData as any).smartCollectionFields || [],
                          },
                        }),
                      }
                    );
                    if (!greetResponse.ok) {
                      const errText = await greetResponse.text();
                      console.error("[meta-whatsapp-webhook] ❌ Proactive greeting error:", errText);
                      // 🆕 FIX Bug A (#EEFFF1DD): Fallback — enviar saudação padrão direto via WhatsApp
                      try {
                        const fallbackGreeting = "Olá! Sou a assistente virtual da 3Cliques. Posso te ajudar com informações financeiras, saques, reembolsos e dúvidas gerais. Como posso te ajudar? 😊";
                        await supabase.from('messages').insert({
                          conversation_id: conversation.id, content: fallbackGreeting,
                          sender_type: 'user', is_ai_generated: true, channel: 'whatsapp'
                        });
                        const sendUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-meta-whatsapp`;
                        await fetch(sendUrl, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                          body: JSON.stringify({ instance_id: instance.id, phone_number: fromNumber, message: fallbackGreeting, conversation_id: conversation.id, is_bot_message: true })
                        });
                        console.log("[meta-whatsapp-webhook] ✅ Fallback greeting enviado direto via WhatsApp");
                      } catch (fbErr) {
                        console.error("[meta-whatsapp-webhook] ❌ Fallback greeting also failed:", fbErr);
                      }
                    } else {
                      console.log("[meta-whatsapp-webhook] ✅ Saudação proativa enviada via skipInitialMessage");
                    }
                  } catch (greetErr) {
                    console.error("[meta-whatsapp-webhook] ❌ Proactive greeting exception:", greetErr);
                    // 🆕 FIX Bug A (#EEFFF1DD): Fallback também no catch geral
                    try {
                      const fallbackGreeting = "Olá! Sou a assistente virtual da 3Cliques. Posso te ajudar com informações financeiras, saques, reembolsos e dúvidas gerais. Como posso te ajudar? 😊";
                      await supabase.from('messages').insert({
                        conversation_id: conversation.id, content: fallbackGreeting,
                        sender_type: 'user', is_ai_generated: true, channel: 'whatsapp'
                      });
                      const sendUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-meta-whatsapp`;
                      await fetch(sendUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                        body: JSON.stringify({ instance_id: instance.id, phone_number: fromNumber, message: fallbackGreeting, conversation_id: conversation.id, is_bot_message: true })
                      });
                      console.log("[meta-whatsapp-webhook] ✅ Fallback greeting (catch) enviado direto via WhatsApp");
                    } catch (fbErr2) {
                      console.error("[meta-whatsapp-webhook] ❌ Fallback greeting (catch) also failed:", fbErr2);
                    }
                  }
                  continue;
                }
                // FIX: Se process-chat-flow retornou aiNodeActive=true, a soberania do fluxo
                // já restaurou ai_mode para autopilot no DB. Confiar no fluxo em vez do objeto stale.
                const effectiveAiMode = (flowData.useAI && flowData.aiNodeActive) 
                  ? "autopilot" 
                  : conversation.ai_mode;
                if (effectiveAiMode === "autopilot" && !conversation.awaiting_rating) {
                  
                  // 📦 BATCHING: Se delay > 0, acumular mensagem no buffer em vez de chamar IA diretamente
                  if (batchDelaySeconds > 0) {
                    console.log(`[meta-whatsapp-webhook] 📦 BATCHING: Salvando mensagem no buffer (delay: ${batchDelaySeconds}s) - flow AI node`);
                    
                    try {
                      await bufferAndSchedule(supabase, conversation.id, messageContent, batchDelaySeconds, {
                        contactId: contact.id,
                        instanceId: instance.id,
                        fromNumber,
                        flowContext: flowData.flow_context as Record<string, unknown> || undefined,
                        flowData: {
                          useAI: flowData.useAI,
                          aiNodeActive: flowData.aiNodeActive,
                          skipInitialMessage: (flowData as any).skipInitialMessage || false,
                          flowId: flowData.flowId,
                          nodeId: flowData.nodeId,
                          allowedSources: (flowData as any).allowedSources,
                          personaId: (flowData as any).personaId,
                          kbCategories: (flowData as any).kbCategories,
                          kbProductFilter: (flowData as any).kbProductFilter,
                          contextPrompt: (flowData as any).contextPrompt,
                          fallbackMessage: (flowData as any).fallbackMessage,
                          objective: (flowData as any).objective,
                          maxSentences: (flowData as any).maxSentences,
                          forbidQuestions: (flowData as any).forbidQuestions,
                          forbidOptions: (flowData as any).forbidOptions,
                          forbidFinancial: (flowData as any).forbidFinancial,
                          forbidCommercial: (flowData as any).forbidCommercial,
                          forbidCancellation: (flowData as any).forbidCancellation,
                          forbidConsultant: (flowData as any).forbidConsultant,
                        },
                      });
                    } catch (bufferErr) {
                      console.error("[meta-whatsapp-webhook] ❌ Buffer error, falling back to direct call:", bufferErr);
                      // Fallback: chamar IA diretamente se buffer falhar
                    }
                    
                    // Se buffer teve sucesso, skip para próxima mensagem
                    // O timer vai processar quando expirar
                    continue;
                  }

                  // 🔄 CHAMADA DIRETA (sem batching ou fallback)
                  console.log("[AUTO-DECISION] [WhatsApp Meta] Flow aiNodeActive=true → ai-autopilot-chat");

                  try {
                    const autopilotResponse = await fetch(
                      `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-autopilot-chat`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                        },
                        body: JSON.stringify({
                          conversationId: conversation.id,
                          customerMessage: messageContent,
                          contact_id: contact.id,
                          whatsapp_provider: "meta",
                          whatsapp_meta_instance_id: instance.id,
                          flow_context: flowData.flow_context || {
                            flow_id: flowData.flowId,
                            node_id: flowData.nodeId,
                            node_type: 'ai_response',
                            stateId: (flowData as any).debug?.stateId || (flowData as any).stateId || null,
                            allowed_sources: (flowData as any).allowedSources || ['kb'],
                            response_format: 'text_only',
                            personaId: (flowData as any).personaId || null,
                            kbCategories: (flowData as any).kbCategories || null,
                            kbProductFilter: (flowData as any).kbProductFilter || null,
                            contextPrompt: (flowData as any).contextPrompt || null,
                            fallbackMessage: (flowData as any).fallbackMessage || null,
                            objective: (flowData as any).objective || null,
                            maxSentences: (flowData as any).maxSentences ?? 3,
                            forbidQuestions: (flowData as any).forbidQuestions ?? true,
                            forbidOptions: (flowData as any).forbidOptions ?? true,
                          forbidFinancial: (flowData as any).forbidFinancial ?? false,
                          forbidCommercial: (flowData as any).forbidCommercial ?? false,
                          forbidCancellation: (flowData as any).forbidCancellation ?? false,
                          forbidConsultant: (flowData as any).forbidConsultant ?? false,
                          forbidSupport: (flowData as any).forbidSupport ?? false,
                          returnReasons: (flowData as any).returnReasons || null,
                          ticketConfig: (flowData as any).ticketConfig || null,
                          otpVerified: (flowData as any).otpVerified || false,
                          collectedData: (flowData as any).collectedData || null,
                          smartCollectionEnabled: (flowData as any).smartCollectionEnabled ?? false,
                          smartCollectionFields: (flowData as any).smartCollectionFields || [],
                          },
                        }),
                      }
                    );

                    if (!autopilotResponse.ok) {
                      console.error("[meta-whatsapp-webhook] ❌ Autopilot error:", await autopilotResponse.text());
                    } else {
                      // Verificar se financialBlocked veio na resposta
                      try {
                        const autopilotData = await autopilotResponse.json();
                        if (autopilotData?.financialBlocked) {
                          // Se autopilot tem flow_context, re-invocar process-chat-flow para avançar ao próximo nó
                          if (autopilotData?.hasFlowContext) {
                            console.log("[meta-whatsapp-webhook] 🔒 financialBlocked + hasFlowContext → re-invocando process-chat-flow com forceFinancialExit");
                            
                            try {
                              const flowResponse = await fetch(
                                `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-chat-flow`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                                  },
                                  body: JSON.stringify({
                                    conversationId: conversation.id,
                                    customerMessage: messageContent,
                                    forceFinancialExit: true,
                                    intentData: { ai_exit_intent: 'financeiro' },
                                  }),
                                }
                              );
                              
                              if (flowResponse.ok) {
                                const flowData = await flowResponse.json();
                                console.log("[meta-whatsapp-webhook] ✅ process-chat-flow re-invoked (forceFinancialExit):", JSON.stringify({
                                  transfer: flowData.transfer,
                                  hasResponse: !!flowData.response,
                                  nodeType: flowData.nodeType,
                                  departmentId: flowData.departmentId,
                                }));
                                
                                // Se o flow retornou mensagem, enviar via Meta API
                                const flowMessageRaw = flowData.response || flowData.message;
                                const flowMessage = flowMessageRaw
                                  ? flowMessageRaw + formatOptionsAsText(flowData.options)
                                  : null;
                                if (flowMessage) {
                                  await supabase.functions.invoke("send-meta-whatsapp", {
                                    body: {
                                      instance_id: instance.id,
                                      phone_number: fromNumber,
                                      message: flowMessage,
                                      conversation_id: conversation.id,
                                      skip_db_save: false,
                                      is_bot_message: true,
                                      metadata: (flowData as any).flowName ? { flow_id: (flowData as any).flowId, flow_name: (flowData as any).flowName } : undefined,
                                    },
                                  });
                                  console.log("[meta-whatsapp-webhook] ✅ Flow next-node message sent (financial exit)");
                                }
                                
                                // Se o flow retornou transfer, aplicar
                                const transferDept = flowData.departmentId || flowData.department;
                                if ((flowData.transfer === true || flowData.action === 'transfer') && transferDept) {
                                  await supabase
                                    .from('conversations')
                                    .update({
                                      ai_mode: 'waiting_human',
                                      department: transferDept,
                                      assigned_to: null,
                                    })
                                    .eq('id', conversation.id);
                                  console.log("[meta-whatsapp-webhook] 🔄 Transfer applied from flow (financial exit) → dept:", transferDept);
                                }
                                
                                continue; // Flow handled it
                              } else {
                                console.error("[meta-whatsapp-webhook] ❌ process-chat-flow re-invoke failed (attempt 1):", await flowResponse.text());
                                
                                // 🆕 RETRY: Segunda tentativa antes de fallback
                                console.log("[meta-whatsapp-webhook] 🔄 Retrying process-chat-flow (attempt 2)...");
                                try {
                                  const retryResponse = await fetch(
                                    `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-chat-flow`,
                                    {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                                      },
                                      body: JSON.stringify({
                                        conversationId: conversation.id,
                                        customerMessage: messageContent,
                                        forceFinancialExit: true,
                                        intentData: { ai_exit_intent: 'financeiro' },
                                      }),
                                    }
                                  );
                                  if (retryResponse.ok) {
                                    const retryData = await retryResponse.json();
                                    console.log("[meta-whatsapp-webhook] ✅ Retry succeeded:", JSON.stringify({ transfer: retryData.transfer, hasResponse: !!retryData.response, nodeType: retryData.nodeType }));
                                    const retryMessageRaw = retryData.response || retryData.message;
                                    const retryMessage = retryMessageRaw
                                      ? retryMessageRaw + formatOptionsAsText(retryData.options)
                                      : null;
                                    if (retryMessage) {
                                      await supabase.functions.invoke("send-meta-whatsapp", {
                                        body: {
                                          instance_id: instance.id,
                                          phone_number: fromNumber,
                                          message: retryMessage,
                                          conversation_id: conversation.id,
                                          skip_db_save: false,
                                          is_bot_message: true,
                                          metadata: retryData.flowName ? { flow_id: retryData.flowId, flow_name: retryData.flowName } : undefined,
                                        },
                                      });
                                    }
                                    const retryDept = retryData.departmentId || retryData.department;
                                    if ((retryData.transfer === true || retryData.action === 'transfer') && retryDept) {
                                      await supabase.from('conversations').update({ ai_mode: 'waiting_human', department: retryDept, assigned_to: null }).eq('id', conversation.id);
                                    }
                                    continue; // Retry handled it
                                  } else {
                                    console.error("[meta-whatsapp-webhook] ❌ Retry also failed:", await retryResponse.text());
                                  }
                                } catch (retryErr) {
                                  console.error("[meta-whatsapp-webhook] ❌ Retry exception:", retryErr);
                                }
                              }
                            } catch (flowErr) {
                              console.error("[meta-whatsapp-webhook] ❌ Error re-invoking process-chat-flow:", flowErr);
                            }
                          }
                          
                          // 🆕 FIX: Fallback hardcoded SOMENTE quando NÃO tem flow context ativo
                          // Se hasFlowContext=true, o flow deveria ter resolvido acima. Não fazer handoff hardcoded.
                          if (autopilotData?.hasFlowContext) {
                            console.log("[meta-whatsapp-webhook] ⚠️ financialBlocked + hasFlowContext=true mas flow re-invoke falhou 2x. Mantendo no fluxo sem handoff hardcoded.");
                            // Não fazer handoff — a conversa fica no nó atual do fluxo
                            // O próximo message do cliente vai re-tentar o flow normalmente
                            continue;
                          }
                          
                          // Fallback: sem flow context → handoff genérico para Financeiro
                          console.log("[meta-whatsapp-webhook] 🔒 financialBlocked=true + hasFlowContext=false → enviando handoff msg (fallback)");
                          
                          const handoffMsg = autopilotData.response || 'Entendi. Para assuntos financeiros, vou te encaminhar para um atendente humano agora.';
                          
                          try {
                            const metaToken = instance.whatsapp_meta_token || Deno.env.get("WHATSAPP_META_TOKEN");
                            const phoneNumberId = instance.whatsapp_meta_phone_id || Deno.env.get("WHATSAPP_META_PHONE_NUMBER_ID");
                            
                            if (metaToken && phoneNumberId) {
                              await supabase.functions.invoke("send-meta-whatsapp", {
                                body: {
                                  instance_id: instance.id,
                                  phone_number: fromNumber,
                                  message: handoffMsg,
                                  conversation_id: conversation.id,
                                  skip_db_save: true,
                                },
                              });
                              console.log("[meta-whatsapp-webhook] ✅ Handoff message sent (financial block fallback)");
                              
                              await supabase.from("messages").insert({
                                conversation_id: conversation.id,
                                content: handoffMsg,
                                sender_type: "system",
                                message_type: "text",
                              });
                            }
                            
                            // 🔒 FIX: Atualizar conversa para waiting_human + departamento financeiro
                            let financialDeptId: string | null = null;
                            try {
                              const { data: deptRow } = await supabase
                                .from('departments')
                                .select('id')
                                .ilike('name', '%financ%')
                                .eq('is_active', true)
                                .limit(1)
                                .maybeSingle();
                              financialDeptId = deptRow?.id || null;
                            } catch (deptErr) {
                              console.error("[meta-whatsapp-webhook] ⚠️ Erro buscando dept financeiro:", deptErr);
                            }

                            const convUpdateFallback: any = { ai_mode: 'waiting_human', assigned_to: null };
                            if (financialDeptId) convUpdateFallback.department = financialDeptId;
                            
                            await supabase
                              .from('conversations')
                              .update(convUpdateFallback)
                              .eq('id', conversation.id);
                            console.log("[meta-whatsapp-webhook] ✅ Conversa atualizada para waiting_human (financial fallback), dept:", financialDeptId || 'genérico');

                            // Completar flow state se existir
                            try {
                              await supabase
                                .from('chat_flow_states')
                                .update({ status: 'transferred', completed_at: new Date().toISOString() })
                                .eq('conversation_id', conversation.id)
                                .in('status', ['in_progress', 'active', 'waiting_input']);
                              console.log("[meta-whatsapp-webhook] ✅ Flow state marcado como transferred (financial fallback)");
                            } catch (flowStateErr) {
                              console.error("[meta-whatsapp-webhook] ⚠️ Erro atualizando flow state:", flowStateErr);
                            }
                          } catch (sendErr) {
                            console.error("[meta-whatsapp-webhook] ⚠️ Error sending handoff msg:", sendErr);
                          }
                          
                          continue;
                        }
                        
                        // 🛒 TRAVA COMERCIAL: commercialBlocked
                        if (autopilotData?.commercialBlocked) {
                          const DEPT_COMERCIAL_ID = depts.COMERCIAL_ID;
                          
                          if (autopilotData?.hasFlowContext) {
                            console.log("[meta-whatsapp-webhook] 🛒 commercialBlocked + hasFlowContext → re-invocando process-chat-flow com forceCommercialExit");
                            
                            try {
                              const flowResponse = await fetch(
                                `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-chat-flow`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                                  },
                                  body: JSON.stringify({
                                    conversationId: conversation.id,
                                    customerMessage: messageContent,
                                    forceCommercialExit: true,
                                    intentData: { ai_exit_intent: 'comercial' },
                                  }),
                                }
                              );
                              
                              if (flowResponse.ok) {
                                const flowData = await flowResponse.json();
                                console.log("[meta-whatsapp-webhook] ✅ process-chat-flow re-invoked (forceCommercialExit):", JSON.stringify({
                                  transfer: flowData.transfer,
                                  hasResponse: !!flowData.response,
                                  departmentId: flowData.departmentId,
                                }));
                                
                                const flowMessageRaw = flowData.response || flowData.message;
                                const flowMessage = flowMessageRaw
                                  ? flowMessageRaw + formatOptionsAsText(flowData.options)
                                  : null;
                                if (flowMessage) {
                                  await supabase.functions.invoke("send-meta-whatsapp", {
                                    body: {
                                      instance_id: instance.id,
                                      phone_number: fromNumber,
                                      message: flowMessage,
                                      conversation_id: conversation.id,
                                      skip_db_save: false,
                                      is_bot_message: true,
                                      metadata: (flowData as any).flowName ? { flow_id: (flowData as any).flowId, flow_name: (flowData as any).flowName } : undefined,
                                    },
                                  });
                                  console.log("[meta-whatsapp-webhook] ✅ Flow next-node message sent (commercial exit)");
                                }
                                
                                const transferDept = flowData.departmentId || flowData.department || DEPT_COMERCIAL_ID;
                                if ((flowData.transfer === true || flowData.action === 'transfer') && transferDept) {
                                  await supabase
                                    .from('conversations')
                                    .update({
                                      ai_mode: 'waiting_human',
                                      department: transferDept,
                                      assigned_to: null,
                                    })
                                    .eq('id', conversation.id);
                                  console.log("[meta-whatsapp-webhook] 🔄 Transfer applied from flow (commercial exit) → dept:", transferDept);
                                }
                                
                                continue;
                              } else {
                                console.error("[meta-whatsapp-webhook] ❌ process-chat-flow re-invoke failed (commercial, attempt 1):", await flowResponse.text());
                                
                                // 🆕 RETRY: Segunda tentativa (paridade com financeiro)
                                console.log("[meta-whatsapp-webhook] 🔄 Retrying process-chat-flow (commercial, attempt 2)...");
                                try {
                                  const retryResponse = await fetch(
                                    `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-chat-flow`,
                                    {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                                      },
                                      body: JSON.stringify({
                                        conversationId: conversation.id,
                                        customerMessage: messageContent,
                                        forceCommercialExit: true,
                                        intentData: { ai_exit_intent: 'comercial' },
                                      }),
                                    }
                                  );
                                  if (retryResponse.ok) {
                                    const retryData = await retryResponse.json();
                                    console.log("[meta-whatsapp-webhook] ✅ Commercial retry succeeded:", JSON.stringify({ transfer: retryData.transfer, hasResponse: !!retryData.response }));
                                    const retryMessageRaw = retryData.response || retryData.message;
                                    const retryMessage = retryMessageRaw
                                      ? retryMessageRaw + formatOptionsAsText(retryData.options)
                                      : null;
                                    if (retryMessage) {
                                      await supabase.functions.invoke("send-meta-whatsapp", {
                                        body: {
                                          instance_id: instance.id,
                                          phone_number: fromNumber,
                                          message: retryMessage,
                                          conversation_id: conversation.id,
                                          skip_db_save: false,
                                          is_bot_message: true,
                                          metadata: retryData.flowName ? { flow_id: retryData.flowId, flow_name: retryData.flowName } : undefined,
                                        },
                                      });
                                    }
                                    const retryDept = retryData.departmentId || retryData.department || DEPT_COMERCIAL_ID;
                                    if ((retryData.transfer === true || retryData.action === 'transfer') && retryDept) {
                                      await supabase.from('conversations').update({ ai_mode: 'waiting_human', department: retryDept, assigned_to: null }).eq('id', conversation.id);
                                    }
                                    continue;
                                  } else {
                                    console.error("[meta-whatsapp-webhook] ❌ Commercial retry also failed:", await retryResponse.text());
                                  }
                                } catch (retryErr) {
                                  console.error("[meta-whatsapp-webhook] ❌ Commercial retry exception:", retryErr);
                                }
                              }
                            } catch (flowErr) {
                              console.error("[meta-whatsapp-webhook] ❌ Error re-invoking process-chat-flow (commercial):", flowErr);
                            }
                            
                            // 🆕 FIX: Se hasFlowContext=true e ambas tentativas falharam, manter no fluxo
                            if (autopilotData?.hasFlowContext) {
                              console.log("[meta-whatsapp-webhook] ⚠️ commercialBlocked + hasFlowContext=true mas flow re-invoke falhou 2x. Mantendo no fluxo sem handoff hardcoded.");
                              continue;
                            }
                          }
                          
                          // Fallback: sem flow context OU re-invoke falhou → handoff direto para Comercial
                          console.log("[meta-whatsapp-webhook] 🛒 commercialBlocked=true → enviando handoff msg para Comercial");
                          
                          const commercialHandoffMsg = autopilotData.response || 'Ótimo! Vou te conectar com nosso time comercial para te ajudar com isso.';
                          
                          try {
                            const metaToken = instance.whatsapp_meta_token || Deno.env.get("WHATSAPP_META_TOKEN");
                            const phoneNumberId = instance.whatsapp_meta_phone_id || Deno.env.get("WHATSAPP_META_PHONE_NUMBER_ID");
                            
                            if (metaToken && phoneNumberId) {
                              await supabase.functions.invoke("send-meta-whatsapp", {
                                body: {
                                  instance_id: instance.id,
                                  phone_number: fromNumber,
                                  message: commercialHandoffMsg,
                                  conversation_id: conversation.id,
                                  skip_db_save: true,
                                },
                              });
                              console.log("[meta-whatsapp-webhook] ✅ Handoff message sent (commercial block)");
                              
                              await supabase.from("messages").insert({
                                conversation_id: conversation.id,
                                content: commercialHandoffMsg,
                                sender_type: "system",
                                message_type: "text",
                              });
                            }
                            
                            // Transfer direto para Comercial - Nacional
                            await supabase
                              .from('conversations')
                              .update({
                                ai_mode: 'waiting_human',
                                department: DEPT_COMERCIAL_ID,
                                assigned_to: null,
                              })
                              .eq('id', conversation.id);
                            console.log("[meta-whatsapp-webhook] 🔄 Transfer applied (commercial block fallback) → dept:", DEPT_COMERCIAL_ID);
                          } catch (sendErr) {
                            console.error("[meta-whatsapp-webhook] ⚠️ Error sending commercial handoff msg:", sendErr);
                          }
                          
                          continue;
                        }
                        
                        // 🚫 TRAVA CANCELAMENTO: cancellationBlocked
                        if (autopilotData?.cancellationBlocked) {
                          if (autopilotData?.hasFlowContext) {
                            console.log("[meta-whatsapp-webhook] 🚫 cancellationBlocked + hasFlowContext → re-invocando process-chat-flow com forceCancellationExit");
                            
                            try {
                              const flowResponse = await fetch(
                                `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-chat-flow`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                                  },
                                  body: JSON.stringify({
                                    conversationId: conversation.id,
                                    customerMessage: messageContent,
                                    forceCancellationExit: true,
                                    intentData: { ai_exit_intent: 'cancelamento' },
                                  }),
                                }
                              );
                              
                              if (flowResponse.ok) {
                                const flowData = await flowResponse.json();
                                console.log("[meta-whatsapp-webhook] ✅ process-chat-flow re-invoked (forceCancellationExit):", JSON.stringify({
                                  transfer: flowData.transfer,
                                  hasResponse: !!flowData.response,
                                  departmentId: flowData.departmentId,
                                }));
                                
                                const flowMessageRaw = flowData.response || flowData.message;
                                const flowMessage = flowMessageRaw
                                  ? flowMessageRaw + formatOptionsAsText(flowData.options)
                                  : null;
                                if (flowMessage) {
                                  await supabase.functions.invoke("send-meta-whatsapp", {
                                    body: {
                                      instance_id: instance.id,
                                      phone_number: fromNumber,
                                      message: flowMessage,
                                      conversation_id: conversation.id,
                                      skip_db_save: false,
                                      is_bot_message: true,
                                      metadata: (flowData as any).flowName ? { flow_id: (flowData as any).flowId, flow_name: (flowData as any).flowName } : undefined,
                                    },
                                  });
                                  console.log("[meta-whatsapp-webhook] ✅ Flow next-node message sent (cancellation exit)");
                                }
                                
                                const transferDept = flowData.departmentId || flowData.department;
                                if ((flowData.transfer === true || flowData.action === 'transfer') && transferDept) {
                                  await supabase
                                    .from('conversations')
                                    .update({
                                      ai_mode: 'waiting_human',
                                      department: transferDept,
                                      assigned_to: null,
                                    })
                                    .eq('id', conversation.id);
                                  console.log("[meta-whatsapp-webhook] 🔄 Transfer applied from flow (cancellation exit) → dept:", transferDept);
                                }
                                
                                continue;
                              } else {
                                console.error("[meta-whatsapp-webhook] ❌ process-chat-flow re-invoke failed (cancellation):", await flowResponse.text());
                                
                                // RETRY: Segunda tentativa
                                console.log("[meta-whatsapp-webhook] 🔄 Retrying process-chat-flow (cancellation, attempt 2)...");
                                try {
                                  const retryResponse = await fetch(
                                    `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-chat-flow`,
                                    {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                                      },
                                      body: JSON.stringify({
                                        conversationId: conversation.id,
                                        customerMessage: messageContent,
                                        forceCancellationExit: true,
                                        intentData: { ai_exit_intent: 'cancelamento' },
                                      }),
                                    }
                                  );
                                  if (retryResponse.ok) {
                                    const retryData = await retryResponse.json();
                                    console.log("[meta-whatsapp-webhook] ✅ Cancellation retry succeeded:", JSON.stringify({ transfer: retryData.transfer, hasResponse: !!retryData.response }));
                                    const retryMessageRaw = retryData.response || retryData.message;
                                    const retryMessage = retryMessageRaw
                                      ? retryMessageRaw + formatOptionsAsText(retryData.options)
                                      : null;
                                    if (retryMessage) {
                                      await supabase.functions.invoke("send-meta-whatsapp", {
                                        body: {
                                          instance_id: instance.id,
                                          phone_number: fromNumber,
                                          message: retryMessage,
                                          conversation_id: conversation.id,
                                          skip_db_save: false,
                                          is_bot_message: true,
                                          metadata: retryData.flowName ? { flow_id: retryData.flowId, flow_name: retryData.flowName } : undefined,
                                        },
                                      });
                                    }
                                    const retryDept = retryData.departmentId || retryData.department;
                                    if ((retryData.transfer === true || retryData.action === 'transfer') && retryDept) {
                                      await supabase.from('conversations').update({ ai_mode: 'waiting_human', department: retryDept, assigned_to: null }).eq('id', conversation.id);
                                    }
                                    continue;
                                  } else {
                                    console.error("[meta-whatsapp-webhook] ❌ Cancellation retry also failed:", await retryResponse.text());
                                  }
                                } catch (retryErr) {
                                  console.error("[meta-whatsapp-webhook] ❌ Cancellation retry exception:", retryErr);
                                }
                              }
                            } catch (flowErr) {
                              console.error("[meta-whatsapp-webhook] ❌ Error re-invoking process-chat-flow (cancellation):", flowErr);
                            }
                            
                            // Se hasFlowContext=true e ambas tentativas falharam, manter no fluxo
                            if (autopilotData?.hasFlowContext) {
                              console.log("[meta-whatsapp-webhook] ⚠️ cancellationBlocked + hasFlowContext=true mas flow re-invoke falhou 2x. Mantendo no fluxo sem handoff hardcoded.");
                              continue;
                            }
                          }
                          
                          // Fallback: sem flow context → handoff genérico
                          console.log("[meta-whatsapp-webhook] 🚫 cancellationBlocked=true + hasFlowContext=false → enviando handoff msg (fallback)");
                          
                          const cancelHandoffMsg = autopilotData.response || 'Entendi sua solicitação de cancelamento. Vou te encaminhar para o setor responsável.';
                          
                          try {
                            const metaToken = instance.whatsapp_meta_token || Deno.env.get("WHATSAPP_META_TOKEN");
                            const phoneNumberId = instance.whatsapp_meta_phone_id || Deno.env.get("WHATSAPP_META_PHONE_NUMBER_ID");
                            
                            if (metaToken && phoneNumberId) {
                              await supabase.functions.invoke("send-meta-whatsapp", {
                                body: {
                                  instance_id: instance.id,
                                  phone_number: fromNumber,
                                  message: cancelHandoffMsg,
                                  conversation_id: conversation.id,
                                  skip_db_save: true,
                                },
                              });
                              console.log("[meta-whatsapp-webhook] ✅ Handoff message sent (cancellation block fallback)");
                              
                              await supabase.from("messages").insert({
                                conversation_id: conversation.id,
                                content: cancelHandoffMsg,
                                sender_type: "system",
                                message_type: "text",
                              });
                            }
                            
                            // Atualizar conversa para waiting_human
                            await supabase
                              .from('conversations')
                              .update({
                                ai_mode: 'waiting_human',
                                assigned_to: null,
                              })
                              .eq('id', conversation.id);
                            console.log("[meta-whatsapp-webhook] ✅ Conversa atualizada para waiting_human (cancellation fallback)");

                            // Completar flow state se existir
                            try {
                              await supabase
                                .from('chat_flow_states')
                                .update({ status: 'transferred', completed_at: new Date().toISOString() })
                                .eq('conversation_id', conversation.id)
                                .in('status', ['in_progress', 'active', 'waiting_input']);
                              console.log("[meta-whatsapp-webhook] ✅ Flow state marcado como transferred (cancellation fallback)");
                            } catch (flowStateErr) {
                              console.error("[meta-whatsapp-webhook] ⚠️ Erro atualizando flow state:", flowStateErr);
                            }
                          } catch (sendErr) {
                            console.error("[meta-whatsapp-webhook] ⚠️ Error sending cancellation handoff msg:", sendErr);
                          }
                          
                          continue;
                        }
                        
                         // 🆕 V13 BUG 20+21: Handoff IMEDIATO para transfer intent e anti-loop (sem re-invocar flow)
                         if ((autopilotData?.flowExit) && 
                             (autopilotData?.reason === 'customer_transfer_intent' || autopilotData?.reason === 'global_anti_loop_handoff') &&
                             !flowExitHandledByConversation.has(conversation.id)) {
                           flowExitHandledByConversation.add(conversation.id);
                           console.log("[meta-whatsapp-webhook] 🚀 V13: Handoff IMEDIATO (reason=" + autopilotData.reason + ") — pulando flow re-invocation");
                           
                           const DEPT_SUPORTE_IMMEDIATE = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
                           const immediateDept = autopilotData.flow_context?.department || (conversation as any).department || DEPT_SUPORTE_IMMEDIATE;
                           
                           await supabase.from('conversations').update({
                             ai_mode: 'waiting_human',
                             handoff_executed_at: new Date().toISOString(),
                             department: immediateDept,
                             assigned_to: null,
                           }).eq('id', conversation.id);
                           
                           // Dispatch job
                           try {
                             await supabase.functions.invoke('route-conversation', {
                               body: { conversation_id: conversation.id, department_id: immediateDept }
                             });
                             console.log("[meta-whatsapp-webhook] ✅ V13: route-conversation dispatched for immediate handoff");
                           } catch (routeErr) {
                             console.error("[meta-whatsapp-webhook] ❌ V13: route-conversation failed:", routeErr);
                           }
                           
                           continue;
                         }
                         
                         // 🆕 CONTRACT VIOLATION / FLOW EXIT: IA fabricou transferência ou pediu [[FLOW_EXIT]]
                         // Re-invocar process-chat-flow para avançar ao próximo nó do fluxo
                         if ((autopilotData?.flowExit || autopilotData?.contractViolation) && autopilotData?.hasFlowContext && !flowExitHandledByConversation.has(conversation.id)) {
                           flowExitHandledByConversation.add(conversation.id);
                           console.log("[meta-whatsapp-webhook] 🔄 flowExit/contractViolation → re-invocando process-chat-flow com forceAIExit", {
                             flowExit: autopilotData.flowExit,
                             contractViolation: autopilotData.contractViolation,
                             reason: autopilotData.reason,
                           });
                          
                          try {
                            const cvFlowResponse = await fetch(
                              `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-chat-flow`,
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                                },
                                body: JSON.stringify({
                                  conversationId: conversation.id,
                                  customerMessage: messageContent,
                                  forceAIExit: true,
                                  ...(autopilotData?.ai_exit_intent ? { intentData: { ai_exit_intent: autopilotData.ai_exit_intent } } : {}),
                                }),
                              }
                            );
                            
                            if (cvFlowResponse.ok) {
                              const cvFlowResult = await cvFlowResponse.json();
                              console.log("[meta-whatsapp-webhook] ✅ process-chat-flow re-invoked (flowExit/contractViolation):", JSON.stringify({
                                transfer: cvFlowResult.transfer,
                                hasResponse: !!cvFlowResult.response,
                                nodeType: cvFlowResult.nodeType,
                                departmentId: cvFlowResult.departmentId,
                              }));
                              
                              const cvFlowMessage = (cvFlowResult.response || cvFlowResult.message)
                                ? (cvFlowResult.response || cvFlowResult.message) + formatOptionsAsText(cvFlowResult.options)
                                : null;
                              
                              if (cvFlowMessage) {
                                await supabase.functions.invoke("send-meta-whatsapp", {
                                  body: {
                                    instance_id: instance.id,
                                    phone_number: fromNumber,
                                    message: cvFlowMessage,
                                    conversation_id: conversation.id,
                                    skip_db_save: false,
                                    is_bot_message: true,
                                  },
                                });
                                console.log("[meta-whatsapp-webhook] ✅ Flow next-node message sent (flowExit/contractViolation)");
                              }
                              
                              // Transfer handling — 🔧 BUG 2 FIX: Adicionar preferred transfer (paridade com CASO 2)
                              const DEPT_SUPORTE_FALLBACK_CV = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
                              const cvTransferDept = cvFlowResult.departmentId || cvFlowResult.department;
                              if (cvFlowResult.transfer === true || cvFlowResult.action === 'transfer') {
                                const cvDeptToUse = cvTransferDept || DEPT_SUPORTE_FALLBACK_CV;
                                const cvUpdateData: Record<string, unknown> = {
                                  ai_mode: 'waiting_human',
                                  handoff_executed_at: new Date().toISOString(),
                                  department: cvDeptToUse,
                                };
                                
                                const isConsultantTransferCV = cvFlowResult.transferType === 'consultant';
                                const isPreferredTransferCV = cvFlowResult.transferType === 'preferred';
                                
                                const { data: contactConsultantCV } = await supabase
                                  .from('contacts')
                                  .select('consultant_id, consultant_manually_removed, preferred_agent_id, preferred_department_id, organization_id')
                                  .eq('id', contact.id)
                                  .maybeSingle();

                                // 🔧 BUG 2 FIX: Preferred transfer chain (paridade com CASO 2)
                                if (isPreferredTransferCV && contactConsultantCV) {
                                  let resolvedCV = false;
                                  // 1. Atendente preferido
                                  if (contactConsultantCV.preferred_agent_id) {
                                    const { data: agentStatusCV } = await supabase
                                      .from('profiles')
                                      .select('id, availability_status')
                                      .eq('id', contactConsultantCV.preferred_agent_id)
                                      .maybeSingle();
                                    if (agentStatusCV) {
                                      cvUpdateData.assigned_to = agentStatusCV.id;
                                      cvUpdateData.ai_mode = 'copilot';
                                      console.log("[meta-whatsapp-webhook] 👤 Preferred (flowExit/CV): atendente preferido:", agentStatusCV.id);
                                      resolvedCV = true;
                                    }
                                  }
                                  // 2. Departamento preferido
                                  if (!resolvedCV && contactConsultantCV.preferred_department_id) {
                                    cvUpdateData.department = contactConsultantCV.preferred_department_id;
                                    console.log("[meta-whatsapp-webhook] 🏢 Preferred (flowExit/CV): dept preferido:", contactConsultantCV.preferred_department_id);
                                    resolvedCV = true;
                                  }
                                  // 3. Departamento padrão da organização
                                  if (!resolvedCV && contactConsultantCV.organization_id) {
                                    const { data: orgDataCV } = await supabase
                                      .from('organizations')
                                      .select('default_department_id')
                                      .eq('id', contactConsultantCV.organization_id)
                                      .maybeSingle();
                                    if (orgDataCV?.default_department_id) {
                                      cvUpdateData.department = orgDataCV.default_department_id;
                                      console.log("[meta-whatsapp-webhook] 🏢 Preferred (flowExit/CV): org default dept:", orgDataCV.default_department_id);
                                      resolvedCV = true;
                                    }
                                  }
                                  if (!resolvedCV) {
                                    console.log("[meta-whatsapp-webhook] 🔄 Preferred (flowExit/CV): usando fallback do nó:", cvUpdateData.department);
                                  }
                                }

                                // 🛡️ consultantId só quando transfer_type=consultant
                                let consultantIdCV: string | null = null;
                                if (isConsultantTransferCV) {
                                  consultantIdCV = (contactConsultantCV?.consultant_manually_removed)
                                    ? null
                                    : (contactConsultantCV?.consultant_id || null);
                                } else if (!isPreferredTransferCV) {
                                  // Nem consultant nem preferred: pool genérico
                                  consultantIdCV = null;
                                }
                                
                                if (consultantIdCV) {
                                  cvUpdateData.assigned_to = consultantIdCV;
                                  cvUpdateData.ai_mode = 'copilot';
                                  console.log("[meta-whatsapp-webhook] 👤 Consultor atribuído (flowExit/contractViolation):", consultantIdCV);
                                  await supabase.from('contacts').update({ consultant_id: consultantIdCV }).eq('id', contact.id);
                                }
                                
                                await supabase.from('conversations').update(cvUpdateData).eq('id', conversation.id);
                                console.log("[meta-whatsapp-webhook] ✅ Transfer (flowExit/contractViolation) → dept:", cvUpdateData.department, "type:", cvFlowResult.transferType);
                                
                                if (!consultantIdCV && !cvUpdateData.assigned_to) {
                                  try {
                                    await fetch(
                                      `${Deno.env.get("SUPABASE_URL")}/functions/v1/route-conversation`,
                                      {
                                        method: "POST",
                                        headers: {
                                          "Content-Type": "application/json",
                                          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                                        },
                                        body: JSON.stringify({ conversationId: conversation.id }),
                                      }
                                    );
                                  } catch (routeErr) {
                                    console.error("[meta-whatsapp-webhook] ⚠️ route-conversation exception (flowExit/contractViolation):", routeErr);
                                  }
                                }
                              }
                              
                              // 🔧 BUG 3 FIX: Se flowExit/CV retornou aiNodeActive, chamar IA com novo contexto
                              if (cvFlowResult.useAI && cvFlowResult.aiNodeActive && cvFlowResult.flow_context) {
                                console.log("[meta-whatsapp-webhook] 🔄 flowExit/CV → new AI node detected, calling autopilot");
                                try {
                                  await supabase.functions.invoke("ai-autopilot-chat", {
                                    body: {
                                      conversationId: conversation.id,
                                      customerMessage: messageContent,
                                      flow_context: cvFlowResult.flow_context,
                                    },
                                  });
                                } catch (aiErr) {
                                  console.error("[meta-whatsapp-webhook] ❌ AI call after flowExit/CV AI node failed:", aiErr);
                                }
                              }
                              
                              continue;
                            } else {
                              console.error("[meta-whatsapp-webhook] ❌ process-chat-flow re-invoke failed (flowExit/contractViolation):", await cvFlowResponse.text());
                            }
                          } catch (cvFlowErr) {
                            console.error("[meta-whatsapp-webhook] ❌ Error re-invoking process-chat-flow (flowExit/contractViolation):", cvFlowErr);
                          }
                          
                          // Fallback: manter no fluxo
                          console.log("[meta-whatsapp-webhook] ⚠️ flowExit/contractViolation mas re-invoke falhou. Mantendo no fluxo.");
                          continue;
                        }

                        // 🆕 INTENT EXIT: IA detectou [INTENT:X] e quer redirecionar para sub-flow
                        if (autopilotData?.intentExit && autopilotData?.intentType && autopilotData?.hasFlowContext && !flowExitHandledByConversation.has(conversation.id)) {
                          flowExitHandledByConversation.add(conversation.id);
                          console.log("[meta-whatsapp-webhook] 🎯 intentExit detectado → re-invocando process-chat-flow com intentData", {
                            intentType: autopilotData.intentType,
                          });
                          try {
                            const intentFlowResponse = await fetch(
                              `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-chat-flow`,
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                                body: JSON.stringify({
                                  conversationId: conversation.id,
                                  customerMessage: messageContent,
                                  forceAIExit: true,
                                  intentData: { ai_exit_intent: autopilotData.intentType },
                                }),
                              }
                            );
                            if (intentFlowResponse.ok) {
                              const intentResult = await intentFlowResponse.json();
                              console.log("[meta-whatsapp-webhook] ✅ Intent flow result:", JSON.stringify({ transfer: intentResult.transfer, hasResponse: !!intentResult.response, flowId: intentResult.flowId }));
                              const intentMsg = (intentResult.response || intentResult.message)
                                ? (intentResult.response || intentResult.message) + formatOptionsAsText(intentResult.options)
                                : null;
                              if (intentMsg) {
                                await supabase.functions.invoke("send-meta-whatsapp", {
                                  body: { instance_id: instance.id, phone_number: fromNumber, message: intentMsg, conversation_id: conversation.id, skip_db_save: false, is_bot_message: true },
                                });
                                console.log("[meta-whatsapp-webhook] ✅ Intent flow message sent");
                              }
                              if (intentResult.transfer) {
                                const intentDept = intentResult.departmentId || intentResult.department;
                                if (intentDept) {
                                  await supabase.from("conversations").update({ department: intentDept, ai_mode: "waiting_human", assigned_to: null }).eq("id", conversation.id);
                                  console.log("[meta-whatsapp-webhook] ✅ Intent transfer → dept:", intentDept);
                                }
                              }
                            }
                          } catch (intentErr) {
                            console.error("[meta-whatsapp-webhook] ❌ Intent flow error:", intentErr);
                          }
                          continue;
                        }

                        // 🆕 FLOW ADVANCE: IA quer sair do nó (strict RAG ou confidence handoff)
                        // Re-invocar process-chat-flow para avançar ao próximo nó do fluxo
                        if (autopilotData?.status === 'flow_advance_needed' && autopilotData?.hasFlowContext) {
                          console.log("[meta-whatsapp-webhook] 🔄 flow_advance_needed → re-invocando process-chat-flow com forceAIExit", {
                            reason: autopilotData.reason,
                            score: autopilotData.score
                          });
                          
                          try {
                            const flowResponse = await fetch(
                              `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-chat-flow`,
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                                },
                                body: JSON.stringify({
                                  conversationId: conversation.id,
                                  customerMessage: messageContent,
                                  forceAIExit: true,
                                }),
                              }
                            );
                            
                            if (flowResponse.ok) {
                              const flowResult = await flowResponse.json();
                              console.log("[meta-whatsapp-webhook] ✅ process-chat-flow re-invoked (forceAIExit):", JSON.stringify({
                                transfer: flowResult.transfer,
                                hasResponse: !!flowResult.response,
                                nodeType: flowResult.nodeType,
                                departmentId: flowResult.departmentId,
                              }));
                              
                              // ═══════════════════════════════════════════════════════════
                              // 🔧 FIX: Alinhar forceAIExit com CASO 2 (Bug 1+2+3)
                              // ═══════════════════════════════════════════════════════════
                              const rawFlowMessage = flowResult.response || flowResult.message;
                              const formattedFlowMessage = rawFlowMessage
                                ? rawFlowMessage + formatOptionsAsText(flowResult.options)
                                : null;
                              
                              if (formattedFlowMessage) {
                                // Bug 2 fix: usar skip_db_save: false + is_bot_message: true (como CASO 2)
                                const sendResp = await supabase.functions.invoke("send-meta-whatsapp", {
                                  body: {
                                    instance_id: instance.id,
                                    phone_number: fromNumber,
                                    message: formattedFlowMessage,
                                    conversation_id: conversation.id,
                                    skip_db_save: false,
                                    is_bot_message: true,
                                  },
                                });
                                if (sendResp.error) {
                                  console.error("[meta-whatsapp-webhook] ❌ Erro ao enviar msg forceAIExit:", sendResp.error);
                                } else {
                                  console.log("[meta-whatsapp-webhook] ✅ Flow next-node message sent (AI exit) with options");
                                }
                              }
                              
                              // 🔧 BUG 2+3 FIX: transfer com lógica completa (consultant + preferred) como CASO 2
                              const DEPT_SUPORTE_FALLBACK_AIX = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
                              const transferDept = flowResult.departmentId || flowResult.department;
                              if (flowResult.transfer === true || flowResult.action === 'transfer') {
                                const deptToUse = transferDept || DEPT_SUPORTE_FALLBACK_AIX;
                                const updateData: Record<string, unknown> = {
                                  ai_mode: 'waiting_human',
                                  handoff_executed_at: new Date().toISOString(),
                                  department: deptToUse,
                                };
                                
                                const isConsultantTransfer = flowResult.transferType === 'consultant';
                                const isPreferredTransfer = flowResult.transferType === 'preferred';
                                
                                const { data: contactConsultantData } = await supabase
                                  .from('contacts')
                                  .select('consultant_id, consultant_manually_removed, preferred_agent_id, preferred_department_id, organization_id')
                                  .eq('id', contact.id)
                                  .maybeSingle();

                                // 🔧 BUG 2 FIX: Preferred transfer chain (paridade com CASO 2)
                                if (isPreferredTransfer && contactConsultantData) {
                                  let resolvedPref = false;
                                  if (contactConsultantData.preferred_agent_id) {
                                    const { data: agentStatusPref } = await supabase
                                      .from('profiles')
                                      .select('id, availability_status')
                                      .eq('id', contactConsultantData.preferred_agent_id)
                                      .maybeSingle();
                                    if (agentStatusPref) {
                                      updateData.assigned_to = agentStatusPref.id;
                                      updateData.ai_mode = 'copilot';
                                      console.log("[meta-whatsapp-webhook] 👤 Preferred (forceAIExit): atendente preferido:", agentStatusPref.id);
                                      resolvedPref = true;
                                    }
                                  }
                                  if (!resolvedPref && contactConsultantData.preferred_department_id) {
                                    updateData.department = contactConsultantData.preferred_department_id;
                                    console.log("[meta-whatsapp-webhook] 🏢 Preferred (forceAIExit): dept preferido:", contactConsultantData.preferred_department_id);
                                    resolvedPref = true;
                                  }
                                  if (!resolvedPref && contactConsultantData.organization_id) {
                                    const { data: orgDataPref } = await supabase
                                      .from('organizations')
                                      .select('default_department_id')
                                      .eq('id', contactConsultantData.organization_id)
                                      .maybeSingle();
                                    if (orgDataPref?.default_department_id) {
                                      updateData.department = orgDataPref.default_department_id;
                                      console.log("[meta-whatsapp-webhook] 🏢 Preferred (forceAIExit): org default dept:", orgDataPref.default_department_id);
                                      resolvedPref = true;
                                    }
                                  }
                                  if (!resolvedPref) {
                                    console.log("[meta-whatsapp-webhook] 🔄 Preferred (forceAIExit): usando fallback do nó:", updateData.department);
                                  }
                                }
                                
                                // 🛡️ consultantId só quando transfer_type=consultant
                                let consultantId: string | null = null;
                                if (isConsultantTransfer) {
                                  if (contactConsultantData?.consultant_manually_removed) {
                                    console.log("[meta-whatsapp-webhook] 🚫 consultant_manually_removed=true (forceAIExit), pulando consultor");
                                  }
                                  consultantId = (contactConsultantData?.consultant_manually_removed)
                                    ? null
                                    : (contactConsultantData?.consultant_id || null);
                                }
                                
                                if (consultantId) {
                                  updateData.assigned_to = consultantId;
                                  updateData.ai_mode = 'copilot';
                                  console.log("[meta-whatsapp-webhook] 👤 Consultor atribuído (forceAIExit):", consultantId);
                                  
                                  await supabase
                                    .from('contacts')
                                    .update({ consultant_id: consultantId })
                                    .eq('id', contact.id);
                                }
                                
                                const { error: updateError } = await supabase
                                  .from('conversations')
                                  .update(updateData)
                                  .eq('id', conversation.id);
                                
                                if (updateError) {
                                  console.error("[meta-whatsapp-webhook] ❌ Transfer error (forceAIExit):", updateError);
                                } else {
                                  console.log("[meta-whatsapp-webhook] ✅ Transfer (forceAIExit) → dept:", updateData.department, "type:", flowResult.transferType, "assigned:", updateData.assigned_to || 'pool');
                                  
                                  if (!consultantId && !updateData.assigned_to) {
                                    try {
                                      const routeResp = await fetch(
                                        `${Deno.env.get("SUPABASE_URL")}/functions/v1/route-conversation`,
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                                          },
                                          body: JSON.stringify({ conversationId: conversation.id }),
                                        }
                                      );
                                      if (!routeResp.ok) {
                                        console.error("[meta-whatsapp-webhook] ❌ route-conversation error (forceAIExit):", await routeResp.text());
                                      } else {
                                        console.log("[meta-whatsapp-webhook] ✅ route-conversation (forceAIExit):", JSON.stringify(await routeResp.json()));
                                      }
                                    } catch (routeErr) {
                                      console.error("[meta-whatsapp-webhook] ⚠️ route-conversation exception (forceAIExit):", routeErr);
                                    }
                                  }
                                }
                              }
                              
                              // 🔧 BUG 3 FIX: Se forceAIExit retornou aiNodeActive, chamar IA com novo contexto
                              if (flowResult.useAI && flowResult.aiNodeActive && flowResult.flow_context) {
                                console.log("[meta-whatsapp-webhook] 🔄 forceAIExit → new AI node detected, calling autopilot");
                                try {
                                  await supabase.functions.invoke("ai-autopilot-chat", {
                                    body: {
                                      conversationId: conversation.id,
                                      customerMessage: messageContent,
                                      flow_context: flowResult.flow_context,
                                    },
                                  });
                                } catch (aiErr) {
                                  console.error("[meta-whatsapp-webhook] ❌ AI call after forceAIExit AI node failed:", aiErr);
                                }
                              }
                              
                              continue;
                            } else {
                              console.error("[meta-whatsapp-webhook] ❌ process-chat-flow re-invoke failed (forceAIExit):", await flowResponse.text());
                              
                              // Retry
                              try {
                                const retryResponse = await fetch(
                                  `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-chat-flow`,
                                  {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                                    },
                                    body: JSON.stringify({
                                      conversationId: conversation.id,
                                      customerMessage: messageContent,
                                      forceAIExit: true,
                                    }),
                                  }
                                );
                                if (retryResponse.ok) {
                                  const retryData = await retryResponse.json();
                                  console.log("[meta-whatsapp-webhook] ✅ forceAIExit retry succeeded");
                                  // 🔧 BUG 1 FIX: Alinhar retry com primeira tentativa (skip_db_save: false, is_bot_message: true, formatOptionsAsText)
                                  const retryMessageRaw = retryData.response || retryData.message;
                                  const retryMessage = retryMessageRaw
                                    ? retryMessageRaw + formatOptionsAsText(retryData.options)
                                    : null;
                                  if (retryMessage) {
                                    await supabase.functions.invoke("send-meta-whatsapp", {
                                      body: { instance_id: instance.id, phone_number: fromNumber, message: retryMessage, conversation_id: conversation.id, skip_db_save: false, is_bot_message: true },
                                    });
                                  }
                                  // 🔧 BUG 3 FIX: Se retry retornou aiNodeActive, chamar IA com novo contexto
                                  if (retryData.useAI && retryData.aiNodeActive && retryData.flow_context) {
                                    console.log("[meta-whatsapp-webhook] 🔄 forceAIExit retry → new AI node detected, calling autopilot");
                                    try {
                                      await supabase.functions.invoke("ai-autopilot-chat", {
                                        body: {
                                          conversationId: conversation.id,
                                          customerMessage: messageContent,
                                          flow_context: retryData.flow_context,
                                        },
                                      });
                                    } catch (aiErr) {
                                      console.error("[meta-whatsapp-webhook] ❌ AI call after retry AI node failed:", aiErr);
                                    }
                                  }
                                  const retryDept = retryData.departmentId || retryData.department;
                                  if ((retryData.transfer === true || retryData.action === 'transfer') && retryDept) {
                                    await supabase.from('conversations').update({ ai_mode: 'waiting_human', department: retryDept, assigned_to: null }).eq('id', conversation.id);
                                  }
                                  continue;
                                } else {
                                  console.error("[meta-whatsapp-webhook] ❌ forceAIExit retry also failed");
                                }
                              } catch (retryErr) {
                                console.error("[meta-whatsapp-webhook] ❌ forceAIExit retry exception:", retryErr);
                              }
                            }
                          } catch (flowErr) {
                            console.error("[meta-whatsapp-webhook] ❌ Error re-invoking process-chat-flow (forceAIExit):", flowErr);
                          }
                          
                          // Se ambas tentativas falharam, manter no fluxo (não fazer handoff hardcoded)
                          console.log("[meta-whatsapp-webhook] ⚠️ flow_advance_needed mas re-invoke falhou 2x. Mantendo no fluxo.");
                          continue;
                        }
                      } catch {
                        // Se não conseguiu parsear JSON, segue normalmente
                      }
                      console.log("[meta-whatsapp-webhook] ✅ Autopilot triggered with flow_context");
                    }
                  } catch (err) {
                    console.error("[meta-whatsapp-webhook] ❌ Autopilot exception:", err);
                  }
                }
                continue;
              }

              // CASO 3.5: 🧪 TEST MODE - IA permitida sem fluxo ativo
              // Quando process-chat-flow retorna test_mode_ai_allowed, chamar ai-autopilot-chat
              // 🔧 FIX: Buscar flow_state ativo e montar flow_context para evitar fallback para persona global
              if (flowData.useAI && !flowData.aiNodeActive && flowData.reason === 'test_mode_ai_allowed') {
                // 🆕 Tentar buscar flow_state ativo para montar flow_context
                let testFlowContext: Record<string, unknown> | undefined = undefined;
                try {
                  const { data: activeFlowState } = await supabase
                    .from('chat_flow_states')
                    .select('id, flow_id, current_node_id, collected_data, chat_flows(name, flow_definition)')
                    .eq('conversation_id', conversation.id)
                    .in('status', ['active', 'waiting_input', 'in_progress'])
                    .order('started_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                  if (activeFlowState) {
                    const flowDef = (activeFlowState.chat_flows as any)?.flow_definition as any;
                    const currentNodeId = activeFlowState.current_node_id;
                    const nodes = flowDef?.nodes || [];
                    const currentNode = nodes.find((n: any) => n.id === currentNodeId);

                    if (currentNode?.type === 'ai_response') {
                      testFlowContext = {
                        flow_id: activeFlowState.flow_id,
                        node_id: currentNode.id,
                        node_type: 'ai_response',
                        allowed_sources: currentNode.data?.allowed_sources || ['kb'],
                        response_format: 'text_only',
                        personaId: currentNode.data?.persona_id || null,
                        kbCategories: currentNode.data?.kb_categories || null,
                        kbProductFilter: [], // Test mode - no product context available
                        contextPrompt: currentNode.data?.context_prompt || null,
                        fallbackMessage: currentNode.data?.fallback_message || null,
                        objective: currentNode.data?.objective || null,
                        maxSentences: currentNode.data?.max_sentences ?? 3,
                        forbidQuestions: currentNode.data?.forbid_questions ?? true,
                        forbidOptions: currentNode.data?.forbid_options ?? true,
                        forbidFinancial: currentNode.data?.forbid_financial ?? false,
                        forbidCommercial: currentNode.data?.forbid_commercial ?? false,
                        forbidCancellation: currentNode.data?.forbid_cancellation ?? false,
                        forbidConsultant: currentNode.data?.forbid_consultant ?? false,
                        returnReasons: currentNode.data?.return_reasons || null,
                      };
                      console.log("[meta-whatsapp-webhook] 🧪 TEST MODE: flow_context reconstruído do nó ativo:", {
                        nodeId: currentNode.id,
                        personaId: testFlowContext.personaId,
                        kbCategories: testFlowContext.kbCategories,
                      });
                    } else {
                      console.log("[meta-whatsapp-webhook] 🧪 TEST MODE: nó ativo não é ai_response:", currentNode?.type);
                    }
                  } else {
                    console.log("[meta-whatsapp-webhook] 🧪 TEST MODE: Nenhum flow_state ativo encontrado");
                  }
                } catch (flowStateErr) {
                  console.error("[meta-whatsapp-webhook] ⚠️ TEST MODE: Erro ao buscar flow_state:", flowStateErr);
                }

                console.log("[meta-whatsapp-webhook] 🧪 TEST MODE: Chamando ai-autopilot-chat", testFlowContext ? "COM flow_context" : "sem flow_context");
                try {
                  const autopilotBody: Record<string, unknown> = {
                    conversationId: conversation.id,
                    customerMessage: messageContent,
                    contact_id: contact.id,
                    whatsapp_provider: "meta",
                    whatsapp_meta_instance_id: instance.id,
                  };
                  if (testFlowContext) {
                    autopilotBody.flow_context = testFlowContext;
                  }

                  const autopilotResp = await fetch(
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
                  if (!autopilotResp.ok) {
                    console.error("[meta-whatsapp-webhook] ❌ TEST MODE autopilot error:", await autopilotResp.text());
                  } else {
                    console.log("[meta-whatsapp-webhook] ✅ TEST MODE autopilot triggered successfully");
                  }
                } catch (aiErr) {
                  console.error("[meta-whatsapp-webhook] ❌ TEST MODE autopilot exception:", aiErr);
                }
                continue;
              }

              // CASO 4: Sem fluxo ativo e sem AIResponseNode → Fallback controlado
              // Se IA está ligada mas não há fluxo específico, mover para humano (safety first)
              if (conversation.assigned_to && (conversation.ai_mode === 'copilot' || conversation.ai_mode === 'disabled')) {
                console.log('[AUTO-DECISION] [WhatsApp Meta] No active flow, but human is assigned → no-op');
                continue;
              }

              console.log("[AUTO-DECISION] [WhatsApp Meta] No active flow → waiting_human (fallback)");
              await supabase
                .from("conversations")
                .update({ ai_mode: "waiting_human" })
                .eq("id", conversation.id);
            }
          }

          // ============================================
          // Process Status Updates
          // 🆕 ENTERPRISE V2: Buscar por provider_message_id + atualizar campo status
          // ============================================
          if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
              console.log("[meta-whatsapp-webhook] 📊 Status update:", status.id, "->", status.status);

              // 🆕 Tentar buscar por provider_message_id PRIMEIRO (enterprise v2)
              let existingMsg = null;
              
              // Busca por provider_message_id (v2)
              const { data: msgByProvider } = await supabase
                .from("messages")
                .select("id, metadata, status")
                .eq("provider_message_id", status.id)
                .maybeSingle();
              
              if (msgByProvider) {
                existingMsg = msgByProvider;
              } else {
                // Fallback: buscar por external_id (v1)
                const { data: msgByExternal } = await supabase
                  .from("messages")
                  .select("id, metadata, status")
                  .eq("external_id", status.id)
                  .maybeSingle();
                existingMsg = msgByExternal;
              }

              if (existingMsg) {
                // 🆕 Hierarquia de status — prevenir downgrade
                const STATUS_RANK: Record<string, number> = {
                  sending: 0, sent: 1, delivered: 2, read: 3,
                };
                const currentRank = STATUS_RANK[existingMsg.status as string] ?? -1;

                // Mapear status do Meta para nosso status
                const mappedStatus =
                  status.status === 'delivered' ? 'delivered' :
                  status.status === 'read' ? 'read' :
                  status.status === 'sent' ? 'sent' :
                  status.status === 'failed' ? 'failed' :
                  existingMsg.status;

                const incomingRank = STATUS_RANK[mappedStatus as string] ?? -1;

                // 🆕 Regra: failed só aplica se current <= sent (rank 1)
                if (mappedStatus === 'failed' && currentRank >= 2) {
                  console.log(`[meta-whatsapp-webhook] ⏭️ Ignoring failed downgrade for ${existingMsg.id} (current: ${existingMsg.status})`);
                } else if (mappedStatus !== 'failed' && incomingRank <= currentRank) {
                  console.log(`[meta-whatsapp-webhook] ⏭️ Ignoring status downgrade ${mappedStatus} for ${existingMsg.id} (current: ${existingMsg.status})`);
                } else {
                  // 🆕 Capturar detalhes do erro do Meta
                  const errorInfo: Record<string, unknown> = {};
                  if (mappedStatus === 'failed' && (status as any).errors?.length) {
                    const metaError = (status as any).errors[0];
                    errorInfo.error_code = metaError.code;
                    errorInfo.error_title = metaError.title;
                    errorInfo.error_message = metaError.message;
                  }

                  const updatedMetadata = {
                    ...((existingMsg.metadata as Record<string, unknown>) || {}),
                    delivery_status: status.status,
                    status_timestamp: status.timestamp,
                    ...errorInfo,
                  };

                  const { error: updateError } = await supabase
                    .from("messages")
                    .update({
                      metadata: updatedMetadata,
                      status: mappedStatus,
                    })
                    .eq("id", existingMsg.id);

                  if (updateError) {
                    console.error("[meta-whatsapp-webhook] ❌ Error updating status:", updateError);
                  } else {
                    console.log(`[meta-whatsapp-webhook] ✅ Status updated: ${existingMsg.id} -> ${mappedStatus}`);
                  }
                }
              } else {
                console.log("[meta-whatsapp-webhook] ⚠️ Message not found for status update:", status.id);
              }
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("[meta-whatsapp-webhook] ❌ Error:", error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
