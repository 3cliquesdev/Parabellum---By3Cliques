import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate environment
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[search-contacts-for-ticket] Missing env vars");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify JWT is valid
    const supabaseAuth = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      console.error("[search-contacts-for-ticket] Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { searchTerm } = await req.json();
    
    if (!searchTerm || typeof searchTerm !== "string" || searchTerm.length < 2) {
      return new Response(
        JSON.stringify({ contacts: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanTerm = searchTerm.trim().toLowerCase();
    console.log(`[search-contacts-for-ticket] Searching for: "${cleanTerm}" by user: ${user.id}`);

    // Use service role client to bypass RLS for optimized search
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    let query;
    
    // Prioritize email search if term contains @
    if (cleanTerm.includes("@")) {
      // Email search - use index on email
      query = supabase
        .from("contacts")
        .select("id, first_name, last_name, email")
        .ilike("email", `%${cleanTerm}%`)
        .limit(20);
    } else {
      // Name search - use OR condition
      const searchPattern = `%${cleanTerm}%`;
      query = supabase
        .from("contacts")
        .select("id, first_name, last_name, email")
        .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern}`)
        .limit(20);
    }

    const { data: contacts, error: queryError } = await query;

    if (queryError) {
      console.error("[search-contacts-for-ticket] Query error:", queryError.message);
      return new Response(
        JSON.stringify({ error: "Search failed", details: queryError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[search-contacts-for-ticket] Found ${contacts?.length || 0} contacts`);

    return new Response(
      JSON.stringify({ contacts: contacts || [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[search-contacts-for-ticket] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
