import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticket_id, contact_id, content, attachments } = await req.json();

    console.log('[add-customer-comment] Dados recebidos:', {
      ticket_id: ticket_id || 'VAZIO',
      contact_id: contact_id || 'VAZIO',
      content_length: content?.length || 0,
      attachments_count: attachments?.length || 0
    });

    if (!ticket_id || !contact_id || !content) {
      const missing = [];
      if (!ticket_id) missing.push('ticket_id');
      if (!contact_id) missing.push('contact_id');
      if (!content) missing.push('content');
      
      console.error('[add-customer-comment] Campos obrigatórios faltando:', missing);
      return new Response(
        JSON.stringify({ 
          error: `Campos obrigatórios faltando: ${missing.join(', ')}`,
          missing_fields: missing
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[add-customer-comment] Adding comment to ticket:', ticket_id);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the ticket belongs to this customer
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, customer_id, status, subject, assigned_to, ticket_number, created_by')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.error('[add-customer-comment] Ticket not found:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Ticket not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (ticket.customer_id !== contact_id) {
      console.error('[add-customer-comment] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if ticket is closed
    if (ticket.status === 'closed') {
      return new Response(
        JSON.stringify({ error: 'Cannot add comment to closed ticket' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert the comment (with optional attachments)
    const insertData: Record<string, unknown> = {
      ticket_id,
      content,
      is_internal: false,
      source: 'customer',
      created_by: null,
    };
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      insertData.attachments = attachments;
    }

    const { data: comment, error: commentError } = await supabase
      .from('ticket_comments')
      .insert(insertData)
      .select()
      .single();

    if (commentError) {
      console.error('[add-customer-comment] Error inserting comment:', commentError);
      throw commentError;
    }

    // Update ticket updated_at
    await supabase
      .from('tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticket_id);

    // Reabrir ticket se estava em status de aguardando
    const reopenableStatuses = ['resolved', 'waiting_customer', 'pending'];
    const previousStatus = ticket.status;
    
    if (reopenableStatuses.includes(ticket.status)) {
      await supabase
        .from('tickets')
        .update({ 
          status: 'open',
          resolved_at: null 
        })
        .eq('id', ticket_id);
      
      console.log('[add-customer-comment] Ticket reopened from', ticket.status, 'to open');
      
      // Notificar agente atribuído via notify-ticket-event
      if (ticket.assigned_to) {
        try {
          await supabase.functions.invoke('notify-ticket-event', {
            body: {
              ticket_id,
              event_type: 'status_changed',
              actor_id: null, // Cliente (externo)
              old_value: previousStatus,
              new_value: 'open',
              metadata: { reason: 'customer_reply' }
            }
          });
          console.log('[add-customer-comment] Agent notified via notify-ticket-event');
        } catch (notifyError) {
          console.warn('[add-customer-comment] Failed to notify via edge function:', notifyError);
        }
      }
    }

    // Notificar agente sobre nova resposta do cliente (sempre que tem assigned_to)
    const ticketRef = ticket.ticket_number || ticket_id.slice(0, 8);
    const notificationsToInsert = [];
    
    if (ticket.assigned_to) {
      notificationsToInsert.push({
        user_id: ticket.assigned_to,
        title: 'Nova resposta do cliente',
        message: `Cliente respondeu ao ticket #${ticketRef}`,
        type: 'ticket_reply',
        metadata: {
          ticket_id,
          ticket_number: ticket.ticket_number || null,
          action_url: `/support?ticket=${ticket_id}`,
        },
        read: false
      });
      console.log('[add-customer-comment] Notification queued for agent:', ticket.assigned_to);
    }
    
    // Notificar também o criador do ticket se for diferente do agente atribuído
    if (ticket.created_by && ticket.created_by !== ticket.assigned_to) {
      notificationsToInsert.push({
        user_id: ticket.created_by,
        title: 'Nova resposta do cliente',
        message: `Cliente respondeu ao ticket #${ticketRef} que você criou`,
        type: 'ticket_reply',
        metadata: {
          ticket_id,
          ticket_number: ticket.ticket_number || null,
          action_url: `/support?ticket=${ticket_id}`,
        },
        read: false
      });
      console.log('[add-customer-comment] Notification queued for creator:', ticket.created_by);
    }
    
    // Inserir todas as notificações de uma vez
    if (notificationsToInsert.length > 0) {
      await supabase.from('notifications').insert(notificationsToInsert);
      console.log('[add-customer-comment] Notifications created:', notificationsToInsert.length);
    }

    console.log('[add-customer-comment] Comment added successfully:', comment.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        comment: {
          id: comment.id,
          content: comment.content,
          created_at: comment.created_at,
          is_customer: true
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[add-customer-comment] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
