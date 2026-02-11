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
    const { contact_id } = await req.json();

    if (!contact_id) {
      return new Response(
        JSON.stringify({ error: 'contact_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[get-customer-tickets] Fetching tickets for contact:', contact_id);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch tickets for this customer
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select(`
        id,
        ticket_number,
        subject,
        description,
        status,
        priority,
        category,
        created_at,
        updated_at,
        resolved_at,
        first_response_at,
        department:departments!tickets_department_id_fkey(id, name)
      `)
      .eq('customer_id', contact_id)
      .order('created_at', { ascending: false });

    if (ticketsError) {
      console.error('[get-customer-tickets] Error fetching tickets:', ticketsError);
      throw ticketsError;
    }

    // Fetch public comments for each ticket
    const ticketIds = tickets?.map(t => t.id) || [];
    
    let comments: any[] = [];
    if (ticketIds.length > 0) {
      const { data: commentsData, error: commentsError } = await supabase
        .from('ticket_comments')
        .select(`
          id,
          ticket_id,
          content,
          created_at,
          is_internal,
          source,
          created_by,
          author:profiles!ticket_comments_created_by_fkey(full_name)
        `)
        .in('ticket_id', ticketIds)
        .eq('is_internal', false)
        .order('created_at', { ascending: true });

      if (commentsError) {
        console.error('[get-customer-tickets] Error fetching comments:', commentsError);
      } else {
        comments = commentsData || [];
      }
    }

    // Group comments by ticket_id
    const commentsByTicket = comments.reduce((acc, comment) => {
      if (!acc[comment.ticket_id]) {
        acc[comment.ticket_id] = [];
      }
      acc[comment.ticket_id].push({
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        source: comment.source,
        author_name: comment.author?.full_name || 'Equipe de Suporte',
        is_customer: comment.source === 'customer'
      });
      return acc;
    }, {} as Record<string, any[]>);

    // Attach comments to tickets
    const ticketsWithComments = tickets?.map(ticket => ({
      ...ticket,
      comments: commentsByTicket[ticket.id] || [],
      comment_count: (commentsByTicket[ticket.id] || []).length
    })) || [];

    console.log('[get-customer-tickets] Found', ticketsWithComments.length, 'tickets');

    return new Response(
      JSON.stringify({ 
        success: true, 
        tickets: ticketsWithComments 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[get-customer-tickets] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
