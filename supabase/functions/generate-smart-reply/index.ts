import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SmartReplyRequest {
  conversationId: string;
  maxMessages?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { conversationId, maxMessages = 10 }: SmartReplyRequest = await req.json();
    
    console.log(`[generate-smart-reply] Gerando sugestão para conversa ${conversationId}...`);

    // 1. Buscar conversa e verificar modo
    const { data: conversation, error: convError } = await supabaseClient
      .from('conversations')
      .select('ai_mode, contact_id, contacts!inner(first_name, last_name, company)')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('[generate-smart-reply] Conversa não encontrada:', convError);
      return new Response(JSON.stringify({ error: 'Conversa não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contact = conversation.contacts as any;

    // Só gera sugestão em modo copilot
    if (conversation.ai_mode !== 'copilot') {
      console.log('[generate-smart-reply] Conversa não está em copilot, ignorando...');
      return new Response(JSON.stringify({ 
        status: 'ignored', 
        reason: 'not_copilot' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Buscar últimas mensagens da conversa
    console.log(`[generate-smart-reply] Buscando últimas ${maxMessages} mensagens...`);
    const { data: messages, error: messagesError } = await supabaseClient
      .from('messages')
      .select('content, sender_type, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(maxMessages);

    if (messagesError || !messages || messages.length === 0) {
      console.error('[generate-smart-reply] Erro ao buscar mensagens:', messagesError);
      return new Response(JSON.stringify({ error: 'Nenhuma mensagem encontrada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Preparar contexto para IA (ordem cronológica)
    const reversedMessages = [...messages].reverse();
    const lastCustomerMessage = messages.find(m => m.sender_type === 'customer')?.content || '';
    
    const conversationContext = reversedMessages.map(m => {
      const role = m.sender_type === 'customer' ? 'Cliente' : 
                   m.sender_type === 'agent' ? 'Atendente' : 'Sistema';
      return `${role}: ${m.content}`;
    }).join('\n');

    const contactName = contact?.first_name 
      ? `${contact.first_name} ${contact.last_name || ''}`.trim()
      : 'Cliente';
    
    const contactCompany = contact?.company 
      ? ` da empresa ${contact.company}`
      : '';

    console.log('[generate-smart-reply] Chamando Lovable AI para gerar sugestão...');

    // 4. Chamar Lovable AI para gerar resposta sugerida
    const { data: aiResponse, error: aiError } = await supabaseClient.functions.invoke('analyze-ticket', {
      body: { 
        mode: 'reply',
        description: lastCustomerMessage,
        ticketSubject: `Conversa com ${contactName}${contactCompany}`,
        messages: conversationContext
      }
    });

    if (aiError || !aiResponse?.result) {
      console.error('[generate-smart-reply] Erro ao gerar sugestão:', aiError);
      return new Response(JSON.stringify({ 
        error: 'Erro ao gerar sugestão de resposta' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const suggestedReply = aiResponse.result;
    console.log(`[generate-smart-reply] Sugestão gerada (${suggestedReply.length} chars)`);

    // 5. Salvar sugestão na tabela ai_suggestions
    const { data: savedSuggestion, error: saveError } = await supabaseClient
      .from('ai_suggestions')
      .insert({
        conversation_id: conversationId,
        suggested_reply: suggestedReply,
        context: {
          last_message: lastCustomerMessage,
          contact_name: contactName,
          messages_count: messages.length,
          generated_at: new Date().toISOString()
        },
        used: false
      })
      .select()
      .single();

    if (saveError) {
      console.error('[generate-smart-reply] Erro ao salvar sugestão:', saveError);
      return new Response(JSON.stringify({ 
        error: 'Erro ao salvar sugestão' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[generate-smart-reply] ✅ Sugestão salva com sucesso!');

    return new Response(JSON.stringify({ 
      status: 'success',
      suggestion: savedSuggestion
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-smart-reply] Erro geral:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
