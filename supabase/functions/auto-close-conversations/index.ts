import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    console.log('[Auto-Close] Starting Ghost Protocol - checking inactive conversations...');

    // 1. Buscar conversas abertas sem resposta do cliente há mais de 24 horas
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: conversations, error: fetchError } = await supabase
      .from('conversations')
      .select('id, contact_id, last_message_at')
      .eq('status', 'open')
      .lt('last_message_at', twentyFourHoursAgo);

    if (fetchError) {
      console.error('[Auto-Close] Error fetching conversations:', fetchError);
      throw fetchError;
    }

    console.log(`[Auto-Close] Found ${conversations?.length || 0} inactive conversations`);

    if (!conversations || conversations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, closed_count: 0, message: 'No inactive conversations found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let closedCount = 0;

    // 2. Para cada conversa inativa, enviar mensagem de sistema e fechar
    for (const conversation of conversations) {
      try {
        // Enviar mensagem de sistema
        await supabase
          .from('messages')
          .insert({
            conversation_id: conversation.id,
            content: '⏰ Esta conversa foi encerrada automaticamente por inatividade. Se precisar de ajuda, inicie uma nova conversa.',
            sender_type: 'system',
          });

        // Fechar conversa
        await supabase
          .from('conversations')
          .update({
            status: 'closed',
            auto_closed: true,
            closed_at: new Date().toISOString(),
          })
          .eq('id', conversation.id);

        closedCount++;
        console.log(`[Auto-Close] ✅ Closed conversation ${conversation.id}`);
      } catch (err) {
        console.error(`[Auto-Close] Error closing conversation ${conversation.id}:`, err);
      }
    }

    console.log(`[Auto-Close] ✅ Ghost Protocol complete - closed ${closedCount} conversations`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        closed_count: closedCount,
        message: `Closed ${closedCount} inactive conversations` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Auto-Close] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
