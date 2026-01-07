import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InternalCommentRequest {
  ticket_id: string;
  comment_content: string;
  commenter_id: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticket_id, comment_content, commenter_id }: InternalCommentRequest = await req.json();

    console.log('[notify-internal-comment] Processing:', { ticket_id, commenter_id });

    if (!ticket_id || !comment_content) {
      throw new Error("ticket_id and comment_content are required");
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch ticket with creator info
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select(`
        id,
        ticket_number,
        subject,
        created_by,
        assigned_to,
        creator:profiles!tickets_created_by_fkey(
          id,
          full_name,
          email
        ),
        assignee:profiles!tickets_assigned_to_fkey(
          id,
          full_name,
          email
        )
      `)
      .eq("id", ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.error('[notify-internal-comment] Ticket not found:', ticketError);
      throw new Error("Ticket not found");
    }

    // Get commenter info
    const { data: commenter } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", commenter_id)
      .single();

    const commenterName = commenter?.full_name || 'Agente';

    // Collect users to notify (exclude commenter)
    const usersToNotify: { id: string; full_name: string; email: string }[] = [];

    // Notify ticket creator if different from commenter
    const creatorData = ticket.creator as unknown;
    const creator = Array.isArray(creatorData) ? creatorData[0] : creatorData;
    if (ticket.created_by && ticket.created_by !== commenter_id && creator) {
      usersToNotify.push(creator as { id: string; full_name: string; email: string });
    }

    // Notify assigned agent if different from commenter and creator
    const assigneeData = ticket.assignee as unknown;
    const assignee = Array.isArray(assigneeData) ? assigneeData[0] : assigneeData;
    if (ticket.assigned_to && 
        ticket.assigned_to !== commenter_id && 
        ticket.assigned_to !== ticket.created_by &&
        assignee) {
      usersToNotify.push(assignee as { id: string; full_name: string; email: string });
    }

    console.log('[notify-internal-comment] Users to notify:', usersToNotify.map(u => u.full_name));

    // Insert notifications for each user
    const notifications = usersToNotify.map(user => ({
      user_id: user.id,
      title: `Nova nota interna no ticket ${ticket.ticket_number}`,
      message: `${commenterName} adicionou uma nota interna: "${comment_content.substring(0, 100)}${comment_content.length > 100 ? '...' : ''}"`,
      type: 'internal_comment',
      reference_type: 'ticket',
      reference_id: ticket_id,
      is_read: false,
    }));

    if (notifications.length > 0) {
      // Check if notifications table exists
      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notifError) {
        console.error('[notify-internal-comment] Error inserting notifications:', notifError);
        // Don't throw - just log the error since notifications might not be critical
      } else {
        console.log('[notify-internal-comment] Notifications created:', notifications.length);
      }
    }

    // Log the interaction
    const { error: interactionError } = await supabase.from("interactions").insert({
      contact_id: null,
      type: "internal_note",
      channel: "platform",
      content: `Nota interna adicionada por ${commenterName}: ${comment_content.substring(0, 200)}`,
      metadata: {
        ticket_id,
        ticket_number: ticket.ticket_number,
        commenter_id,
        commenter_name: commenterName,
        notified_users: usersToNotify.map(u => u.id),
      },
    });

    if (interactionError) {
      console.warn('[notify-internal-comment] Failed to log interaction:', interactionError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified_count: usersToNotify.length,
        notified_users: usersToNotify.map(u => u.full_name),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("[notify-internal-comment] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
