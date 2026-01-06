import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { ticket_id, contact_id, content } = await req.json();

    if (!ticket_id || !contact_id || !content) {
      return new Response(
        JSON.stringify({ error: 'ticket_id, contact_id, and content are required' }),
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
      .select('id, customer_id, status, subject')
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

    // Insert the comment
    const { data: comment, error: commentError } = await supabase
      .from('ticket_comments')
      .insert({
        ticket_id,
        content,
        is_internal: false,
        source: 'customer',
        created_by: null // Customer comments don't have a profile ID
      })
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

    // If ticket was resolved, reopen it
    if (ticket.status === 'resolved') {
      await supabase
        .from('tickets')
        .update({ 
          status: 'open',
          resolved_at: null 
        })
        .eq('id', ticket_id);
      
      console.log('[add-customer-comment] Ticket reopened due to customer response');
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
