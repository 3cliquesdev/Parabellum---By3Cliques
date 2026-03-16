import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Helper to get MIME type from media type
 */
function getMimeTypeFromMediaType(type: string, originalMimeType?: string): string {
  // If we have the original MIME type, use it
  if (originalMimeType) {
    return originalMimeType;
  }
  
  // Fallback mapping
  const mimeTypes: Record<string, string> = {
    image: 'image/jpeg',
    audio: 'audio/ogg',
    video: 'video/mp4',
    document: 'application/pdf',
    sticker: 'image/webp',
  };
  return mimeTypes[type] || 'application/octet-stream';
}

/**
 * Map unsupported MIME types to Meta-supported equivalents
 * Meta accepts: audio/aac, audio/mp4, audio/mpeg, audio/amr, audio/ogg, audio/opus
 */
function getMetaSupportedMimeType(originalMimeType: string): string {
  // audio/webm is NOT supported by Meta, convert to audio/ogg (opus)
  if (originalMimeType.startsWith('audio/webm')) {
    console.log("[send-meta-whatsapp] 🔄 Converting MIME type from", originalMimeType, "to audio/ogg");
    return 'audio/ogg';
  }
  
  // Handle codec suffixes (e.g., audio/ogg;codecs=opus → audio/ogg)
  if (originalMimeType.includes(';')) {
    const baseMime = originalMimeType.split(';')[0].trim();
    console.log("[send-meta-whatsapp] 🔄 Stripping codec suffix:", originalMimeType, "→", baseMime);
    return baseMime;
  }
  
  return originalMimeType;
}

/**
 * Upload media to Meta's servers and get media_id
 * This is necessary because Meta can't reliably access signed URLs from private storage
 * 
 * IMPORTANT: Handles audio/webm → audio/ogg conversion since Meta doesn't accept webm
 */
async function uploadMediaToMeta(
  phoneNumberId: string,
  accessToken: string,
  mediaUrl: string,
  mimeType: string
): Promise<string> {
  const apiVersion = "v18.0";
  
  console.log("[send-meta-whatsapp] 📥 Downloading media from:", mediaUrl.substring(0, 100) + "...");
  console.log("[send-meta-whatsapp] 📋 Original MIME type:", mimeType);
  
  // 1. Download the file from Supabase signed URL
  const mediaResponse = await fetch(mediaUrl);
  if (!mediaResponse.ok) {
    const errorText = await mediaResponse.text();
    console.error("[send-meta-whatsapp] ❌ Failed to download media:", mediaResponse.status, errorText);
    throw new Error(`Failed to download media: ${mediaResponse.status}`);
  }
  
  let mediaBlob = await mediaResponse.blob();
  let finalMimeType = getMetaSupportedMimeType(mimeType);
  
  // 2. If original was webm, we need to create a new blob with the correct MIME type
  // The actual audio data in webm with opus codec is compatible with ogg container
  // Meta will accept the data if we declare it as audio/ogg
  if (mimeType.startsWith('audio/webm')) {
    console.log("[send-meta-whatsapp] 🔄 Re-wrapping webm audio as ogg for Meta compatibility");
    // Create new blob with audio/ogg MIME type
    // Note: The opus codec data inside webm is the same as in ogg container
    const arrayBuffer = await mediaBlob.arrayBuffer();
    mediaBlob = new Blob([arrayBuffer], { type: 'audio/ogg' });
    finalMimeType = 'audio/ogg';
    console.log("[send-meta-whatsapp] ✅ Blob re-wrapped as audio/ogg, size:", mediaBlob.size);
  }
  
  console.log("[send-meta-whatsapp] ✅ Media ready, size:", mediaBlob.size, "bytes, final type:", finalMimeType);
  
  // 3. Upload to Meta's Media API
  const formData = new FormData();
  formData.append('file', mediaBlob, 'media');
  formData.append('messaging_product', 'whatsapp');
  formData.append('type', finalMimeType);
  
  const uploadUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/media`;
  console.log("[send-meta-whatsapp] 📤 Uploading to Meta:", uploadUrl, "as", finalMimeType);
  
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${accessToken}` 
    },
    body: formData,
  });
  
  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error("[send-meta-whatsapp] ❌ Meta media upload failed:", uploadResponse.status, errorText);
    throw new Error(`Meta media upload failed: ${uploadResponse.status} - ${errorText}`);
  }
  
  const uploadResult = await uploadResponse.json();
  const mediaId = uploadResult.id;
  
  console.log("[send-meta-whatsapp] ✅ Media uploaded to Meta, media_id:", mediaId);
  return mediaId;
}

