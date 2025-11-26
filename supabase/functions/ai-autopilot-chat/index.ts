import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutopilotChatRequest {
  conversationId: string;
  customerMessage: string;
  maxHistory?: number;
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

    const { conversationId, customerMessage, maxHistory = 10 }: AutopilotChatRequest = await req.json();
    
    // FASE 4: Rate Limiting (10 mensagens por minuto por conversa)
    const { data: rateLimitAllowed, error: rateLimitError } = await supabaseClient
      .rpc('check_rate_limit', {
        p_identifier: `conversation_${conversationId}`,
        p_action_type: 'ai_autopilot_message',
        p_max_requests: 10,
        p_window_minutes: 1,
        p_block_minutes: 60
      });

    if (rateLimitError) {
      console.error('[ai-autopilot-chat] Erro ao verificar rate limit:', rateLimitError);
    }

    if (rateLimitAllowed === false) {
      console.warn('[ai-autopilot-chat] Rate limit excedido para conversa:', conversationId);
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Please try again in a moment.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`[ai-autopilot-chat] Processando mensagem para conversa ${conversationId}...`);

    // 1. Buscar conversa e informações do contato
    const { data: conversation, error: convError } = await supabaseClient
      .from('conversations')
      .select(`
        *,
        contacts!inner(
          id, first_name, last_name, email, phone, company, status
        )
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('[ai-autopilot-chat] Conversa não encontrada:', convError);
      return new Response(JSON.stringify({ error: 'Conversa não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contact = conversation.contacts as any;
    const channel = conversation.channel;
    const department = conversation.department || null;

    console.log(`[ai-autopilot-chat] Canal: ${channel}, Departamento: ${department}`);

    // 2. Buscar persona baseado em routing rules (canal + departamento)
    const { data: routingRules, error: rulesError } = await supabaseClient
      .from('ai_routing_rules')
      .select(`
        *,
        ai_personas!inner(*)
      `)
      .eq('channel', channel)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (rulesError) {
      console.error('[ai-autopilot-chat] Erro ao buscar routing rules:', rulesError);
    }

    // Filtrar regra que combina canal + departamento (se existir)
    let selectedRule = routingRules?.find(rule => rule.department === department);
    
    // Fallback: regra só com canal (department null)
    if (!selectedRule) {
      selectedRule = routingRules?.find(rule => rule.department === null);
    }

    if (!selectedRule || !selectedRule.ai_personas) {
      console.error('[ai-autopilot-chat] Nenhuma persona configurada para este canal/departamento');
      return new Response(JSON.stringify({ 
        error: 'Nenhuma persona configurada para este canal/departamento' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const persona = selectedRule.ai_personas as any;
    console.log(`[ai-autopilot-chat] Persona selecionada: ${persona.name} (${persona.id})`);

    // 3. Buscar tools vinculadas à persona
    const { data: personaTools, error: toolsError } = await supabaseClient
      .from('ai_persona_tools')
      .select(`
        ai_tools!inner(*)
      `)
      .eq('persona_id', persona.id);

    if (toolsError) {
      console.error('[ai-autopilot-chat] Erro ao buscar tools:', toolsError);
    }

    const enabledTools = personaTools
      ?.filter((pt: any) => pt.ai_tools?.is_enabled)
      .map((pt: any) => pt.ai_tools) || [];

    console.log(`[ai-autopilot-chat] ${enabledTools.length} tools disponíveis para esta persona`);

    // 4. Buscar histórico de mensagens
    const { data: messages, error: messagesError } = await supabaseClient
      .from('messages')
      .select('content, sender_type, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(maxHistory);

    if (messagesError) {
      console.error('[ai-autopilot-chat] Erro ao buscar histórico:', messagesError);
    }

    const messageHistory = messages?.reverse().map(m => ({
      role: m.sender_type === 'contact' ? 'user' : 'assistant',
      content: m.content
    })) || [];

    // 4.5. Buscar artigos relevantes da Base de Conhecimento (RAG)
    console.log('[ai-autopilot-chat] Buscando artigos relevantes na base de conhecimento...');
    
    // Função para remover acentos e normalizar texto
    const removeAccents = (str: string) => 
      str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Obter API key antecipadamente
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }
    
    // Extrair termos-chave usando LLM (Smart Extraction)
    let words: string[] = [];
    
    try {
      console.log('[ai-autopilot-chat] Usando LLM para extrair palavras-chave...');
      
      const keywordExtractionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-5-mini',
          messages: [
            { 
              role: 'system', 
              content: 'Você é um extrator de palavras-chave para busca em banco de dados (Full Text Search). Receba a frase do usuário, remova stop words (artigos, pronomes, saudações) e retorne APENAS os substantivos e verbos principais separados por espaço. Se houver sinônimos óbvios, inclua-os. Exemplo: "Qual endereço para devoluções" → "endereço devoluções devolução remetente"'
            },
            { 
              role: 'user', 
              content: customerMessage 
            }
          ],
          temperature: 0.3,
          max_tokens: 50
        }),
      });

      if (keywordExtractionResponse.ok) {
        const keywordData = await keywordExtractionResponse.json();
        const extractedKeywords = keywordData.choices?.[0]?.message?.content?.trim() || '';
        words = extractedKeywords.toLowerCase().split(/\s+/).filter((w: string) => w.length > 1);
        console.log('[ai-autopilot-chat] Palavras-chave extraídas via LLM:', words);
      } else {
        console.warn('[ai-autopilot-chat] Falha na extração LLM, usando fallback manual');
        throw new Error('LLM extraction failed');
      }
    } catch (error) {
      console.error('[ai-autopilot-chat] Erro na extração LLM, usando fallback:', error);
      // Fallback: extração manual simples
      words = customerMessage
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 5);
      console.log('[ai-autopilot-chat] Termos fallback:', words);
    }

    let knowledgeContext = '';
    
    if (words.length > 0) {
      // Criar termos de busca com e sem acentos
      const searchTerms = words.flatMap(word => [
        word,
        removeAccents(word)
      ]).filter((v, i, a) => a.indexOf(v) === i); // Remover duplicatas
      
      console.log('[ai-autopilot-chat] Termos normalizados:', searchTerms);
      
      // Construir busca OR para cada termo (title OU content)
      const orConditions = searchTerms.map(term => 
        `title.ilike.%${term}%,content.ilike.%${term}%`
      ).join(',');
      
      // Buscar artigos publicados que contenham qualquer um dos termos
      const { data: relevantArticles, error: articlesError } = await supabaseClient
        .from('knowledge_articles')
        .select('title, content')
        .eq('is_published', true)
        .or(orConditions)
        .limit(5);

      if (articlesError) {
        console.error('[ai-autopilot-chat] Erro ao buscar artigos:', articlesError);
      }

      if (relevantArticles && relevantArticles.length > 0) {
        console.log(`[ai-autopilot-chat] ✅ ${relevantArticles.length} artigos relevantes encontrados:`, 
          relevantArticles.map(a => a.title));
        
        knowledgeContext = `\n\n**📚 Base de Conhecimento Disponível:**\n${relevantArticles.map(a => 
          `**${a.title}**\n${a.content}`
        ).join('\n\n---\n\n')}

**IMPORTANTE:** Use as informações acima da Base de Conhecimento para responder com precisão. Se a resposta estiver na base de conhecimento, responda baseado nela.`;
      } else {
        console.log('[ai-autopilot-chat] ⚠️ Nenhum artigo relevante encontrado para os termos:', searchTerms);
      }
    }

    // 5. Preparar contexto do cliente para o system prompt
    const contactName = `${contact.first_name} ${contact.last_name}`.trim();
    const contactCompany = contact.company ? ` da empresa ${contact.company}` : '';
    const contactStatus = contact.status || 'lead';
    
    const contextualizedSystemPrompt = `${persona.system_prompt}
${knowledgeContext}

**Contexto do Cliente:**
- Nome: ${contactName}${contactCompany}
- Status: ${contactStatus}
- Canal: ${channel}
${contact.email ? `- Email: ${contact.email}` : ''}
${contact.phone ? `- Telefone: ${contact.phone}` : ''}

Lembre-se de usar essas informações de forma natural e personalizada em suas respostas.`;

    // 6. Chamar Lovable AI com persona e tools
    console.log('[ai-autopilot-chat] Chamando Lovable AI...');
    
    // API key já obtida anteriormente

    const aiPayload: any = {
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: contextualizedSystemPrompt },
        ...messageHistory,
        { role: 'user', content: customerMessage }
      ],
      temperature: persona.temperature || 0.7,
      max_tokens: persona.max_tokens || 500
    };

    // Adicionar tools se disponíveis
    if (enabledTools.length > 0) {
      aiPayload.tools = enabledTools.map((tool: any) => ({
        type: 'function',
        function: tool.function_schema
      }));
    }

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
      console.error('[ai-autopilot-chat] Erro na chamada AI:', aiResponse.status, errorText);
      throw new Error(`Lovable AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';
    const toolCalls = aiData.choices?.[0]?.message?.tool_calls || [];

    console.log(`[ai-autopilot-chat] Resposta gerada (${assistantMessage.length} chars)`);
    if (toolCalls.length > 0) {
      console.log(`[ai-autopilot-chat] ${toolCalls.length} tool calls detectadas`);
    }

    // 7. Salvar resposta da IA como mensagem
    const { error: saveError } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: assistantMessage,
        sender_type: 'user', // 'user' = sistema/agente interno
        message_type: 'text',
        is_ai_generated: true, // FASE 2: Marcar como mensagem da IA
        sender_id: null // FASE 2: IA não tem profile
      });

    if (saveError) {
      console.error('[ai-autopilot-chat] Erro ao salvar mensagem:', saveError);
    }

    // 8. Registrar uso de IA nos logs
    await supabaseClient
      .from('ai_usage_logs')
      .insert({
        feature_type: 'autopilot_chat',
        conversation_id: conversationId,
        result_data: {
          persona_id: persona.id,
          persona_name: persona.name,
          message_length: assistantMessage.length,
          tools_used: toolCalls.length,
          tool_calls: toolCalls
        }
      });

    console.log('[ai-autopilot-chat] ✅ Resposta processada com sucesso!');

    return new Response(JSON.stringify({ 
      status: 'success',
      message: assistantMessage,
      persona_used: {
        id: persona.id,
        name: persona.name
      },
      tool_calls: toolCalls
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ai-autopilot-chat] Erro geral:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
