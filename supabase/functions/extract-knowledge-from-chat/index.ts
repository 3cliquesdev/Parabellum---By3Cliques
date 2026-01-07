import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, ticketId } = await req.json();
    
    console.log('[extract-knowledge] Processing conversation:', conversationId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Buscar histórico de mensagens
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError || !messages || messages.length < 3) {
      console.log('[extract-knowledge] Not enough messages to extract knowledge');
      return new Response(
        JSON.stringify({ success: false, reason: 'insufficient_messages' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar informações do agente que resolveu
    const humanMessages = messages.filter(m => m.sender_type === 'user' && m.sender_id !== null);
    const agentId = humanMessages[0]?.sender_id;
    
    let agentName = 'Agente';
    if (agentId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', agentId)
        .single();
      
      if (profile) agentName = profile.full_name;
    }

    // Construir histórico para IA
    const chatHistory = messages.map(m => 
      `${m.sender_type === 'user' && m.sender_id ? 'Agente' : 'Cliente'}: ${m.content}`
    ).join('\n\n');

    // Chamar IA para extrair conhecimento
    console.log('[extract-knowledge] Calling AI to analyze conversation...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente especializado em extrair conhecimento de conversas de suporte.

Analise o histórico de conversa abaixo e identifique:
1. Qual era a DÚVIDA ou PROBLEMA principal do cliente
2. Qual foi a SOLUÇÃO dada pelo agente

Retorne um JSON com:
{
  "question": "Pergunta/problema do cliente (max 200 caracteres)",
  "solution": "Solução completa dada pelo agente (max 1000 caracteres)",
  "category": "Categoria da dúvida (ex: Pedidos, Pagamento, Produto, etc)"
}

Se não conseguir extrair conhecimento útil, retorne null.`
          },
          {
            role: 'user',
            content: `Histórico da conversa:\n\n${chatHistory}`
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const extractedKnowledge = JSON.parse(aiData.choices[0].message.content);

    if (!extractedKnowledge || !extractedKnowledge.question || !extractedKnowledge.solution) {
      console.log('[extract-knowledge] No useful knowledge extracted');
      return new Response(
        JSON.stringify({ success: false, reason: 'no_knowledge_found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[extract-knowledge] Knowledge extracted:', extractedKnowledge);

    // Salvar como DRAFT (rascunho) para aprovação
    const { data: article, error: insertError } = await supabase
      .from('knowledge_articles')
      .insert({
        title: extractedKnowledge.question,
        content: extractedKnowledge.solution,
        category: extractedKnowledge.category || 'Aprendizado Passivo',
        tags: ['passive_learning', 'draft', conversationId],
        source: 'passive_learning',
        status: 'draft', // Rascunho - precisa aprovação
        is_published: false,
        created_by: agentId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[extract-knowledge] Error saving article:', insertError);
      throw insertError;
    }

    // Notificar gerentes para aprovar
    const { data: managers } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'manager', 'support_manager']);

    if (managers && managers.length > 0) {
      for (const manager of managers) {
        await supabase.from('notifications').insert({
          user_id: manager.user_id,
          type: 'knowledge_approval',
          title: '🤖 IA Aprendeu com Atendimento',
          message: `A IA extraiu conhecimento do atendimento de ${agentName}. Aprove para publicar: "${extractedKnowledge.question.substring(0, 60)}..."`,
          metadata: {
            article_id: article.id,
            conversation_id: conversationId,
            ticket_id: ticketId,
            agent_name: agentName,
          },
          read: false,
        });
      }
    }

    console.log('[extract-knowledge] Knowledge saved as draft:', article.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        article_id: article.id,
        question: extractedKnowledge.question,
        agent_name: agentName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[extract-knowledge] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