/**
 * Send WhatsApp Message via Meta Cloud API
 * 
 * Supports:
 * - Text messages
 * - Template messages (for out-of-24h-window)
 * - Image, audio, video, document
 * - Interactive buttons and lists
 */

interface SendMetaWhatsAppRequest {
  instance_id: string;           // UUID da whatsapp_meta_instances
  phone_number: string;          // Número de destino (formato: 5511999999999)
  message?: string;              // Texto da mensagem
  template?: {                   // Template aprovado pelo Meta
    name: string;
    language_code: string;
    components?: Array<{
      type: "header" | "body" | "button";
      parameters: Array<{ type: string; text?: string; image?: { link: string } }>;
    }>;
  };
  media?: {                      // Mídia a enviar
    type: "image" | "audio" | "video" | "document" | "sticker";
    url?: string;                // URL pública da mídia
    media_id?: string;           // ID da mídia já upada no Meta
    mime_type?: string;          // MIME type real do arquivo (ex: image/png)
    caption?: string;
    filename?: string;
  };
  interactive?: {                // Mensagem interativa (botões/lista)
    type: "button" | "list";
    header?: { type: "text"; text: string };
    body: { text: string };
    footer?: { text: string };
    action: {
      buttons?: Array<{ type: "reply"; reply: { id: string; title: string } }>;
      button?: string;
      sections?: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>;
    };
  };
  conversation_id?: string;      // Para logs e tracking
  skip_db_save?: boolean;        // 🆕 Se true, não salva no banco (frontend faz insert otimista)
  sender_name?: string;          // 🆕 Nome do remetente para prefixar mensagem (ex: "Miguel Fedes")
  client_message_id?: string;    // 🆕 ENTERPRISE V2: UUID para reconciliação de status
  metadata?: Record<string, any>; // Metadados adicionais para tracking
}

interface MetaApiResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

