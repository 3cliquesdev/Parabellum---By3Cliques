import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getAIConfig } from "../_shared/ai-config-cache.ts";

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
                // ═══════════════════════════════════════════════════════════════
                // 🔒 TRAVA ROUTING-LOCK v1.0 — 2026-02-09
                // PROTEGIDO: Routing de cliente retornante com consultant_id.
                //   - Busca consultant_id no contato
                //   - Se existe → cria conversa em copilot com assigned_to = consultor
                //   - Se nao existe → cria em autopilot (fluxo normal)
                // ⚠️  NAO ALTERAR sem aprovacao explicita do responsavel.
                // Qualquer mudanca deve: (1) ser justificada, (2) testada, (3) versionada.
                // ═══════════════════════════════════════════════════════════════
                const { data: contactData } = await supabase
                  .from('contacts')
                  .select('consultant_id')
                  .eq('id', contact.id)
                  .maybeSingle();

                const hasConsultant = !!contactData?.consultant_id;

                // Criar nova conversa
                const { data: newConv } = await supabase
                  .from("conversations")
                  .insert({
                    contact_id: contact.id,
                    channel: "whatsapp",
                    status: "open",
                    ai_mode: hasConsultant ? "copilot" : "autopilot",
                    assigned_to: hasConsultant ? contactData.consultant_id : null,
                    whatsapp_provider: "meta",
                    whatsapp_meta_instance_id: instance.id,
                  })
                  .select("id, ai_mode, status, assigned_to, awaiting_rating, whatsapp_provider")
                  .single();

                conversation = newConv;

                if (hasConsultant) {
                  console.log("[meta-whatsapp-webhook] 👤 Cliente recorrente → direto para consultor:", contactData.consultant_id);
                }
                console.log("[meta-whatsapp-webhook] 💬 New conversation created:", conversation?.id);
              } else {
                // Migrar de Evolution para Meta se necessário
                if (conversation.whatsapp_provider !== "meta") {
                  console.log("[meta-whatsapp-webhook] 🔄 Migrando conversa de", conversation.whatsapp_provider, "para Meta");
                }
                await supabase
                  .from("conversations")
                  .update({ 
                    whatsapp_provider: "meta",
                    whatsapp_meta_instance_id: instance.id,
                    whatsapp_instance_id: null, // Limpar referência Evolution
                    last_message_at: new Date().toISOString(),
                    status: "open" // Reabrir se estava fechada
                  })
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
              // 🔄 FLOW SOBERANO - process-chat-flow PRIMEIRO
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
                      userMessage: messageContent,
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
                
                // 🧪 TEST MODE: Silêncio total — sem mensagem de aguarde, sem mudar ai_mode
                if (flowData.reason === 'test_mode_manual_only') {
                  console.log("[meta-whatsapp-webhook] 🧪 TEST MODE: Ignorando - apenas fluxos manuais");
                  continue;
                }
                
                // 🆕 MENSAGEM DE AGUARDE: Enviar confirmação ao cliente na fila
                // APENAS se reason indica que está esperando humano E NÃO TEM AGENTE ATRIBUÍDO
                // Se já tem agente atribuído, o atendente humano está responsável - não interferir
                const hasAssignedAgent = !!conversation.assigned_to;
                
                if (flowData.reason === 'ai_mode_waiting_human' && !hasAssignedAgent) {
                  console.log("[meta-whatsapp-webhook] 📨 Verificando rate limit para mensagem de aguarde...");
                  
                  // 🛡️ ANTI-SPAM: Verificar última mensagem do sistema (bot)
                  const { data: lastBotMsg } = await supabase
                    .from("messages")
                    .select("created_at, content")
                    .eq("conversation_id", conversation.id)
                    .eq("sender_type", "user") // "user" = bot/sistema no modelo atual
                    .eq("is_ai_generated", true)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  
                  // Só enviar se última mensagem do bot foi há mais de 2 minutos
                  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
                  const lastMsgDate = lastBotMsg?.created_at ? new Date(lastBotMsg.created_at) : null;
                  const shouldSendQueueMsg = !lastMsgDate || lastMsgDate < twoMinutesAgo;
                  
                  if (shouldSendQueueMsg) {
                    console.log("[meta-whatsapp-webhook] ✅ Rate limit OK, enviando mensagem de aguarde...");
                    
                    const queueMessage = "💬 Sua conversa já está na fila de atendimento.\n\nFique tranquilo, em breve um especialista irá te atender. 🙂";
                    
                    try {
                      await supabase.functions.invoke("send-meta-whatsapp", {
                        body: {
                          instance_id: instance.id,
                          phone_number: fromNumber,
                          message: queueMessage,
                          conversation_id: conversation.id,
                          skip_db_save: false,
                          is_bot_message: true, // 🆕 Mensagem automática - NÃO mudar ai_mode
                        },
                      });
                      console.log("[meta-whatsapp-webhook] ✅ Mensagem de aguarde enviada");
                    } catch (queueErr) {
                      console.error("[meta-whatsapp-webhook] ⚠️ Erro ao enviar mensagem de aguarde:", queueErr);
                    }
                  } else {
                    console.log("[meta-whatsapp-webhook] ⏱️ Rate limit ativo, última msg do bot:", lastMsgDate?.toISOString());
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
                      metadata: flowData.flowName ? { flow_id: flowData.flowId, flow_name: flowData.flowName } : undefined,
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
                  console.log("[meta-whatsapp-webhook] 🔄 Executing transfer to department:", flowData.departmentId);
                  
                  const updateData: Record<string, unknown> = {
                    ai_mode: 'waiting_human',
                    handoff_executed_at: new Date().toISOString(),
                  };
                  
                  // 🆕 Fallback: se flow não retornou departmentId, usar Suporte
                  const DEPT_SUPORTE_FALLBACK = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
                  updateData.department = flowData.departmentId || DEPT_SUPORTE_FALLBACK;

                  // ═══════════════════════════════════════════════════════════════
                  // 🔒 TRAVA TRANSFER-PERSIST-LOCK v1.0 — 2026-02-09
                  // PROTEGIDO: Busca de consultor (contato/email/regex) + persistencia.
                  //   - Busca consultor por contato, email coletado, ou regex nas msgs
                  //   - Atribui assigned_to e ai_mode = copilot
                  //   - Persiste consultant_id no contato para routing futuro
                  //   - Executa transferencia de departamento
                  // ⚠️  NAO ALTERAR sem aprovacao explicita do responsavel.
                  // Qualquer mudanca deve: (1) ser justificada, (2) testada, (3) versionada.
                  // ═══════════════════════════════════════════════════════════════
                  const { data: contactConsultantData } = await supabase
                    .from('contacts')
                    .select('consultant_id, consultant_manually_removed')
                    .eq('id', contact.id)
                    .maybeSingle();

                  // 🛡️ Se consultor foi removido manualmente, não re-atribuir
                  if (contactConsultantData?.consultant_manually_removed) {
                    console.log("[meta-whatsapp-webhook] 🚫 consultant_manually_removed=true, pulando TRANSFER-PERSIST-LOCK para contato:", contact.id);
                  }

                  let consultantId = contactConsultantData?.consultant_manually_removed
                    ? null
                    : (contactConsultantData?.consultant_id || null);

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
                if (conversation.ai_mode === "autopilot" && !conversation.awaiting_rating) {
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
                            allowed_sources: (flowData as any).allowedSources || ['kb'],
                            response_format: 'text_only',
                            personaId: (flowData as any).personaId || null,
                            kbCategories: (flowData as any).kbCategories || null,
                            contextPrompt: (flowData as any).contextPrompt || null,
                            fallbackMessage: (flowData as any).fallbackMessage || null,
                            objective: (flowData as any).objective || null,
                            maxSentences: (flowData as any).maxSentences ?? 3,
                            forbidQuestions: (flowData as any).forbidQuestions ?? true,
                            forbidOptions: (flowData as any).forbidOptions ?? true,
                          forbidFinancial: (flowData as any).forbidFinancial ?? false,
                          forbidCommercial: (flowData as any).forbidCommercial ?? false,
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
                                `${supabaseUrl}/functions/v1/process-chat-flow`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${supabaseServiceKey}`,
                                  },
                                  body: JSON.stringify({
                                    conversationId: conversation.id,
                                    userMessage: messageContent,
                                    forceFinancialExit: true,
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
                                const flowMessage = flowData.response || flowData.message;
                                if (flowMessage) {
                                  const metaToken = instance.whatsapp_meta_token || Deno.env.get("WHATSAPP_META_TOKEN");
                                  const phoneNumberId = instance.whatsapp_meta_phone_id || Deno.env.get("WHATSAPP_META_PHONE_NUMBER_ID");
                                  
                                  if (metaToken && phoneNumberId) {
                                    await fetch(
                                      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
                                      {
                                        method: "POST",
                                        headers: {
                                          "Content-Type": "application/json",
                                          Authorization: `Bearer ${metaToken}`,
                                        },
                                        body: JSON.stringify({
                                          messaging_product: "whatsapp",
                                          to: senderPhone,
                                          type: "text",
                                          text: { body: flowMessage },
                                        }),
                                      }
                                    );
                                    
                                    await supabase.from("messages").insert({
                                      conversation_id: conversation.id,
                                      content: flowMessage,
                                      sender_type: "system",
                                      message_type: "text",
                                    });
                                    console.log("[meta-whatsapp-webhook] ✅ Flow next-node message sent (financial exit)");
                                  }
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
                                    `${supabaseUrl}/functions/v1/process-chat-flow`,
                                    {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                        Authorization: `Bearer ${supabaseServiceKey}`,
                                      },
                                      body: JSON.stringify({
                                        conversationId: conversation.id,
                                        userMessage: messageContent,
                                        forceFinancialExit: true,
                                      }),
                                    }
                                  );
                                  if (retryResponse.ok) {
                                    const retryData = await retryResponse.json();
                                    console.log("[meta-whatsapp-webhook] ✅ Retry succeeded:", JSON.stringify({ transfer: retryData.transfer, hasResponse: !!retryData.response, nodeType: retryData.nodeType }));
                                    const retryMessage = retryData.response || retryData.message;
                                    if (retryMessage) {
                                      const metaToken2 = instance.whatsapp_meta_token || Deno.env.get("WHATSAPP_META_TOKEN");
                                      const phoneNumberId2 = instance.whatsapp_meta_phone_id || Deno.env.get("WHATSAPP_META_PHONE_NUMBER_ID");
                                      if (metaToken2 && phoneNumberId2) {
                                        await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId2}/messages`, {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${metaToken2}` },
                                          body: JSON.stringify({ messaging_product: "whatsapp", to: senderPhone, type: "text", text: { body: retryMessage } }),
                                        });
                                        await supabase.from("messages").insert({ conversation_id: conversation.id, content: retryMessage, sender_type: "system", message_type: "text" });
                                      }
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
                              await fetch(
                                `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${metaToken}`,
                                  },
                                  body: JSON.stringify({
                                    messaging_product: "whatsapp",
                                    to: senderPhone,
                                    type: "text",
                                    text: { body: handoffMsg },
                                  }),
                                }
                              );
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
                          const DEPT_COMERCIAL_ID = 'f446e202-bdc3-4bb3-aeda-8c0aa04ee53c';
                          
                          if (autopilotData?.hasFlowContext) {
                            console.log("[meta-whatsapp-webhook] 🛒 commercialBlocked + hasFlowContext → re-invocando process-chat-flow com forceCommercialExit");
                            
                            try {
                              const flowResponse = await fetch(
                                `${supabaseUrl}/functions/v1/process-chat-flow`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${supabaseServiceKey}`,
                                  },
                                  body: JSON.stringify({
                                    conversationId: conversation.id,
                                    userMessage: messageContent,
                                    forceCommercialExit: true,
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
                                
                                const flowMessage = flowData.response || flowData.message;
                                if (flowMessage) {
                                  const metaToken = instance.whatsapp_meta_token || Deno.env.get("WHATSAPP_META_TOKEN");
                                  const phoneNumberId = instance.whatsapp_meta_phone_id || Deno.env.get("WHATSAPP_META_PHONE_NUMBER_ID");
                                  
                                  if (metaToken && phoneNumberId) {
                                    await fetch(
                                      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
                                      {
                                        method: "POST",
                                        headers: {
                                          "Content-Type": "application/json",
                                          Authorization: `Bearer ${metaToken}`,
                                        },
                                        body: JSON.stringify({
                                          messaging_product: "whatsapp",
                                          to: senderPhone,
                                          type: "text",
                                          text: { body: flowMessage },
                                        }),
                                      }
                                    );
                                    
                                    await supabase.from("messages").insert({
                                      conversation_id: conversation.id,
                                      content: flowMessage,
                                      sender_type: "system",
                                      message_type: "text",
                                    });
                                    console.log("[meta-whatsapp-webhook] ✅ Flow next-node message sent (commercial exit)");
                                  }
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
                                console.error("[meta-whatsapp-webhook] ❌ process-chat-flow re-invoke failed (commercial):", await flowResponse.text());
                              }
                            } catch (flowErr) {
                              console.error("[meta-whatsapp-webhook] ❌ Error re-invoking process-chat-flow (commercial):", flowErr);
                            }
                          }
                          
                          // Fallback: sem flow context OU re-invoke falhou → handoff direto para Comercial
                          console.log("[meta-whatsapp-webhook] 🛒 commercialBlocked=true → enviando handoff msg para Comercial");
                          
                          const commercialHandoffMsg = autopilotData.response || 'Ótimo! Vou te conectar com nosso time comercial para te ajudar com isso.';
                          
                          try {
                            const metaToken = instance.whatsapp_meta_token || Deno.env.get("WHATSAPP_META_TOKEN");
                            const phoneNumberId = instance.whatsapp_meta_phone_id || Deno.env.get("WHATSAPP_META_PHONE_NUMBER_ID");
                            
                            if (metaToken && phoneNumberId) {
                              await fetch(
                                `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${metaToken}`,
                                  },
                                  body: JSON.stringify({
                                    messaging_product: "whatsapp",
                                    to: senderPhone,
                                    type: "text",
                                    text: { body: commercialHandoffMsg },
                                  }),
                                }
                              );
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
