import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CRON Job: Process Pending Deal Closures
 * 
 * Runs every 5 minutes to check for deals with pending payments that haven't been validated.
 * After 30 minutes, marks them as organic sales (won without seller attribution).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[process-pending-deal-closures] 🔄 Starting CRON job...");

    // Calculate 30 minutes ago
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    // Find deals with pending_payment_at older than 30 minutes
    const { data: pendingDeals, error: fetchError } = await supabase
      .from("deals")
      .select("id, title, assigned_to, pending_kiwify_event_id, contact_id, value")
      .not("pending_payment_at", "is", null)
      .lt("pending_payment_at", thirtyMinutesAgo)
      .eq("status", "open");

    if (fetchError) {
      console.error("[process-pending-deal-closures] ❌ Error fetching deals:", fetchError);
      throw fetchError;
    }

    if (!pendingDeals || pendingDeals.length === 0) {
      console.log("[process-pending-deal-closures] ✅ No pending deals to process");
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-pending-deal-closures] 📊 Found ${pendingDeals.length} deals to close as organic`);

    let processedCount = 0;

    for (const deal of pendingDeals) {
      try {
        // Mark deal as won/organic
        const { error: updateError } = await supabase
          .from("deals")
          .update({
            status: "won",
            is_organic_sale: true,
            closed_at: new Date().toISOString(),
            pending_payment_at: null, // Clear the pending flag
          })
          .eq("id", deal.id);

        if (updateError) {
          console.error(`[process-pending-deal-closures] ❌ Error updating deal ${deal.id}:`, updateError);
          continue;
        }

        // Log interaction on contact timeline
        if (deal.contact_id) {
          await supabase.from("interactions").insert({
            customer_id: deal.contact_id,
            type: "note",
            channel: "other",
            content: `⏰ Deal fechado automaticamente como venda orgânica (vendedor não validou em 30 minutos)`,
            metadata: {
              deal_id: deal.id,
              deal_title: deal.title,
              organic: true,
              reason: "timeout_30min"
            }
          });
        }

        // Notify assigned seller that deal was marked as organic
        if (deal.assigned_to) {
          const valueFormatted = deal.value 
            ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(deal.value)
            : "";

          await supabase.from("notifications").insert({
            user_id: deal.assigned_to,
            type: "deal_marked_organic",
            title: "⏰ Deal Fechado como Orgânico",
            message: `O deal "${deal.title}"${valueFormatted ? ` (${valueFormatted})` : ""} foi marcado como venda orgânica. Você não informou o código Kiwify em 30 minutos.`,
            metadata: {
              deal_id: deal.id,
              deal_title: deal.title,
              value: deal.value
            },
            read: false
          });

          console.log(`[process-pending-deal-closures] 🔔 Notified seller ${deal.assigned_to} about organic closure`);
        }

        processedCount++;
        console.log(`[process-pending-deal-closures] ✅ Deal ${deal.id} closed as organic`);

      } catch (dealError) {
        console.error(`[process-pending-deal-closures] ❌ Error processing deal ${deal.id}:`, dealError);
      }
    }

    console.log(`[process-pending-deal-closures] 🎉 Completed. Processed ${processedCount}/${pendingDeals.length} deals`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedCount,
        total_found: pendingDeals.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[process-pending-deal-closures] ❌ Fatal error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
