import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TicketEventPayload {
  ticket_id: string;
  event_type: 'created' | 'assigned' | 'status_changed' | 'transferred' | 'resolved' | 'closed' | 'attachment_removed' | 'attachment_restored';
  actor_id: string;
  old_value?: string;
  new_value?: string;
  metadata?: Record<string, any>;
  ticket_event_id?: string;
  channels?: string[];
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
    const { ticket_id, event_type, actor_id, old_value, new_value, metadata, ticket_event_id, channels } = payload;

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
        status,
        priority,
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
        case 'attachment_removed':
          description = `Arquivo "${metadata?.file_name || 'evidência'}" removido do ticket #${ticket.ticket_number} por ${actorName}`;
          break;
        case 'attachment_restored':
          description = `Arquivo "${metadata?.file_name || 'evidência'}" restaurado no ticket #${ticket.ticket_number} por ${actorName}`;
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

    // 3. Fetch all stakeholders to notify
    const { data: stakeholders } = await supabase
      .from("ticket_stakeholders")
      .select("user_id, role")
      .eq("ticket_id", ticket_id);

    // Build recipient list
    const usersToNotify = new Set<string>();
    
    // For 'created' event: include everyone (including actor/creator)
    // For other events: exclude actor
    if (event_type === 'created') {
      if (ticket.created_by) usersToNotify.add(ticket.created_by);
      if (ticket.assigned_to) usersToNotify.add(ticket.assigned_to);
      stakeholders?.forEach((s) => usersToNotify.add(s.user_id));
    } else {
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
    }

    // 4. Create in-app notifications for notifiable events
    const notifiableEvents = ['created', 'resolved', 'closed', 'transferred', 'assigned'];
    if (notifiableEvents.includes(event_type) && usersToNotify.size > 0) {
      let title = "";
      let message = "";
      let notifType = 'ticket_status';

      switch (event_type) {
        case 'created':
          title = "Novo Ticket Criado";
          message = `Ticket #${ticket.ticket_number} criado por ${actorName}: ${ticket.subject}`;
          notifType = 'ticket_created';
          break;
        case 'resolved':
          title = "Ticket Resolvido";
          message = `Ticket #${ticket.ticket_number} foi resolvido por ${actorName}`;
          break;
        case 'closed':
          title = "Ticket Fechado";
          message = `Ticket #${ticket.ticket_number} foi fechado por ${actorName}`;
          break;
        case 'transferred':
          title = "Ticket Transferido";
          message = `Ticket #${ticket.ticket_number} foi transferido para ${metadata?.to_department || 'outro departamento'}`;
          notifType = 'ticket_transfer';
          break;
        case 'assigned':
          title = "Ticket Atribuído";
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
        console.log(`[notify-ticket-event] Created ${notifications.length} in-app notifications`);
      }
    }

    // 5. Send internal emails for 'created' event (with dedupe)
    let emailsSent = 0;
    const shouldSendEmail = channels?.includes('email') && ticket_event_id && event_type === 'created';

    if (shouldSendEmail && usersToNotify.size > 0) {
      // Fetch profiles with emails
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", Array.from(usersToNotify))
        .not("email", "is", null);

      const ticketNumber = ticket.ticket_number || ticket.id.slice(0, 8).toUpperCase();
      const appUrl = Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "";
      const ticketUrl = appUrl ? `${appUrl}/support/tickets/${ticket.id}` : "";

      const emailSubject = `Novo ticket criado - ${ticket.subject}`;
      const emailHtml = `
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#333;max-width:600px;margin:0 auto">
          <h2 style="margin:0 0 12px;color:#111">Novo ticket criado</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
            <tr><td style="padding:6px 12px;border:1px solid #eee;font-weight:bold;width:120px">Ticket</td><td style="padding:6px 12px;border:1px solid #eee">#${ticketNumber}</td></tr>
            <tr><td style="padding:6px 12px;border:1px solid #eee;font-weight:bold">Assunto</td><td style="padding:6px 12px;border:1px solid #eee">${ticket.subject}</td></tr>
            <tr><td style="padding:6px 12px;border:1px solid #eee;font-weight:bold">Prioridade</td><td style="padding:6px 12px;border:1px solid #eee">${ticket.priority}</td></tr>
            <tr><td style="padding:6px 12px;border:1px solid #eee;font-weight:bold">Status</td><td style="padding:6px 12px;border:1px solid #eee">${ticket.status}</td></tr>
            <tr><td style="padding:6px 12px;border:1px solid #eee;font-weight:bold">Criado por</td><td style="padding:6px 12px;border:1px solid #eee">${actorName}</td></tr>
          </table>
          ${ticketUrl ? `<p style="margin:16px 0"><a href="${ticketUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Abrir ticket</a></p>` : ''}
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
          <small style="color:#999">Notificacao interna - 3Cliques</small>
        </div>
      `;

      for (const p of profiles || []) {
        if (!p.email) continue;

        // Dedupe check via upsert
        const { data: inserted } = await supabase
          .from("ticket_notification_sends")
          .upsert(
            { ticket_event_id, recipient_user_id: p.id, channel: "email" },
            { onConflict: "ticket_event_id,recipient_user_id,channel", ignoreDuplicates: true }
          )
          .select("id");

        if (!inserted || inserted.length === 0) {
          console.log(`[notify-ticket-event] Email already sent to ${p.full_name}, skipping`);
          continue;
        }

        try {
          await supabase.functions.invoke("send-email", {
            body: {
              to: p.email,
              to_name: p.full_name || "Usuário",
              subject: emailSubject,
              html: emailHtml,
            },
          });
          emailsSent++;
          console.log(`[notify-ticket-event] Email sent to ${p.full_name} (${p.email})`);
        } catch (emailErr) {
          console.error(`[notify-ticket-event] Failed to send email to ${p.email}:`, emailErr);
        }
      }
    }

    // 6. Record in ticket_events table (only if not already created by caller)
    if (!ticket_event_id) {
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
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        stakeholders_notified: usersToNotify.size,
        emails_sent: emailsSent,
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
