import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  // Get redirect URL from environment or use default
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
  const redirectBase = `${frontendUrl}/instagram/settings`;

  if (error) {
    console.error("[instagram-oauth] Auth error:", error, errorDescription);
    return Response.redirect(`${redirectBase}?error=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code) {
    console.error("[instagram-oauth] No authorization code received");
    return Response.redirect(`${redirectBase}?error=no_code`);
  }

  try {
    const clientId = Deno.env.get("FACEBOOK_APP_ID");
    const clientSecret = Deno.env.get("FACEBOOK_APP_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const redirectUri = `${supabaseUrl}/functions/v1/instagram-oauth-callback`;

    if (!clientId || !clientSecret) {
      throw new Error("Facebook App credentials not configured");
    }

    console.log("[instagram-oauth] Exchanging code for access token...");

    // 1. Exchange code for short-lived access token
    const tokenResponse = await fetch(
      `${GRAPH_API_BASE}/oauth/access_token?` +
      `client_id=${clientId}` +
      `&client_secret=${clientSecret}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${code}`
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(`Token exchange failed: ${JSON.stringify(errorData)}`);
    }

    const tokenData = await tokenResponse.json();
    const shortLivedToken = tokenData.access_token;

    console.log("[instagram-oauth] Got short-lived token, exchanging for long-lived...");

    // 2. Exchange for long-lived token (60 days)
    const longLivedResponse = await fetch(
      `${GRAPH_API_BASE}/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${clientId}` +
      `&client_secret=${clientSecret}` +
      `&fb_exchange_token=${shortLivedToken}`
    );

    if (!longLivedResponse.ok) {
      const errorData = await longLivedResponse.json();
      throw new Error(`Long-lived token exchange failed: ${JSON.stringify(errorData)}`);
    }

    const longLivedData = await longLivedResponse.json();
    const accessToken = longLivedData.access_token;
    const expiresIn = longLivedData.expires_in || 5184000; // Default 60 days

    console.log("[instagram-oauth] Got long-lived token, fetching accounts...");

    // 3. Get Facebook Pages connected to the account
    const pagesResponse = await fetch(
      `${GRAPH_API_BASE}/me/accounts?access_token=${accessToken}`
    );

    if (!pagesResponse.ok) {
      const errorData = await pagesResponse.json();
      throw new Error(`Failed to fetch pages: ${JSON.stringify(errorData)}`);
    }

    const pagesData = await pagesResponse.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error("No Facebook Pages found. Make sure you have a Facebook Page connected to your Instagram Business Account.");
    }

    // 4. Get Instagram Business Account for each page
    let instagramAccount = null;
    let pageAccessToken = accessToken;

    for (const page of pagesData.data) {
      const igResponse = await fetch(
        `${GRAPH_API_BASE}/${page.id}?fields=instagram_business_account&access_token=${page.access_token || accessToken}`
      );

      if (igResponse.ok) {
        const igData = await igResponse.json();
        if (igData.instagram_business_account) {
          instagramAccount = igData.instagram_business_account;
          pageAccessToken = page.access_token || accessToken;
          break;
        }
      }
    }

    if (!instagramAccount) {
      throw new Error("No Instagram Business Account found. Make sure your Instagram is connected to a Facebook Page.");
    }

    console.log("[instagram-oauth] Found Instagram account:", instagramAccount.id);

    // 5. Get Instagram account details
    const igDetailsResponse = await fetch(
      `${GRAPH_API_BASE}/${instagramAccount.id}?fields=id,username,profile_picture_url,followers_count&access_token=${pageAccessToken}`
    );

    if (!igDetailsResponse.ok) {
      const errorData = await igDetailsResponse.json();
      throw new Error(`Failed to fetch Instagram details: ${JSON.stringify(errorData)}`);
    }

    const igDetails = await igDetailsResponse.json();

    console.log("[instagram-oauth] Instagram details:", igDetails);

    // 6. Save to database
    const { error: upsertError } = await supabase
      .from("instagram_accounts")
      .upsert({
        instagram_user_id: igDetails.id,
        username: igDetails.username,
        access_token: pageAccessToken,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        profile_picture_url: igDetails.profile_picture_url,
        followers_count: igDetails.followers_count || 0,
        is_active: true,
        last_sync_at: new Date().toISOString(),
      }, { onConflict: "instagram_user_id" });

    if (upsertError) {
      throw new Error(`Failed to save account: ${upsertError.message}`);
    }

    console.log("[instagram-oauth] Account saved successfully!");

    // Redirect back to settings with success
    return Response.redirect(`${redirectBase}?success=true&username=${igDetails.username}`);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[instagram-oauth] Error:", error);
    return Response.redirect(`${redirectBase}?error=${encodeURIComponent(errorMessage)}`);
  }
});
