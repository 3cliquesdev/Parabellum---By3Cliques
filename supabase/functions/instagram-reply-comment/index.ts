import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { comment_id, text, user_id } = await req.json();

    if (!comment_id || !text) {
      return new Response(
        JSON.stringify({ error: "comment_id and text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[instagram-reply] Replying to comment ${comment_id}`);

    // 1. Get the comment with its Instagram data
    const { data: comment, error: commentError } = await supabase
      .from("instagram_comments")
      .select(`
        *,
        instagram_account:instagram_accounts(*)
      `)
      .eq("id", comment_id)
      .single();

    if (commentError || !comment) {
      throw new Error(`Comment not found: ${commentError?.message}`);
    }

    const account = comment.instagram_account;
    if (!account || !account.access_token) {
      throw new Error("Instagram account not properly configured");
    }

    // 2. Send reply via Graph API
    const replyResponse = await fetch(
      `${GRAPH_API_BASE}/${comment.instagram_comment_id}/replies`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          access_token: account.access_token,
        }),
      }
    );

    if (!replyResponse.ok) {
      const errorData = await replyResponse.json();
      console.error("[instagram-reply] Graph API error:", errorData);
      throw new Error(`Failed to send reply: ${JSON.stringify(errorData.error || errorData)}`);
    }

    const replyData = await replyResponse.json();
    console.log("[instagram-reply] Reply sent successfully:", replyData);

    // 3. Save reply to database
    const { error: insertError } = await supabase
      .from("instagram_comment_replies")
      .insert({
        comment_id: comment_id,
        instagram_reply_id: replyData.id,
        text: text,
        sent_by: user_id || null,
        timestamp: new Date().toISOString(),
      });

    if (insertError) {
      console.error("[instagram-reply] Failed to save reply:", insertError);
      // Don't throw - reply was sent successfully, just logging failed
    }

    // 4. Update comment status
    await supabase
      .from("instagram_comments")
      .update({
        replied: true,
        status: comment.status === "new" ? "contacted" : comment.status,
      })
      .eq("id", comment_id);

    return new Response(
      JSON.stringify({
        success: true,
        reply_id: replyData.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[instagram-reply] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
