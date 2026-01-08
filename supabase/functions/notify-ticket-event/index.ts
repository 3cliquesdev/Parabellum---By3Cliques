import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TicketEventPayload {
  ticket_id: string;
  event_type: 'created' | 'assigned' | 'status_changed' | 'transferred' | 'resolved' | 'closed';
  actor_id: string;
  old_value?: string;
  new_value?: string;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: TicketEventPayload = await req.json();
    const { ticket_id, event_type, actor_id, old_value, new_value, metadata } = payload;

    console.log(`[notify-ticket-event] Processing ${event_type} for ticket ${ticket_id}`);

    // Fetch ticket with relations
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select(`
        id,
        ticket_number,
        subject,
        customer_id,
        created_by,
        assigned_to,
        department_id,
        departments(name)
      `)
      .eq("id", ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.error("[notify-ticket-event] Ticket not found:", ticketError);
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get actor name
    let actorName = "Sistema";
    if (actor_id) {
      const { data: actorProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", actor_id)
        .single();
      
      if (actorProfile) {
        actorName = actorProfile.full_name;
      }
    }

    // 1. Add stakeholder if not already tracked
    if (actor_id) {
      const stakeholderRole = event_type === 'created' ? 'creator' :
                              event_type === 'assigned' ? 'assignee' :
                              event_type === 'transferred' ? 'transferor' : 'commenter';
      
      await supabase
        .from("ticket_stakeholders")
        .upsert({
          ticket_id,
          user_id: actor_id,
          role: stakeholderRole,
        }, { onConflict: 'ticket_id,user_id,role' });
    }

    // Also add assignee as stakeholder when assigned
    if (event_type === 'assigned' && new_value) {
      await supabase
        .from("ticket_stakeholders")
        .upsert({
          ticket_id,
          user_id: new_value,
          role: 'assignee',
        }, { onConflict: 'ticket_id,user_id,role' });
    }

    // 2. Create interaction in customer timeline (if customer_id exists)
    if (ticket.customer_id) {
      const interactionType = `ticket_${event_type}` as any;
      let description = "";
      
      switch (event_type) {
        case 'created':
          description = `Ticket #${ticket.ticket_number} criado: ${ticket.subject}`;
          break;
        case 'assigned':
          const { data: assignedTo } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", new_value)
            .single();
          description = `Ticket #${ticket.ticket_number} atribuído para ${assignedTo?.full_name || 'Agente'}`;
          break;
        case 'status_changed':
          description = `Ticket #${ticket.ticket_number} status alterado: ${old_value} → ${new_value}`;
          break;
        case 'transferred':
          const deptName = metadata?.to_department || (ticket.departments as any)?.name;
          description = `Ticket #${ticket.ticket_number} transferido para ${deptName}`;
          break;
        case 'resolved':
          description = `Ticket #${ticket.ticket_number} resolvido por ${actorName}`;
          break;
        case 'closed':
          description = `Ticket #${ticket.ticket_number} fechado por ${actorName}`;
          break;
      }

      await supabase
        .from("interactions")
        .insert({
          customer_id: ticket.customer_id,
          type: interactionType,
          content: description,
          channel: 'support',
          metadata: {
            ticket_id,
            ticket_number: ticket.ticket_number,
            event_type,
            actor_id,
            actor_name: actorName,
            old_value,
            new_value,
            ...metadata,
          },
          created_by: actor_id,
        });
      
      console.log(`[notify-ticket-event] Interaction logged for customer ${ticket.customer_id}`);
    }

    // 3. Fetch all stakeholders to notify (except actor)
    const { data: stakeholders } = await supabase
      .from("ticket_stakeholders")
      .select("user_id, role")
      .eq("ticket_id", ticket_id);

    // Also include creator and current assignee
    const usersToNotify = new Set<string>();
    
    if (ticket.created_by && ticket.created_by !== actor_id) {
      usersToNotify.add(ticket.created_by);
    }
    if (ticket.assigned_to && ticket.assigned_to !== actor_id) {
      usersToNotify.add(ticket.assigned_to);
    }
    
    stakeholders?.forEach((s) => {
      if (s.user_id !== actor_id) {
        usersToNotify.add(s.user_id);
      }
    });

    // 4. Create notifications for each stakeholder
    const notifiableEvents = ['resolved', 'closed', 'transferred', 'assigned'];
    if (notifiableEvents.includes(event_type) && usersToNotify.size > 0) {
      let title = "";
      let message = "";
      let notifType = 'ticket_status';

      switch (event_type) {
        case 'resolved':
          title = "✅ Ticket Resolvido";
          message = `Ticket #${ticket.ticket_number} foi resolvido por ${actorName}`;
          break;
        case 'closed':
          title = "📁 Ticket Fechado";
          message = `Ticket #${ticket.ticket_number} foi fechado por ${actorName}`;
          break;
        case 'transferred':
          title = "🔄 Ticket Transferido";
          message = `Ticket #${ticket.ticket_number} foi transferido para ${metadata?.to_department || 'outro departamento'}`;
          notifType = 'ticket_transfer';
          break;
        case 'assigned':
          title = "👤 Ticket Atribuído";
          const { data: newAssignee } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", new_value)
            .single();
          message = `Ticket #${ticket.ticket_number} foi atribuído para ${newAssignee?.full_name || 'novo agente'}`;
          break;
      }

      const notifications = Array.from(usersToNotify).map((userId) => ({
        user_id: userId,
        type: notifType,
        title,
        message,
        reference_id: ticket_id,
        metadata: {
          ticket_id,
          ticket_number: ticket.ticket_number,
          event_type,
          actor_name: actorName,
        },
      }));

      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notifError) {
        console.error("[notify-ticket-event] Error creating notifications:", notifError);
      } else {
        console.log(`[notify-ticket-event] Created ${notifications.length} notifications`);
      }
    }

    // 5. Also record in ticket_events table for ticket timeline
    await supabase
      .from("ticket_events")
      .insert({
        ticket_id,
        event_type,
        actor_id,
        old_value,
        new_value,
        metadata: metadata || {},
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        stakeholders_notified: usersToNotify.size,
        timeline_logged: !!ticket.customer_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[notify-ticket-event] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
