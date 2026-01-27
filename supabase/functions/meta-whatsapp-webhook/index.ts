import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
  // ⚠️ HMAC validation temporarily disabled for debugging
  // TODO: Re-enable once correct App Secret is configured
  console.log("[meta-whatsapp-webhook] ⚠️ HMAC validation DISABLED (temporary)");
  console.log("[meta-whatsapp-webhook] Signature present:", !!signature);
  console.log("[meta-whatsapp-webhook] App Secret present:", !!appSecret);
  return true;
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

              // Buscar ou criar contato
              let { data: contact } = await supabase
                .from("contacts")
                .select("id")
                .or(`phone.eq.${normalizedPhone},whatsapp_id.eq.${whatsappId}`)
                .single();

              if (!contact) {
                // Criar novo contato
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

              // Buscar conversa existente (QUALQUER provider) - priorizar aberta
              let { data: conversation } = await supabase
                .from("conversations")
                .select("id, ai_mode, status, assigned_to, awaiting_rating, whatsapp_provider")
                .eq("contact_id", contact.id)
                .neq("status", "closed")
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

              if (!conversation) {
                // Criar nova conversa
                const { data: newConv } = await supabase
                  .from("conversations")
                  .insert({
                    contact_id: contact.id,
                    channel: "whatsapp",
                    status: "open",
                    ai_mode: "autopilot",
                    whatsapp_provider: "meta",
                    whatsapp_meta_instance_id: instance.id,
                  })
                  .select("id, ai_mode, status, assigned_to, awaiting_rating, whatsapp_provider")
                  .single();

                conversation = newConv;
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

              // Trigger AI Autopilot se ativo
              if (conversation.ai_mode === "autopilot" && !conversation.awaiting_rating) {
                console.log("[meta-whatsapp-webhook] 🤖 Triggering AI Autopilot...");

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
                        conversationId: conversation.id,      // camelCase para ai-autopilot-chat
                        customerMessage: messageContent,       // nome correto do parâmetro
                        contact_id: contact.id,
                        whatsapp_provider: "meta",
                        whatsapp_meta_instance_id: instance.id,
                      }),
                    }
                  );

                  if (!autopilotResponse.ok) {
                    console.error("[meta-whatsapp-webhook] ❌ Autopilot error:", await autopilotResponse.text());
                  } else {
                    console.log("[meta-whatsapp-webhook] ✅ Autopilot triggered successfully");
                  }
                } catch (err) {
                  console.error("[meta-whatsapp-webhook] ❌ Autopilot exception:", err);
                }
              }
            }
          }

          // ============================================
          // Process Status Updates
          // ============================================
          if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
              console.log("[meta-whatsapp-webhook] 📊 Status update:", status.id, "->", status.status);

              // Buscar mensagem existente para atualizar metadata
              const { data: existingMsg } = await supabase
                .from("messages")
                .select("id, metadata")
                .eq("external_id", status.id)
                .single();

              if (existingMsg) {
                const updatedMetadata = {
                  ...((existingMsg.metadata as Record<string, unknown>) || {}),
                  delivery_status: status.status,
                  status_timestamp: status.timestamp,
                };

                const { error: updateError } = await supabase
                  .from("messages")
                  .update({ metadata: updatedMetadata })
                  .eq("external_id", status.id);

                if (updateError) {
                  console.error("[meta-whatsapp-webhook] ❌ Error updating status:", updateError);
                }
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
