import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { record } = await req.json();
    console.log('[message-listener] New message received:', record.id);
    
    // Só processar mensagens de clientes
    if (record.sender_type !== 'contact') {
      console.log('[message-listener] Ignoring non-contact message');
      return new Response(JSON.stringify({ status: 'ignored', reason: 'not_contact' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar ai_mode da conversa
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('ai_mode')
      .eq('id', record.conversation_id)
      .single();

    if (convError) {
      console.error('[message-listener] Error fetching conversation:', convError);
      throw convError;
    }

    // Se não é autopilot, ignorar
    if (conversation?.ai_mode !== 'autopilot') {
      console.log('[message-listener] Conversation not in autopilot mode:', conversation?.ai_mode);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'not_autopilot', ai_mode: conversation?.ai_mode }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Chamar ai-autopilot-chat
    console.log('[message-listener] Triggering autopilot response for conversation:', record.conversation_id);
    
    const autopilotResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-autopilot-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        conversationId: record.conversation_id,
        customerMessage: record.content
      })
    });

    const autopilotData = await autopilotResponse.json();
    console.log('[message-listener] Autopilot response status:', autopilotResponse.status);

    if (!autopilotResponse.ok) {
      console.error('[message-listener] Autopilot error:', autopilotData);
      throw new Error(`Autopilot failed: ${JSON.stringify(autopilotData)}`);
    }

    return new Response(JSON.stringify({ 
      status: 'triggered', 
      conversation_id: record.conversation_id,
      autopilot_response: autopilotData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[message-listener] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
