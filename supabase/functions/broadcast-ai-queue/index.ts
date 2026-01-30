import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BroadcastRequest {
  message: string;
  dry_run?: boolean;
  limit?: number;
}

interface BroadcastResult {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  conversations: Array<{
    conversation_id: string;
    phone: string;
    status: "sent" | "failed" | "skipped";
    error?: string;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body: BroadcastRequest = await req.json();
    
    const { message, dry_run = false, limit = 500 } = body;

    if (!message || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[broadcast-ai-queue] 📢 Starting broadcast", {
      dry_run,
      limit,
      message_length: message.length,
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Buscar instância Meta ativa
    const { data: metaInstance, error: instanceError } = await supabase
      .from("whatsapp_meta_instances")
      .select("*")
      .eq("status", "active")
      .single();

    if (instanceError || !metaInstance) {
      console.error("[broadcast-ai-queue] ❌ No active Meta instance found");
      return new Response(
        JSON.stringify({ error: "No active WhatsApp Meta instance found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[broadcast-ai-queue] ✅ Meta instance found:", metaInstance.id);

    // 2. Buscar conversas elegíveis (fila da IA) - SOMENTE WHATSAPP
    const { data: conversations, error: convError } = await supabase
      .from("conversations")
      .select(`
        id,
        contact_id,
        channel,
        contacts!inner (
          id,
          phone,
          whatsapp_id,
          first_name,
          last_name
        )
      `)
      .eq("ai_mode", "autopilot")
      .eq("status", "open")
      .eq("channel", "whatsapp")
      .is("assigned_to", null)
      .not("contacts.phone", "is", null)
      .limit(limit);

    if (convError) {
      console.error("[broadcast-ai-queue] ❌ Error fetching conversations:", convError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch conversations" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eligibleConversations = conversations || [];
    console.log("[broadcast-ai-queue] 📊 Found", eligibleConversations.length, "eligible conversations");

    if (eligibleConversations.length === 0) {
      return new Response(
        JSON.stringify({
          total: 0,
          sent: 0,
          failed: 0,
          skipped: 0,
          conversations: [],
          message: "No eligible conversations in AI queue",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DRY RUN - apenas retorna preview sem enviar
    if (dry_run) {
      console.log("[broadcast-ai-queue] 🧪 DRY RUN - returning preview only");
      
      const previewResults = eligibleConversations.map((conv: any) => ({
        conversation_id: conv.id,
        phone: conv.contacts.phone,
        contact_name: `${conv.contacts.first_name || ""} ${conv.contacts.last_name || ""}`.trim(),
        status: "preview" as const,
      }));

      return new Response(
        JSON.stringify({
          dry_run: true,
          total: eligibleConversations.length,
          sent: 0,
          failed: 0,
          skipped: 0,
          conversations: previewResults,
          message: `Dry run: ${eligibleConversations.length} conversations would receive the broadcast`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Enviar mensagens (com delay para evitar throttling)
    const broadcastId = crypto.randomUUID();
    const results: BroadcastResult = {
      total: eligibleConversations.length,
      sent: 0,
      failed: 0,
      skipped: 0,
      conversations: [],
    };

    for (const conv of eligibleConversations) {
      const contact = conv.contacts as any;
      const phone = contact.phone;
      const whatsappId = contact.whatsapp_id;

      // Usar whatsapp_id se disponível (mais confiável), senão phone
      const targetNumber = whatsappId || phone;

      if (!targetNumber) {
        console.log("[broadcast-ai-queue] ⏭️ Skipping - no phone/whatsapp_id:", conv.id);
        results.skipped++;
        results.conversations.push({
          conversation_id: conv.id,
          phone: phone || "N/A",
          status: "skipped",
          error: "No phone or whatsapp_id",
        });
        continue;
      }

      try {
        console.log("[broadcast-ai-queue] 📤 Sending to:", targetNumber);

        // Chamar send-meta-whatsapp
        const { data: sendResult, error: sendError } = await supabase.functions.invoke(
          "send-meta-whatsapp",
          {
            body: {
              instance_id: metaInstance.id,
              phone_number: targetNumber,
              message: message,
              conversation_id: conv.id,
              skip_db_save: false, // Queremos que salve no histórico
            },
          }
        );

        if (sendError) {
          throw new Error(sendError.message);
        }

        console.log("[broadcast-ai-queue] ✅ Sent to:", targetNumber, "message_id:", sendResult?.message_id);
        
        results.sent++;
        results.conversations.push({
          conversation_id: conv.id,
          phone: phone,
          status: "sent",
        });

        // Atualizar metadata da mensagem com info de broadcast
        if (sendResult?.message_id) {
          await supabase
            .from("messages")
            .update({
              metadata: {
                broadcast_id: broadcastId,
                broadcast_type: "ai_queue_reengagement",
                sent_via: "broadcast-ai-queue",
              },
              sender_type: "system",
            })
            .eq("external_id", sendResult.message_id);
        }

        // Delay de 200ms entre envios (evitar throttling Meta)
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error("[broadcast-ai-queue] ❌ Failed to send to:", targetNumber, error);
        results.failed++;
        results.conversations.push({
          conversation_id: conv.id,
          phone: phone,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const elapsedMs = Date.now() - startTime;
    console.log("[broadcast-ai-queue] ✅ Broadcast completed in", elapsedMs, "ms");
    console.log("[broadcast-ai-queue] 📊 Results:", {
      total: results.total,
      sent: results.sent,
      failed: results.failed,
      skipped: results.skipped,
    });

    return new Response(
      JSON.stringify({
        ...results,
        broadcast_id: broadcastId,
        elapsed_ms: elapsedMs,
        message: `Broadcast completed: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[broadcast-ai-queue] ❌ Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
