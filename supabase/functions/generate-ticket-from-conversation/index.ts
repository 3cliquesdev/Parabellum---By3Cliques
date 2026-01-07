import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateTicketRequest {
  conversation_id: string;
  subject: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'financeiro' | 'tecnico' | 'bug' | 'outro';
  assigned_to?: string;
  internal_note?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for full access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🎫 Starting ticket generation from conversation');

    // Parse request body
    const {
      conversation_id,
      subject,
      description,
      priority,
      category,
      assigned_to,
      internal_note,
    }: CreateTicketRequest = await req.json();

    console.log('📝 Request data:', {
      conversation_id,
      subject,
      priority,
      category,
      assigned_to,
    });

    // Validate required fields
    if (!conversation_id || !subject || !priority || !category) {
      console.error('❌ Missing required fields');
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: conversation_id, subject, priority, category',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. Fetch conversation with contact info
    console.log('🔍 Fetching conversation:', conversation_id);
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select(`
        id, 
        contact_id, 
        related_ticket_id,
        contacts:contact_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', conversation_id)
      .single();

    if (conversationError || !conversation) {
      console.error('❌ Conversation not found:', conversationError);
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const contact = conversation.contacts as any;

    // Log if conversation already has a ticket (will be updated to newest)
    if (conversation.related_ticket_id) {
      console.log('ℹ️ Conversation has existing ticket:', conversation.related_ticket_id);
      console.log('📝 Creating additional ticket - related_ticket_id will point to newest');
    }

    console.log('✅ Conversation found, contact_id:', conversation.contact_id);

    // 2. Fetch last 10 messages with attachments
    console.log('💬 Fetching last 10 messages...');
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, content, sender_type, created_at, attachment_url, attachment_type')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (messagesError) {
      console.error('❌ Error fetching messages:', messagesError);
    }

    console.log(`📨 Found ${messages?.length || 0} messages`);

    // 3. Create message snapshot (formatted text)
    const messageSnapshot = messages
      ?.reverse()
      .map((msg) => {
        const timestamp = new Date(msg.created_at).toLocaleString('pt-BR');
        const sender = msg.sender_type === 'customer' ? '👤 Cliente' : '👨‍💼 Agente';
        let text = `[${timestamp}] ${sender}:\n${msg.content}`;
        
        if (msg.attachment_url) {
          text += `\n📎 Anexo: ${msg.attachment_url} (${msg.attachment_type || 'unknown'})`;
        }
        
        return text;
      })
      .join('\n\n---\n\n') || 'Nenhuma mensagem disponível';

    console.log('📸 Message snapshot created');

    // 4. Calculate due_date based on priority (SLA)
    const now = new Date();
    let dueDate: Date;

    switch (priority) {
      case 'urgent':
        // Urgent: +4 hours
        dueDate = new Date(now.getTime() + 4 * 60 * 60 * 1000);
        console.log('⏰ SLA: Urgent - 4 hours');
        break;
      case 'high':
        // High: +8 hours
        dueDate = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        console.log('⏰ SLA: High - 8 hours');
        break;
      case 'medium':
        // Medium: +24 hours
        dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        console.log('⏰ SLA: Medium - 24 hours');
        break;
      case 'low':
        // Low: +48 hours
        dueDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        console.log('⏰ SLA: Low - 48 hours');
        break;
      default:
        // Default: +24 hours
        dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        console.log('⏰ SLA: Default - 24 hours');
    }

    // 5. Combine description with message snapshot
    const fullDescription = description
      ? `${description}\n\n---\n\n## 📋 Histórico da Conversa (Últimas 10 Mensagens):\n\n${messageSnapshot}`
      : `## 📋 Histórico da Conversa (Últimas 10 Mensagens):\n\n${messageSnapshot}`;

    // 6. Create ticket with all data
    console.log('🎫 Creating ticket...');
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        customer_id: conversation.contact_id,
        source_conversation_id: conversation_id, // Bidirectional link 1
        subject,
        description: fullDescription,
        priority,
        category,
        status: 'open',
        assigned_to,
        due_date: dueDate.toISOString(),
        internal_note,
      })
      .select()
      .single();

    if (ticketError) {
      console.error('❌ Error creating ticket:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Failed to create ticket', details: ticketError }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Ticket created:', ticket.id);

    // 7. Update conversation with related_ticket_id (always points to newest ticket)
    console.log('🔗 Updating conversation with newest ticket link...');
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ related_ticket_id: ticket.id })
      .eq('id', conversation_id);

    if (updateError) {
      console.error('⚠️ Warning: Failed to update conversation link:', updateError);
      // Don't fail the request, ticket was created successfully
    } else {
      console.log('✅ Bidirectional link established (related_ticket_id → newest)');
    }

    // 8. Create interaction in timeline
    console.log('📝 Creating interaction in customer timeline...');
    const { error: interactionError } = await supabase
      .from('interactions')
      .insert({
        customer_id: conversation.contact_id,
        type: 'note',
        channel: 'other',
        content: `🎫 Ticket criado: ${subject}`,
        metadata: {
          ticket_id: ticket.id,
          ticket_subject: subject,
          ticket_priority: priority,
          ticket_category: category,
          source: 'ticket_generation',
          conversation_id: conversation_id,
        },
      });

    if (interactionError) {
      console.error('⚠️ Warning: Failed to create interaction:', interactionError);
      // Don't fail the request, ticket was created successfully
    } else {
      console.log('✅ Interaction created in timeline');
    }

    // 9. Send email notification to customer
    if (contact?.email) {
      console.log('📧 Sending ticket notification email...');
      try {
        const customerName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Cliente';
        
        await supabase.functions.invoke('send-ticket-notification', {
          body: {
            ticket_id: ticket.id,
            ticket_number: ticket.ticket_number || ticket.id.substring(0, 8).toUpperCase(),
            customer_email: contact.email,
            customer_name: customerName,
            subject: subject,
            description: description || '',
            priority: priority,
          },
        });
        console.log('✅ Ticket notification email sent');
      } catch (emailError) {
        console.error('⚠️ Warning: Failed to send ticket notification email:', emailError);
        // Don't fail the request, ticket was created successfully
      }
    } else {
      console.log('ℹ️ No email found for contact, skipping notification');
    }

    // 10. Return created ticket
    console.log('🎉 Ticket generation completed successfully');
    return new Response(
      JSON.stringify({
        success: true,
        ticket,
        message: 'Ticket created successfully from conversation',
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
