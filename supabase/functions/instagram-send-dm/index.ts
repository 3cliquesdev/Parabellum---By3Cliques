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
    const { conversation_id, text, account_id, user_id } = await req.json();

    if (!conversation_id || !text || !account_id) {
      return new Response(
        JSON.stringify({ error: "conversation_id, text, and account_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[instagram-send-dm] Sending DM to conversation ${conversation_id}`);

    // 1. Get the Instagram account
    const { data: account, error: accountError } = await supabase
      .from("instagram_accounts")
      .select("*")
      .eq("id", account_id)
      .single();

    if (accountError || !account) {
      throw new Error(`Account not found: ${accountError?.message}`);
    }

    if (!account.access_token) {
      throw new Error("Instagram account not properly configured");
    }

    // 2. Verify the conversation exists and customer initiated it
    const { data: existingMessages } = await supabase
      .from("instagram_messages")
      .select("*")
      .eq("conversation_id", conversation_id)
      .eq("is_from_business", false)
      .limit(1);

    if (!existingMessages || existingMessages.length === 0) {
      throw new Error("Cannot send message - customer must initiate the conversation first (Instagram API limitation)");
    }

    // 3. Send message via Graph API
    const sendResponse = await fetch(
      `${GRAPH_API_BASE}/${account.instagram_user_id}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: {
            id: conversation_id,
          },
          message: {
            text: text,
          },
          access_token: account.access_token,
        }),
      }
    );

    if (!sendResponse.ok) {
      const errorData = await sendResponse.json();
      console.error("[instagram-send-dm] Graph API error:", errorData);
      throw new Error(`Failed to send message: ${JSON.stringify(errorData.error || errorData)}`);
    }

    const sendData = await sendResponse.json();
    console.log("[instagram-send-dm] Message sent successfully:", sendData);

    // 4. Save message to database
    const { data: savedMessage, error: insertError } = await supabase
      .from("instagram_messages")
      .insert({
        instagram_account_id: account_id,
        conversation_id: conversation_id,
        message_id: sendData.message_id || `sent_${Date.now()}`,
        from_username: account.username,
        from_instagram_id: account.instagram_user_id,
        text: text,
        is_from_business: true,
        timestamp: new Date().toISOString(),
        status: "replied",
        assigned_to: user_id || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[instagram-send-dm] Failed to save message:", insertError);
    }

    // 5. Update all messages in conversation to "replied" status
    await supabase
      .from("instagram_messages")
      .update({ status: "replied", read: true })
      .eq("conversation_id", conversation_id)
      .eq("is_from_business", false);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: sendData.message_id,
        saved_message: savedMessage,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[instagram-send-dm] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
