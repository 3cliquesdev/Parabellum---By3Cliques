import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to get Instagram verify token from encrypted storage or env fallback
async function getVerifyToken(supabaseUrl: string, serviceRoleKey: string): Promise<string> {
  // Try to get from encrypted storage first
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/integration-decrypt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": serviceRoleKey,
      },
      body: JSON.stringify({ provider: "instagram" }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.secrets?.webhook_verify_token) {
        console.log("[instagram-webhook] Using encrypted verify token");
        return data.secrets.webhook_verify_token;
      }
    }
  } catch (e) {
    console.log("[instagram-webhook] Encrypted storage not available, using env");
  }

  // Fallback to environment variable
  return Deno.env.get("INSTAGRAM_WEBHOOK_VERIFY_TOKEN") || "";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const url = new URL(req.url);

  // GET: Webhook verification from Facebook
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = await getVerifyToken(supabaseUrl, serviceRoleKey);

    console.log("[instagram-webhook] Verification request:", { mode, token, challenge, hasVerifyToken: !!verifyToken });

    if (mode === "subscribe" && token === verifyToken) {
      console.log("[instagram-webhook] Verification successful");
      return new Response(challenge, { 
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    }

    console.log("[instagram-webhook] Verification failed - token mismatch");
    return new Response("Forbidden", { status: 403 });
  }

  // POST: Receive events from Instagram
  if (req.method === "POST") {
    try {
      const payload = await req.json();
      console.log("[instagram-webhook] Received webhook payload:", JSON.stringify(payload));

      for (const entry of payload.entry || []) {
        const instagramAccountId = entry.id;

        // Find the account in our database
        const { data: account } = await supabase
          .from("instagram_accounts")
          .select("id")
          .eq("instagram_user_id", instagramAccountId)
          .single();

        if (!account) {
          console.log("[instagram-webhook] Account not found for:", instagramAccountId);
          continue;
        }

        // Process COMMENTS
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === "comments") {
              const commentData = change.value;
              console.log("[instagram-webhook] Processing comment:", commentData);

              // Get the post from our database
              const { data: post } = await supabase
                .from("instagram_posts")
                .select("id")
                .eq("instagram_post_id", commentData.media?.id)
                .single();

              await supabase.from("instagram_comments").upsert({
                instagram_comment_id: commentData.id,
                post_id: post?.id || null,
                instagram_account_id: account.id,
                username: commentData.from?.username || "unknown",
                instagram_user_id: commentData.from?.id,
                text: commentData.text,
                timestamp: commentData.created_time 
                  ? new Date(commentData.created_time * 1000).toISOString()
                  : new Date().toISOString(),
                status: "new",
              }, { onConflict: "instagram_comment_id" });

              console.log("[instagram-webhook] Comment saved successfully");
            }
          }
        }

        // Process MESSAGES (DMs)
        if (entry.messaging) {
          for (const messaging of entry.messaging) {
            if (messaging.message) {
              const msg = messaging.message;
              const isFromBusiness = messaging.sender?.id === instagramAccountId;

              console.log("[instagram-webhook] Processing message:", msg);

              await supabase.from("instagram_messages").upsert({
                instagram_account_id: account.id,
                conversation_id: isFromBusiness 
                  ? messaging.recipient?.id 
                  : messaging.sender?.id,
                message_id: msg.mid,
                from_username: messaging.sender?.username || "unknown",
                from_instagram_id: messaging.sender?.id,
                text: msg.text,
                media_url: msg.attachments?.[0]?.payload?.url || null,
                is_from_business: isFromBusiness,
                timestamp: new Date(messaging.timestamp).toISOString(),
                status: isFromBusiness ? "replied" : "unread",
              }, { onConflict: "message_id" });

              console.log("[instagram-webhook] Message saved successfully");
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[instagram-webhook] Error processing webhook:", error);
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