async function sendToMetaApi(
  phoneNumberId: string,
  accessToken: string,
  payload: object
): Promise<MetaApiResponse> {
  const apiVersion = "v18.0";
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  console.log("[send-meta-whatsapp] 📤 Sending to Meta API:", url);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      ...payload,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[send-meta-whatsapp] ❌ Meta API error:", response.status, errorBody);
    throw new Error(`Meta API error: ${response.status} - ${errorBody}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Handler de warmup rápido (sem processamento)
    const bodyText = await req.text();
    const body: SendMetaWhatsAppRequest & { warmup?: boolean } = bodyText ? JSON.parse(bodyText) : {};
    
    if (body.warmup) {
      console.log('[send-meta-whatsapp] 🔥 Warmup ping received');
      return new Response(
        JSON.stringify({ status: 'warm', timestamp: new Date().toISOString() }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role key to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[send-meta-whatsapp] ❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log("[send-meta-whatsapp] 📥 Request:", {
      instance_id: body.instance_id,
      phone: body.phone_number,
      has_message: !!body.message,
      has_template: !!body.template,
      has_media: !!body.media,
      has_interactive: !!body.interactive,
      sender_name: body.sender_name || '(não fornecido)', // 🆕 Log do nome
    });

    // Validação
    if (!body.instance_id || !body.phone_number) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: instance_id, phone_number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.message && !body.template && !body.media && !body.interactive) {
      return new Response(
        JSON.stringify({ error: "Must provide message, template, media, or interactive" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 🛡️ EMPTY MESSAGE GUARD: Bloquear mensagens de texto vazias
    if (body.message && !body.template && !body.media && !body.interactive && body.message.trim().length === 0) {
      console.error("[send-meta-whatsapp] ⚠️ EMPTY MESSAGE BLOCKED: Tentativa de enviar mensagem vazia", {
        conversation_id: body.conversation_id,
        instance_id: body.instance_id
      });
      return new Response(
        JSON.stringify({ error: "Empty message content is not allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar instância Meta
    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_meta_instances")
      .select("*")
      .eq("id", body.instance_id)
      .eq("status", "active")
      .single();

    if (instanceError || !instance) {
      console.error("[send-meta-whatsapp] ❌ Instance not found:", body.instance_id);
      return new Response(
        JSON.stringify({ error: "Meta WhatsApp instance not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalizar número
    let toNumber = body.phone_number.replace(/\D/g, "");
    if (!toNumber.startsWith("55") && (toNumber.length === 10 || toNumber.length === 11)) {
      toNumber = `55${toNumber}`;
    }

    console.log("[send-meta-whatsapp] 📱 Sending to:", toNumber);

    // 🆕 Formatar mensagem com nome do remetente em negrito (se fornecido)
    const formatMessageWithSender = (text: string, senderName?: string): string => {
      if (!senderName || !text) return text;
      return `*${senderName}*\n${text}`;
    };

    let result: MetaApiResponse;

    // ============================================
    // Text Message
    // ============================================
    if (body.message && !body.template && !body.media && !body.interactive) {
      const formattedMessage = formatMessageWithSender(body.message, body.sender_name);
      result = await sendToMetaApi(instance.phone_number_id, instance.access_token, {
        recipient_type: "individual",
        to: toNumber,
        type: "text",
        text: { body: formattedMessage },
      });
    }

    // ============================================
    // Template Message
    // ============================================
    else if (body.template) {
      result = await sendToMetaApi(instance.phone_number_id, instance.access_token, {
        recipient_type: "individual",
        to: toNumber,
        type: "template",
        template: {
          name: body.template.name,
          language: { code: body.template.language_code },
          components: body.template.components,
        },
      });
    }

    // ============================================
    // Media Message
    // ============================================
    else if (body.media) {
      const mediaPayload: Record<string, unknown> = {};

      // If we have a URL, upload to Meta first to get media_id
      // This is required because Meta can't access private signed URLs reliably
      if (body.media.url) {
        console.log("[send-meta-whatsapp] 📤 Uploading media to Meta first...");
        
        const mimeType = getMimeTypeFromMediaType(body.media.type, body.media.mime_type);
        
        const mediaId = await uploadMediaToMeta(
          instance.phone_number_id,
          instance.access_token,
          body.media.url,
          mimeType
        );
        
        console.log("[send-meta-whatsapp] ✅ Media uploaded, sending message with media_id:", mediaId);
        mediaPayload.id = mediaId;
        
      } else if (body.media.media_id) {
        // If media_id is already provided, use it directly
        mediaPayload.id = body.media.media_id;
      } else {
        return new Response(
          JSON.stringify({ error: "Media requires url or media_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Add caption for supported media types (com nome do remetente)
      if (body.media.caption && ["image", "video", "document"].includes(body.media.type)) {
        mediaPayload.caption = formatMessageWithSender(body.media.caption, body.sender_name);
      } else if (body.sender_name && ["image", "video", "document"].includes(body.media.type)) {
        // Se não tem caption mas tem sender_name, adicionar apenas o nome
        mediaPayload.caption = `*${body.sender_name}*`;
      }

      // Add filename for documents
      if (body.media.filename && body.media.type === "document") {
        mediaPayload.filename = body.media.filename;
      }

      result = await sendToMetaApi(instance.phone_number_id, instance.access_token, {
        recipient_type: "individual",
        to: toNumber,
        type: body.media.type,
        [body.media.type]: mediaPayload,
      });
    }

    // ============================================
    // Interactive Message
    // ============================================
    else if (body.interactive) {
      result = await sendToMetaApi(instance.phone_number_id, instance.access_token, {
        recipient_type: "individual",
        to: toNumber,
        type: "interactive",
        interactive: body.interactive,
      });
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messageId = result.messages?.[0]?.id;
    console.log("[send-meta-whatsapp] ✅ Message sent:", messageId);

    // ============================================
    // 🆕 ENTERPRISE V2: SEMPRE atualizar provider_message_id via client_message_id
    // Isso funciona mesmo com skip_db_save=true
    // ============================================
    if (body.client_message_id && messageId) {
      console.log(`[send-meta-whatsapp] 📝 Updating message ${body.client_message_id} with provider_message_id: ${messageId}`);
      
      const { error: updateError } = await supabase
        .from("messages")
        .update({ 
          provider_message_id: messageId,
          status: 'sent', // Status válido do enum message_status
          external_id: messageId, // Manter compatibilidade com legacy
        })
        .eq("client_message_id", body.client_message_id);
      
      if (updateError) {
        console.error("[send-meta-whatsapp] ⚠️ Failed to update provider_message_id:", updateError);
      } else {
        console.log("[send-meta-whatsapp] ✅ provider_message_id saved");
      }
    }

    // Salvar mensagem no banco (se conversation_id fornecido E skip_db_save não está setado)
    // 🆕 Se skip_db_save=true E tem client_message_id, o UPDATE acima já salvou o wamid
    // Só fazer INSERT para casos legacy (sem client_message_id)
    if (body.conversation_id && messageId && !body.skip_db_save && !body.client_message_id) {
      const messageContent = body.message || 
                             (body.template ? `[Template: ${body.template.name}]` : "") ||
                             (body.media ? `[${body.media.type}]` : "") ||
                             (body.interactive ? "[Interativo]" : "");

      await supabase.from("messages").insert({
        conversation_id: body.conversation_id,
        content: messageContent,
        sender_type: "user",
        external_id: messageId,
        provider_message_id: messageId, // 🆕 Também salvar no campo novo
        metadata: {
          whatsapp_provider: "meta",
          sent_via: "send-meta-whatsapp",
          phone_number_id: instance.phone_number_id,
          ...(body.metadata || {}),
        },
      });
      
      console.log("[send-meta-whatsapp] 💾 Mensagem salva no banco (legacy path)");
    } else if (body.skip_db_save) {
      console.log("[send-meta-whatsapp] ⏭️ skip_db_save=true - frontend fez insert" + (body.client_message_id ? " + UPDATE com wamid" : ""));
    }

    // ============================================
    // 🛡️ PROTEÇÃO CRÍTICA: Quando HUMANO envia mensagem, ai_mode → copilot
    // Isso impede que a IA interfira após o agente assumir
    // ============================================
    // ⛔⛔⛔ ATENÇÃO: NÃO MODIFICAR ESTA SEÇÃO ⛔⛔⛔
    // Esta lógica diferencia mensagens de HUMANO vs BOT/FLUXO
    // Remover "!body.is_bot_message" QUEBRA TODO O SISTEMA DE FLUXOS
    // Ver documentação: src/docs/SUPER_PROMPT_v2.3.md - Seção 15
    // ⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔
    if (body.conversation_id) {
      // Verificar se é mensagem de humano (não é IA/bot/fluxo)
      // Templates e mensagens interativas geralmente são do sistema
      // Mensagens de texto simples do frontend são de humanos
      // is_bot_message = true indica que é mensagem automática do fluxo (NÃO muda ai_mode)
      const isHumanMessage = body.message && !body.template && !body.interactive && !(body as { is_bot_message?: boolean }).is_bot_message;
      
      if (isHumanMessage) {
        // Verificar estado atual da conversa
        const { data: conversation } = await supabase
          .from("conversations")
          .select("ai_mode, assigned_to")
          .eq("id", body.conversation_id)
          .maybeSingle();
        
        // Se está em waiting_human e tem agente, ou qualquer modo que não seja copilot
        // Atualizar para copilot para proteger contra IA
        if (conversation && conversation.ai_mode !== 'copilot' && conversation.ai_mode !== 'disabled') {
          console.log(`[send-meta-whatsapp] 🛡️ Human sent message - updating ai_mode from '${conversation.ai_mode}' to 'copilot'`);
          
          await supabase
            .from("conversations")
            .update({ ai_mode: "copilot" })
            .eq("id", body.conversation_id);
          
          console.log("[send-meta-whatsapp] ✅ ai_mode updated to 'copilot' - AI will not interfere");
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        whatsapp_id: result.contacts?.[0]?.wa_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-meta-whatsapp] ❌ Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
