import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("FACEBOOK_APP_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!clientId) {
      return new Response(
        JSON.stringify({ 
          error: "Facebook App não configurado",
          message: "O administrador precisa configurar o FACEBOOK_APP_ID" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const redirectUri = `${supabaseUrl}/functions/v1/instagram-oauth-callback`;

    const scope = [
      "instagram_basic",
      "instagram_manage_comments",
      "instagram_manage_messages",
      "pages_read_engagement",
      "pages_show_list",
    ].join(",");

    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${scope}` +
      `&response_type=code`;

    return new Response(
      JSON.stringify({ authUrl }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error generating OAuth URL:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao gerar URL de autenticação" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
