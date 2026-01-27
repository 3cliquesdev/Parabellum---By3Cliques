import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("[send-meta-whatsapp] 📥 Request:", {
      instance_id: body.instance_id,
      phone: body.phone_number,
      has_message: !!body.message,
      has_template: !!body.template,
      has_media: !!body.media,
      has_interactive: !!body.interactive,
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

    let result: MetaApiResponse;

    // ============================================
    // Text Message
    // ============================================
    if (body.message && !body.template && !body.media && !body.interactive) {
      result = await sendToMetaApi(instance.phone_number_id, instance.access_token, {
        recipient_type: "individual",
        to: toNumber,
        type: "text",
        text: { body: body.message },
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

      if (body.media.url) {
        mediaPayload.link = body.media.url;
      } else if (body.media.media_id) {
        mediaPayload.id = body.media.media_id;
      } else {
        return new Response(
          JSON.stringify({ error: "Media requires url or media_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (body.media.caption && ["image", "video", "document"].includes(body.media.type)) {
        mediaPayload.caption = body.media.caption;
      }

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

    // Salvar mensagem no banco (se conversation_id fornecido)
    if (body.conversation_id && messageId) {
      const messageContent = body.message || 
                             (body.template ? `[Template: ${body.template.name}]` : "") ||
                             (body.media ? `[${body.media.type}]` : "") ||
                             (body.interactive ? "[Interativo]" : "");

      await supabase.from("messages").insert({
        conversation_id: body.conversation_id,
        content: messageContent,
        sender_type: "user",
        external_id: messageId,
        metadata: {
          whatsapp_provider: "meta",
          sent_via: "send-meta-whatsapp",
          phone_number_id: instance.phone_number_id,
        },
      });
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
