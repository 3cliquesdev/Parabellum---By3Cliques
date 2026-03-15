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
    // Parse request body for optional account_id filter
    let accountId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        accountId = body.account_id || null;
      } catch {
        // No body or invalid JSON, sync all accounts
      }
    }

    // Fetch active Instagram accounts
    let query = supabase
      .from("instagram_accounts")
      .select("*")
      .eq("is_active", true);

    if (accountId) {
      query = query.eq("id", accountId);
    }

    const { data: accounts, error: accountsError } = await query;

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    console.log(`[instagram-sync] Found ${accounts?.length || 0} active accounts`);

    const results = [];

    for (const account of accounts || []) {
      // Create sync log entry
      const { data: syncLog } = await supabase
        .from("instagram_sync_log")
        .insert({
          instagram_account_id: account.id,
          sync_type: "full",
          status: "in_progress",
        })
        .select()
        .single();

      let itemsSynced = 0;
      let errorMessage: string | null = null;

      try {
        console.log(`[instagram-sync] Syncing account: ${account.username}`);

        // 1. Fetch recent posts (media)
        const postsResponse = await fetch(
          `${GRAPH_API_BASE}/${account.instagram_user_id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=50&access_token=${account.access_token}`
        );

        if (!postsResponse.ok) {
          const errorData = await postsResponse.json();
          throw new Error(`Graph API error: ${JSON.stringify(errorData)}`);
        }

        const postsData = await postsResponse.json();
        console.log(`[instagram-sync] Found ${postsData.data?.length || 0} posts`);

        // Save posts and fetch comments for each
        for (const post of postsData.data || []) {
          // Upsert post
          const { data: savedPost } = await supabase
            .from("instagram_posts")
            .upsert({
              instagram_account_id: account.id,
              instagram_post_id: post.id,
              caption: post.caption,
              media_type: post.media_type,
              media_url: post.media_url,
              thumbnail_url: post.thumbnail_url,
              permalink: post.permalink,
              likes_count: post.like_count || 0,
              comments_count: post.comments_count || 0,
              timestamp: post.timestamp,
            }, { onConflict: "instagram_post_id" })
            .select()
            .single();

          itemsSynced++;

          // 2. Fetch comments for each post
          const commentsResponse = await fetch(
            `${GRAPH_API_BASE}/${post.id}/comments?fields=id,username,text,timestamp&limit=100&access_token=${account.access_token}`
          );

          if (commentsResponse.ok) {
            const commentsData = await commentsResponse.json();
            console.log(`[instagram-sync] Found ${commentsData.data?.length || 0} comments for post ${post.id}`);

            for (const comment of commentsData.data || []) {
              await supabase.from("instagram_comments").upsert({
                instagram_comment_id: comment.id,
                post_id: savedPost?.id,
                instagram_account_id: account.id,
                username: comment.username,
                text: comment.text,
                timestamp: comment.timestamp,
              }, { onConflict: "instagram_comment_id" });

              itemsSynced++;
            }
          }

          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Update account last_sync_at
        await supabase
          .from("instagram_accounts")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("id", account.id);

        results.push({
          account: account.username,
          success: true,
          items_synced: itemsSynced,
        });

      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`[instagram-sync] Error syncing ${account.username}:`, error);
        errorMessage = errMsg;
        results.push({
          account: account.username,
          success: false,
          error: errMsg,
        });
      }

      // Update sync log
      if (syncLog) {
        await supabase
          .from("instagram_sync_log")
          .update({
            status: errorMessage ? "error" : "success",
            items_synced: itemsSynced,
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq("id", syncLog.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[instagram-sync] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
