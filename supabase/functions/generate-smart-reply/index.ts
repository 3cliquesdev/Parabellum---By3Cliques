import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
      .select(`
        ai_mode, 
        contact_id, 
        channel,
        contacts!inner(
          first_name, 
          last_name, 
          company,
          assigned_user:profiles!contacts_assigned_to_fkey(department)
        )
      `)
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

    // 4. Buscar persona baseada em routing rules
    const channel = conversation.channel || 'whatsapp';
    const department = (conversation.contacts as any)?.assigned_user?.department || null;

    const { data: routingRules } = await supabaseClient
      .from('ai_routing_rules')
      .select(`*, ai_personas!inner(*)`)
      .eq('channel', channel)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    let persona = null;
    if (routingRules && routingRules.length > 0) {
      const matchedRule = routingRules.find(r => r.department === department) || 
                          routingRules.find(r => r.department === null);
      if (matchedRule) {
        persona = matchedRule.ai_personas;
      }
    }

    const systemPrompt = persona 
      ? `${persona.system_prompt}\n\n**Contexto:** Você está ajudando ${contactName}${contactCompany} em modo Copilot. Sugira respostas profissionais e úteis.`
      : `Você é um assistente em modo Copilot ajudando ${contactName}${contactCompany}. Sugira respostas profissionais e úteis.`;

    // 5. Chamar Lovable AI para gerar resposta sugerida
    console.log('[generate-smart-reply] Chamando Lovable AI para gerar sugestão...');
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const aiPayload = {
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Contexto da conversa:\n${conversationContext}\n\nGere uma resposta sugerida profissional para o atendente usar.` }
      ],
      temperature: persona?.temperature || 0.7,
      max_tokens: persona?.max_tokens || 300
    };

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(aiPayload),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[generate-smart-reply] Erro na chamada AI:', aiResponse.status, errorText);
      throw new Error(`Lovable AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const suggestedReply = aiData.choices?.[0]?.message?.content || 'Desculpe, não consegui gerar uma sugestão.';

    console.log(`[generate-smart-reply] Sugestão gerada (${suggestedReply.length} chars)`);

    // 6. Salvar sugestão na tabela ai_suggestions
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
