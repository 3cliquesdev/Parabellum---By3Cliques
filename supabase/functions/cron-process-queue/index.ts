import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

/**
 * Cron endpoint to process the WhatsApp message queue
 * Call this every 5-10 seconds from an external cron service (e.g., EasyCron, Cloudflare Workers)
 * 
 * Security: Pass X-Cron-Secret header with your CRON_SECRET
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate cron secret for security
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = Deno.env.get("CRON_SECRET");
    
    // Allow if secret matches OR if called from within Supabase (has authorization header)
    const authHeader = req.headers.get("authorization");
    const isInternalCall = authHeader?.startsWith("Bearer ");
    
    if (!isInternalCall && cronSecret !== expectedSecret) {
      console.warn("[cron-process-queue] Unauthorized access attempt");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[cron-process-queue] Triggering queue processor...");

    // Call the main process-message-queue function
    const { data, error } = await supabase.functions.invoke("process-message-queue", {
      body: { source: "cron" }
    });

    if (error) {
      console.error("[cron-process-queue] Error invoking processor:", error);
    }

    console.log("[cron-process-queue] Message queue processed:", data);

    // D4: Process conversation dispatch jobs (Enterprise distribution)
    console.log("[cron-process-queue] Triggering conversation dispatcher...");
    
    const { data: dispatchData, error: dispatchError } = await supabase.functions.invoke("dispatch-conversations", {
      body: { source: "cron" }
    });

    if (dispatchError) {
      console.error("[cron-process-queue] Error invoking dispatcher:", dispatchError);
    } else {
      console.log("[cron-process-queue] Dispatch completed:", dispatchData);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        timestamp: new Date().toISOString(),
        message_queue: data,
        dispatch_queue: dispatchData
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[cron-process-queue] Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
