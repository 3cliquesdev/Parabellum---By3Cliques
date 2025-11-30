import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload = await req.json();
    console.log("[inbound-email] Payload received:", JSON.stringify(payload, null, 2));

    // Resend webhook payload structure
    const { from, to, subject, text, html, headers } = payload;

    // 1. Extract sender email and name
    const fromEmail = from.match(/<(.+)>/)?.[1] || from;
    const fromName = from.match(/^([^<]+)/)?.[1]?.trim() || fromEmail.split("@")[0];

    console.log("[inbound-email] Sender:", { fromEmail, fromName });

    // 2. Find or create contact
    let { data: contact, error: contactFetchError } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .eq("email", fromEmail)
      .single();

    if (contactFetchError && contactFetchError.code !== "PGRST116") {
      throw contactFetchError;
    }

    if (!contact) {
      console.log("[inbound-email] Creating new contact...");
      const nameParts = fromName.split(" ");
      const { data: newContact, error: createError } = await supabase
        .from("contacts")
        .insert({
          email: fromEmail,
          first_name: nameParts[0] || fromName,
          last_name: nameParts.slice(1).join(" ") || "",
          source: "email",
        })
        .select()
        .single();

      if (createError) throw createError;
      contact = newContact;
    }

    console.log("[inbound-email] Contact:", contact);

    if (!contact) {
      throw new Error("Failed to find or create contact");
    }

    // 3. Check if this is a reply to an existing ticket
    // Look for "Re:" in subject or ticket ID pattern
    const isReply = subject.toLowerCase().startsWith("re:");
    let existingTicket = null;

    if (isReply && contact.id) {
      // Try to extract ticket ID from subject (format: "Re: [Subject] [Ticket #ID]")
      const ticketIdMatch = subject.match(/ticket #([a-f0-9-]+)/i);
      
      if (ticketIdMatch) {
        const { data: ticket } = await supabase
          .from("tickets")
          .select("id")
          .eq("id", ticketIdMatch[1])
          .eq("customer_id", contact.id)
          .in("status", ["open", "in_progress", "waiting_customer"])
          .single();

        existingTicket = ticket;
      }

      // Fallback: Find most recent open ticket from this customer
      if (!existingTicket) {
        const { data: ticket } = await supabase
          .from("tickets")
          .select("id")
          .eq("customer_id", contact.id)
          .in("status", ["open", "in_progress", "waiting_customer"])
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        existingTicket = ticket;
      }
    }

    // 4. Add comment to existing ticket OR create new ticket
    if (existingTicket) {
      console.log("[inbound-email] Adding comment to existing ticket:", existingTicket.id);

      const { error: commentError } = await supabase
        .from("ticket_comments")
        .insert({
          ticket_id: existingTicket.id,
          content: text || html || "Email sem conteúdo",
          is_internal: false,
        });

      if (commentError) throw commentError;

      // Update ticket status to indicate customer replied
      await supabase
        .from("tickets")
        .update({ 
          status: "in_progress",
          last_email_message_id: headers["Message-ID"] || null,
        })
        .eq("id", existingTicket.id);

      return new Response(
        JSON.stringify({
          success: true,
          action: "comment_added",
          ticket_id: existingTicket.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      console.log("[inbound-email] Creating new ticket...");

      // Get Suporte department
      const { data: department } = await supabase
        .from("departments")
        .select("id")
        .eq("name", "Suporte")
        .single();

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          customer_id: contact.id,
          subject: subject.replace(/^re:\s*/i, "").trim(),
          description: text || "Conteúdo em HTML",
          channel: "email",
          status: "open",
          priority: "medium",
          department_id: department?.id,
          last_email_message_id: headers["Message-ID"] || null,
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      console.log("[inbound-email] Ticket created:", ticket.id);

      return new Response(
        JSON.stringify({
          success: true,
          action: "ticket_created",
          ticket_id: ticket.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error: any) {
    console.error("[inbound-email] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});