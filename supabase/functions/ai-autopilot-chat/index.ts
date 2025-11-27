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
  customer_context?: {
    name: string;
    email: string;
    isVerified: boolean;
  } | null;
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

    const { conversationId, customerMessage, maxHistory = 10, customer_context }: AutopilotChatRequest = await req.json();
    
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
          id, first_name, last_name, email, phone, whatsapp_id, company, status
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

    // Obter API keys antecipadamente
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!OPENAI_API_KEY && !LOVABLE_API_KEY) {
      throw new Error('Nenhuma API key configurada (OPENAI_API_KEY ou LOVABLE_API_KEY)');
    }
    
    // Helper: Fetch com timeout de 60 segundos
    const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 60000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      try {
        const response = await fetch(url, { 
          ...options, 
          signal: controller.signal 
        });
        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // Helper: Chamar IA com fallback resiliente OpenAI → Lovable AI
    const callAIWithFallback = async (payload: any) => {
      if (OPENAI_API_KEY) {
        try {
          const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model: 'gpt-4o-mini', ...payload }),
          }, 60000);
          
          if (response.ok) {
            return await response.json();
          }
          
          if (response.status === 429 || response.status === 401) {
            throw new Error('OpenAI unavailable');
          }
          
          throw new Error(`OpenAI error: ${response.status}`);
        } catch (error) {
          // Continue para fallback
        }
      }
      
      if (!LOVABLE_API_KEY) {
        throw new Error('Nenhuma API key configurada');
      }
      
      const fallbackResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'google/gemini-2.5-flash', ...payload }),
      }, 60000);
      
      if (!fallbackResponse.ok) {
        if (fallbackResponse.status === 429) {
          throw new Error('QUOTA_ERROR: Erro de Saldo/Cota na IA.');
        }
        throw new Error(`Lovable AI failed: ${fallbackResponse.status}`);
      }
      
      return await fallbackResponse.json();
    }

    // OTIMIZAÇÃO 1: Classificar intenção ANTES da busca pesada
    console.log('[ai-autopilot-chat] Classificando intenção da mensagem...');
    
    let intentType = 'technical'; // Default
    let knowledgeArticles: any[] = [];
    
    try {
      const intentData = await callAIWithFallback({
        messages: [
          { 
            role: 'system', 
            content: 'Classifique a mensagem em uma categoria: "greeting" (saudações, oi, bom dia, obrigado, elogios), "technical" (dúvidas, problemas, pedidos de ajuda), ou "other". Responda APENAS com uma palavra: greeting, technical ou other.'
          },
          { role: 'user', content: customerMessage }
        ],
        temperature: 0.1,
        max_tokens: 10
      });

      intentType = intentData.choices?.[0]?.message?.content?.trim().toLowerCase() || 'technical';
      console.log(`[ai-autopilot-chat] Intenção detectada: ${intentType}`);
    } catch (error) {
      console.error('[ai-autopilot-chat] Erro na classificação de intenção:', error);
      // Fallback para busca técnica em caso de erro
    }
    
    // OTIMIZAÇÃO 2: Se for greeting, pular busca vetorial e responder direto
    if (intentType === 'greeting') {
      console.log('[ai-autopilot-chat] ⚡ Greeting detectado - pulando busca na base');
    } else {
      // OTIMIZAÇÃO 3: Buscar na base APENAS para dúvidas técnicas
      console.log('[ai-autopilot-chat] 🔍 Busca técnica - consultando base de conhecimento...');
      
      const removeAccents = (str: string) => 
        str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      try {
        const keywordData = await callAIWithFallback({
          messages: [
            { 
              role: 'system', 
              content: 'Extraia palavras-chave (substantivos e verbos) da mensagem. Responda apenas as palavras separadas por espaço.'
            },
            { role: 'user', content: customerMessage }
          ],
          temperature: 0.3,
          max_tokens: 50
        });

        const extractedKeywords = keywordData.choices?.[0]?.message?.content?.trim() || '';
        const words = extractedKeywords.toLowerCase().split(/\s+/).filter((w: string) => w.length > 1);
        
        if (words.length > 0) {
          const searchTerms = words.flatMap((word: string) => [word, removeAccents(word)])
            .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
          
          const orConditions = searchTerms.map((term: string) =>
            `title.ilike.%${term}%,content.ilike.%${term}%`
          ).join(',');
          
          const { data: relevantArticles } = await supabaseClient
            .from('knowledge_articles')
            .select('title, content')
            .eq('is_published', true)
            .or(orConditions)
            .limit(5);

          if (relevantArticles && relevantArticles.length > 0) {
            knowledgeArticles = relevantArticles;
            console.log(`[ai-autopilot-chat] ✅ ${relevantArticles.length} artigos encontrados`);
          } else {
            console.log('[ai-autopilot-chat] ⚠️ Nenhum artigo encontrado - transbordo automático');
            
            const fallbackMessage = "Não encontrei essa informação na nossa base de conhecimento. Vou chamar um atendente humano para te ajudar! 🤝";
            
            await supabaseClient.from('messages').insert({
              conversation_id: conversationId,
              content: fallbackMessage,
              sender_type: 'user',
              message_type: 'text',
              is_ai_generated: true,
              sender_id: null
            });
            
            await supabaseClient.from('conversations').update({ ai_mode: 'copilot' }).eq('id', conversationId);
            await supabaseClient.functions.invoke('route-conversation', { body: { conversationId } });
            
            return new Response(JSON.stringify({ 
              status: 'handoff',
              message: fallbackMessage,
              reason: 'no_knowledge_found'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (error) {
        console.error('[ai-autopilot-chat] Erro na busca de conhecimento:', error);
      }
    }

    // 5. Preparar system prompt inteligente baseado na intenção
    const contactName = customer_context?.name || `${contact.first_name} ${contact.last_name}`.trim();
    const contactCompany = contact.company ? ` da empresa ${contact.company}` : '';
    const contactStatus = contact.status || 'lead';
    
    let knowledgeContext = '';
    if (knowledgeArticles.length > 0) {
      knowledgeContext = `\n\n**📚 BASE DE CONHECIMENTO:**\n${knowledgeArticles.map(a => 
        `**${a.title}**\n${a.content}`
      ).join('\n\n---\n\n')}`;
    }
    
    // Personalizar saudação se for cliente conhecido
    const greetingNote = customer_context?.isVerified 
      ? `\n\n**IMPORTANTE:** Este é um cliente já verificado. Cumprimente-o pelo nome (${contactName}) de forma calorosa. NÃO peça email ou validação.`
      : '';
    
    const contextualizedSystemPrompt = `Você é o assistente virtual da empresa.

**REGRAS DE RESPOSTA:**
1. **Small Talk (Saudações/Elogios):** Se o usuário disser "Oi", "Bom dia", "Obrigado" ou fizer elogios, responda de forma educada e breve usando seu conhecimento geral. Não busque na base de dados para isso.
2. **Dúvidas Técnicas:** Se o usuário fizer uma pergunta sobre produtos, entregas ou suporte, USE O CONTEXTO ABAIXO se disponível.
3. **Casos de Devolução/Reembolso/Troca:** Se o cliente relatar problema com pedido (defeito, arrependimento, produto errado), colete: número do pedido, tipo do problema, e descrição. Depois use a ferramenta create_ticket para registrar automaticamente. NÃO transfira para humano nesses casos básicos.
4. **Falha:** Se a resposta não estiver no contexto e não for conversa fiada nem caso de ticket, diga: "Vou chamar um especialista para te ajudar" e pare.
${knowledgeContext}${greetingNote}

**Contexto do Cliente:**
- Nome: ${contactName}${contactCompany}
- Status: ${contactStatus}
- Canal: ${channel}
${customer_context?.email || contact.email ? `- Email: ${customer_context?.email || contact.email}` : ''}
${contact.phone ? `- Telefone: ${contact.phone}` : ''}

Use essas informações de forma natural e personalizada.`;

    // 6. Gerar resposta final
    const aiPayload: any = {
      messages: [
        { role: 'system', content: contextualizedSystemPrompt },
        ...messageHistory,
        { role: 'user', content: customerMessage }
      ],
      temperature: persona.temperature || 0.7,
      max_tokens: persona.max_tokens || 500
    };

    // Add built-in tools + persona tools
    const allTools = [
      {
        type: 'function',
        function: {
          name: 'create_ticket',
          description: 'Cria um ticket de suporte para devolução, troca, reembolso ou defeito.',
          parameters: {
            type: 'object',
            properties: {
              order_id: { type: 'string', description: 'O número do pedido informado pelo cliente.' },
              issue_type: { type: 'string', enum: ['devolucao', 'reembolso', 'troca', 'defeito'], description: 'O tipo de problema.' },
              description: { type: 'string', description: 'O motivo detalhado do problema relatado pelo cliente.' }
            },
            required: ['order_id', 'issue_type', 'description']
          }
        }
      },
      ...enabledTools.map((tool: any) => ({
        type: 'function',
        function: tool.function_schema
      }))
    ];

    if (allTools.length > 0) {
      aiPayload.tools = allTools;
    }

    const aiData = await callAIWithFallback(aiPayload);
    let assistantMessage = aiData.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';
    const toolCalls = aiData.choices?.[0]?.message?.tool_calls || [];

    // Handle tool calls (Function Calling)
    if (toolCalls.length > 0) {
      console.log('[ai-autopilot-chat] 🛠️ AI solicitou execução de ferramenta:', toolCalls);
      
      for (const toolCall of toolCalls) {
        if (toolCall.function.name === 'create_ticket') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            console.log('[ai-autopilot-chat] 🎫 Criando ticket automaticamente:', args);

            // Create ticket in database
            const { data: ticket, error: ticketError } = await supabaseClient
              .from('tickets')
              .insert({
                contact_id: contact.id,
                subject: `${args.issue_type.toUpperCase()} - Pedido ${args.order_id}`,
                description: args.description,
                priority: 'medium',
                status: 'open',
                source_conversation_id: conversationId,
                category: args.issue_type === 'defeito' ? 'tecnico' : 'financeiro',
                internal_note: `Ticket criado automaticamente pela IA. Pedido: ${args.order_id}`
              })
              .select()
              .single();

            if (ticketError) {
              console.error('[ai-autopilot-chat] ❌ Erro ao criar ticket:', ticketError);
              assistantMessage = 'Desculpe, não consegui registrar seu atendimento. Vou chamar um especialista.';
              
              // Fallback to human
              await supabaseClient.from('conversations').update({ ai_mode: 'copilot' }).eq('id', conversationId);
              await supabaseClient.functions.invoke('route-conversation', { body: { conversationId } });
            } else {
              console.log('[ai-autopilot-chat] ✅ Ticket criado com sucesso:', ticket.id);
              
              // Link conversation to ticket
              await supabaseClient
                .from('conversations')
                .update({ related_ticket_id: ticket.id })
                .eq('id', conversationId);

              // Generate confirmation message
              assistantMessage = `✅ Protocolo registrado com sucesso!\n\n📋 **Número do Ticket:** #${ticket.id.slice(0, 8).toUpperCase()}\n🔢 **Pedido:** ${args.order_id}\n📦 **Tipo:** ${args.issue_type.charAt(0).toUpperCase() + args.issue_type.slice(1)}\n\nNossa equipe vai analisar seu caso e retornar em breve. Você pode acompanhar o status através deste chat.`;
            }
          } catch (error) {
            console.error('[ai-autopilot-chat] ❌ Erro ao processar tool call:', error);
            assistantMessage = 'Ocorreu um erro ao processar sua solicitação. Vou chamar um especialista.';
            
            // Fallback to human
            await supabaseClient.from('conversations').update({ ai_mode: 'copilot' }).eq('id', conversationId);
            await supabaseClient.functions.invoke('route-conversation', { body: { conversationId } });
          }
        }
      }
    }

    // 7. Salvar resposta da IA como mensagem (PRIMEIRO salvar para visibilidade interna)
    const { data: savedMessage, error: saveError } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: assistantMessage,
        sender_type: 'user', // 'user' = sistema/agente interno
        message_type: 'text',
        is_ai_generated: true,
        sender_id: null,
        status: 'sending' // CRITICAL: Start with 'sending' status
      })
      .select()
      .single();

    if (saveError) {
      console.error('[ai-autopilot-chat] Erro ao salvar mensagem:', saveError);
    }

    const messageId = savedMessage?.id;

    // 8. Se WhatsApp, enviar via Evolution API e atualizar status
    if (channel === 'whatsapp' && contact.phone && messageId) {
      try {
        const { data: whatsappInstance } = await supabaseClient
          .from('whatsapp_instances')
          .select('*')
          .eq('status', 'connected')
          .or(`department_id.eq.${department},department_id.is.null`)
          .limit(1)
          .single();

        if (whatsappInstance) {
          const { data: whatsappResponse, error: whatsappError } = await supabaseClient.functions.invoke('send-whatsapp-message', {
            body: {
              instance_id: whatsappInstance.id,
              phone_number: contact.phone,
              whatsapp_id: contact.whatsapp_id,  // ✅ FASE 3: Passar JID original
              message: assistantMessage,
            },
          });

          if (whatsappError) {
            throw whatsappError;
          }

          // SUCCESS: Update message status to 'sent'
          await supabaseClient
            .from('messages')
            .update({ status: 'sent' })
            .eq('id', messageId);

          console.log('[ai-autopilot-chat] ✅ WhatsApp message sent successfully');
        }
      } catch (whatsappError) {
        console.error('[ai-autopilot-chat] ❌ WhatsApp send failed:', whatsappError);
        
        // FAILURE: Update message status to 'failed'
        await supabaseClient
          .from('messages')
          .update({ 
            status: 'failed',
            delivery_error: whatsappError instanceof Error ? whatsappError.message : 'Unknown error'
          })
          .eq('id', messageId);
      }
    } else if (messageId) {
      // Web chat - mark as sent immediately (no external API)
      await supabaseClient
        .from('messages')
        .update({ status: 'sent' })
        .eq('id', messageId);
    }

    // 9. Registrar uso de IA nos logs
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
      tool_calls: toolCalls,
      debug: {
        intent: intentType,
        articles_found: knowledgeArticles.map((a: any) => a.title),
        search_performed: intentType === 'technical'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ai-autopilot-chat] Erro geral:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Detectar erro de quota e retornar mensagem específica
    if (errorMessage.includes('QUOTA_ERROR') || errorMessage.includes('429')) {
      return new Response(JSON.stringify({ 
        error: 'Erro de Saldo/Cota na IA. Verifique o faturamento.',
        code: 'QUOTA_EXCEEDED'
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
