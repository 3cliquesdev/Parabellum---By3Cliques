import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BroadcastRequest {
  message: string;
  dry_run?: boolean;
  limit?: number;
}

interface ConversationWithContact {
  id: string;
  contact_id: string;
  channel: string;
  contacts: {
    id: string;
    phone: string | null;
    whatsapp_id: string | null;
    first_name: string | null;
    last_name: string | null;
  };
}

interface BroadcastResult {
  conversation_id: string;
  phone: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
}

// Helper: Process broadcast in background
async function processBroadcast(
  supabase: SupabaseClient,
  jobId: string,
  message: string,
  conversations: ConversationWithContact[],
  metaInstanceId: string
) {
  console.log("[broadcast-ai-queue] 🚀 Background processing started for job:", jobId);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const results: BroadcastResult[] = [];

  // Update job to running
  await (supabase as any)
    .from("broadcast_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      total: conversations.length,
    })
    .eq("id", jobId);

  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i];
    const contact = conv.contacts;
    const phone = contact.phone;
    const whatsappId = contact.whatsapp_id;
    const targetNumber = whatsappId || phone;

    // Check if job was cancelled (every 5 iterations to reduce DB calls)
    if (i % 5 === 0) {
      const { data: currentJob } = await (supabase as any)
        .from("broadcast_jobs")
        .select("status")
        .eq("id", jobId)
        .single();

      if (currentJob?.status === "cancelled") {
        console.log("[broadcast-ai-queue] ⏹️ Job cancelled, stopping...");
        break;
      }

      // Update progress
      await (supabase as any)
        .from("broadcast_jobs")
        .update({ sent, failed, skipped, results })
        .eq("id", jobId);
    }

    if (!targetNumber) {
      console.log("[broadcast-ai-queue] ⏭️ Skipping - no phone/whatsapp_id:", conv.id);
      skipped++;
      results.push({
        conversation_id: conv.id,
        phone: phone || "N/A",
        status: "skipped",
        error: "No phone or whatsapp_id",
      });
      continue;
    }

    try {
      console.log("[broadcast-ai-queue] 📤 Sending to:", targetNumber);

      const { data: sendResult, error: sendError } = await supabase.functions.invoke(
        "send-meta-whatsapp",
        {
          body: {
            instance_id: metaInstanceId,
            phone_number: targetNumber,
            message: message,
            conversation_id: conv.id,
            skip_db_save: false,
          },
        }
      );

      if (sendError) {
        throw new Error(sendError.message);
      }

      console.log("[broadcast-ai-queue] ✅ Sent to:", targetNumber, "message_id:", sendResult?.message_id);

      sent++;
      results.push({
        conversation_id: conv.id,
        phone: phone || targetNumber,
        status: "sent",
      });

      // Update message metadata with broadcast info
      if (sendResult?.message_id) {
        await (supabase as any)
          .from("messages")
          .update({
            metadata: {
              broadcast_id: jobId,
              broadcast_type: "ai_queue_reengagement",
              sent_via: "broadcast-ai-queue",
            },
            sender_type: "system",
          })
          .eq("external_id", sendResult.message_id);
      }

      // Delay between sends (200ms to avoid Meta throttling)
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error("[broadcast-ai-queue] ❌ Failed to send to:", targetNumber, error);
      failed++;
      results.push({
        conversation_id: conv.id,
        phone: phone || targetNumber,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Final update
  const { data: finalStatus } = await (supabase as any)
    .from("broadcast_jobs")
    .select("status")
    .eq("id", jobId)
    .single();

  const isCancelled = finalStatus?.status === "cancelled";

  await (supabase as any)
    .from("broadcast_jobs")
    .update({
      status: isCancelled ? "cancelled" : "completed",
      sent,
      failed,
      skipped,
      results,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  console.log("[broadcast-ai-queue] ✅ Job finished:", {
    jobId,
    sent,
    failed,
    skipped,
    cancelled: isCancelled,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    // 1. Fetch active Meta instance
    const { data: metaInstance, error: instanceError } = await (supabase as any)
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

    // 2. Fetch eligible conversations (AI queue - WhatsApp only)
    const { data: conversations, error: convError } = await (supabase as any)
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

    const eligibleConversations = (conversations || []) as ConversationWithContact[];
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

    // DRY RUN - return preview only
    if (dry_run) {
      console.log("[broadcast-ai-queue] 🧪 DRY RUN - returning preview only");

      const previewResults = eligibleConversations.map((conv) => ({
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

    // 3. Create job record immediately
    const { data: job, error: jobError } = await (supabase as any)
      .from("broadcast_jobs")
      .insert({
        message: message.trim(),
        target_filter: { type: "ai_queue", channel: "whatsapp" },
        status: "pending",
        total: eligibleConversations.length,
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("[broadcast-ai-queue] ❌ Failed to create job:", jobError);
      return new Response(
        JSON.stringify({ error: "Failed to create broadcast job" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[broadcast-ai-queue] ✅ Job created:", job.id);

    // 4. Return immediately with job_id
    const response = new Response(
      JSON.stringify({
        job_id: job.id,
        total: eligibleConversations.length,
        message: "Broadcast job started",
        status: "pending",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

    // 5. Process in background using waitUntil
    EdgeRuntime.waitUntil(
      processBroadcast(supabase, job.id, message.trim(), eligibleConversations, metaInstance.id)
    );

    return response;
  } catch (error) {
    console.error("[broadcast-ai-queue] ❌ Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
