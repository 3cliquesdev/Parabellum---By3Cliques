import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// FASE 2: Função para gerar hash SHA-256 da pergunta normalizada
async function generateQuestionHash(message: string): Promise<string> {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^\w\s]/g, "") // Remove pontuação
    .trim();
  
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
    
    // Validação defensiva
    if (!conversationId || conversationId === 'undefined') {
      console.error('[ai-autopilot-chat] ❌ conversationId inválido:', conversationId);
      return new Response(JSON.stringify({ 
        error: 'conversationId é obrigatório' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('[ai-autopilot-chat] Request received:', { conversationId, messagePreview: customerMessage?.substring(0, 50) });

    // 1. Buscar conversa e informações do contato (ANTES do cache)
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
    const department = conversation.department || null;

    // FASE 4: Buscar canal da ÚLTIMA mensagem do cliente (não da conversa)
    const { data: lastCustomerMessage } = await supabaseClient
      .from('messages')
      .select('channel')
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'contact')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const responseChannel = lastCustomerMessage?.channel || 'web_chat';
    
    console.log(`[ai-autopilot-chat] Canal da última mensagem: ${responseChannel}, Departamento: ${department}`);

    // FASE 2: Verificar cache antes de processar (zero latência para perguntas repetidas)
    const questionHash = await generateQuestionHash(customerMessage);
    const { data: cachedResponse } = await supabaseClient
      .from('ai_response_cache')
      .select('answer, context_ids, created_at')
      .eq('question_hash', questionHash)
      .gte('created_at', new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()) // ✅ FASE 3: TTL reduzido para 1h
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cachedResponse) {
      console.log('✅ [CACHE HIT] Resposta instantânea recuperada do cache');
      
      // 🆕 FASE 1: Verificar se resposta cacheada é fallback e executar handoff real
      const cachedFallbackPhrases = [
        'vou chamar um especialista',
        'transferir para um atendente',
        'encaminhar para um humano',
        'não tenho essa informação',
        'não consegui registrar'
      ];
      
      const isCachedFallback = cachedFallbackPhrases.some(phrase => 
        cachedResponse.answer.toLowerCase().includes(phrase)
      );
      
      if (isCachedFallback) {
        console.log('🚨 [CACHE] Resposta cacheada é FALLBACK - IGNORANDO cache e gerando nova resposta');
        
        // 1. Mudar modo para copilot
        await supabaseClient
          .from('conversations')
          .update({ ai_mode: 'copilot' })
          .eq('id', conversationId);
        
        // 2. Rotear para agente humano
        await supabaseClient.functions.invoke('route-conversation', {
          body: { conversationId }
        });
        
        // 3. Criar ticket se for financeiro
        const financialKeywords = ['saque', 'saldo', 'pix', 'dinheiro', 'pagamento', 'reembolso', 'estorno'];
        const isFinancial = financialKeywords.some(k => customerMessage.toLowerCase().includes(k));
        
        let ticketProtocol = '';
        if (isFinancial) {
          const { data: ticket } = await supabaseClient
            .from('tickets')
            .insert({
              customer_id: contact.id,
              subject: `💰 Solicitação Financeira - ${customerMessage.substring(0, 50)}`,
              description: customerMessage,
              priority: 'high',
              status: 'open',
              category: 'financeiro',
              source_conversation_id: conversationId
            })
            .select()
            .single();
          
          if (ticket) {
            ticketProtocol = ticket.id.slice(0, 8).toUpperCase();
            console.log('🎫 [CACHE] Ticket financeiro criado:', ticket.id);
          }
        }
        
        // 4. Registrar nota interna
        await supabaseClient.from('interactions').insert({
          customer_id: contact.id,
          type: 'internal_note',
          content: `🤖→👤 Handoff automático (cache poisoning detectado): "${customerMessage}"`,
          channel: responseChannel
        });
        
        // 5. Invalidar esse cache
        await supabaseClient
          .from('ai_response_cache')
          .delete()
          .eq('question_hash', questionHash);
        
        console.log('✅ [CACHE] Handoff executado, cache invalidado');
        
        // 🆕 6. RETORNAR RESPOSTA IMEDIATA DE HANDOFF (não usar cache ruim!)
        const handoffMessage = isFinancial && ticketProtocol
          ? `Entendi sua solicitação financeira. Estou transferindo você para um especialista humano que vai te ajudar com isso.\n\n📋 Protocolo criado: #${ticketProtocol}`
          : `Entendi sua dúvida. Estou transferindo você para um especialista humano que poderá te ajudar melhor.`;
        
        // Salvar mensagem de handoff no banco
        const { data: handoffMessageData } = await supabaseClient
          .from("messages")
          .insert({
            conversation_id: conversationId,
            content: handoffMessage,
            sender_type: "user",
            is_ai_generated: true,
            channel: responseChannel,
          })
          .select('id')
          .single();
        
        // Atualizar last_message_at
        await supabaseClient
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversationId);
        
        // Se for WhatsApp, enviar via Evolution API
        if (responseChannel === 'whatsapp' && handoffMessageData) {
          const { data: whatsappInstance } = await supabaseClient
            .from('whatsapp_instances')
            .select('*')
            .eq('status', 'connected')
            .limit(1)
            .maybeSingle();

          if (whatsappInstance) {
            const { error: whatsappError } = await supabaseClient.functions.invoke('send-whatsapp-message', {
              body: {
                instance_id: whatsappInstance.id,
                phone_number: contact.phone,
                whatsapp_id: contact.whatsapp_id,
                message: handoffMessage,
              },
            });

            if (!whatsappError) {
              await supabaseClient
                .from('messages')
                .update({ status: 'sent' })
                .eq('id', handoffMessageData.id);
            }
          }
        }
        
        // 🆕 RETORNAR AQUI - Não deixar o código continuar para retornar cache ruim
        return new Response(
          JSON.stringify({
            status: 'handoff_executed',
            message: handoffMessage,
            from_cache: false,
            handoff_reason: 'cached_fallback_detected',
            ticket_created: isFinancial,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // ❌ REMOVIDO: Não inserir mensagem do cliente aqui - já foi inserida por useSendMessageOffline/handle-whatsapp-event/inbound-email

      // Salvar resposta da IA (do cache)
      const { data: aiMessageData } = await supabaseClient
        .from("messages")
        .insert({
          conversation_id: conversationId,
          content: cachedResponse.answer,
          sender_type: "user",
          is_ai_generated: true,
          attachment_url: JSON.stringify(cachedResponse.context_ids || []),
          channel: responseChannel, // ✅ FASE 4: Adicionar canal
        })
        .select('id')
        .single();

      // Atualizar last_message_at
      await supabaseClient
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);

      // Se for WhatsApp, enviar mensagem via Evolution API
      if (responseChannel === 'whatsapp') {
        const { data: whatsappInstance } = await supabaseClient
          .from('whatsapp_instances')
          .select('*')
          .eq('status', 'connected')
          .limit(1)
          .maybeSingle();

        if (whatsappInstance && aiMessageData) {
          console.log('[ai-autopilot-chat] 📤 Enviando resposta cached via WhatsApp');

          const { error: whatsappError } = await supabaseClient.functions.invoke('send-whatsapp-message', {
            body: {
              instance_id: whatsappInstance.id,
              phone_number: contact.phone,
              whatsapp_id: contact.whatsapp_id,
              message: cachedResponse.answer,
            },
          });

          if (!whatsappError) {
            await supabaseClient
              .from('messages')
              .update({ status: 'sent' })
              .eq('id', aiMessageData.id);
          }
        }
      }

      return new Response(
        JSON.stringify({
          message: cachedResponse.answer,
          from_cache: true,
          used_articles: cachedResponse.context_ids || [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('⚠️ [CACHE MISS] Processando nova resposta...');
    
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

    // 2. Buscar persona baseado em routing rules (canal + departamento)
    const { data: routingRules, error: rulesError } = await supabaseClient
      .from('ai_routing_rules')
      .select(`
        *,
        ai_personas!inner(*)
      `)
      .eq('channel', responseChannel)
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

    // FASE 1 & 2: Classificar intenção com lógica invertida (skip vs search)
    console.log('[ai-autopilot-chat] Classificando intenção da mensagem...');
    
    let intentType = 'search'; // Default: sempre buscar
    let knowledgeArticles: any[] = [];
    
    try {
      const intentData = await callAIWithFallback({
        messages: [
          { 
            role: 'system', 
            content: `Classifique a mensagem:
- "skip" APENAS se for: saudação pura (oi, olá, bom dia), confirmação pura (ok, entendi, beleza), ou elogio/agradecimento puro (obrigado, valeu)
- "search" para QUALQUER outra coisa (perguntas, dúvidas, problemas, informações, etc.)

Se tiver QUALQUER indício de pergunta ou dúvida, responda "search".
Responda APENAS: skip ou search`
          },
          { role: 'user', content: customerMessage }
        ],
        temperature: 0.1,
        max_tokens: 10
      });

      intentType = intentData.choices?.[0]?.message?.content?.trim().toLowerCase() || 'search';
      console.log(`[ai-autopilot-chat] Intenção detectada: ${intentType}`);
    } catch (error) {
      console.error('[ai-autopilot-chat] Erro na classificação de intenção:', error);
      // Fallback: buscar na base em caso de erro
      intentType = 'search';
    }
    
    // FASE 1 & 3: Lógica invertida - buscar para tudo, exceto "skip"
    if (intentType === 'skip') {
      // Saudações/confirmações puras: pular busca na base, responder naturalmente
      console.log('[ai-autopilot-chat] ⚡ Skip detectado - pulando busca na base');
    } else {
      // QUALQUER outra coisa: buscar na base de conhecimento
      console.log('[ai-autopilot-chat] 🔍 Search - consultando base de conhecimento...');
      
      // FASE 1: Verificar se persona tem categorias específicas configuradas
      const personaCategories = persona.knowledge_base_paths || [];
      const hasPersonaCategories = personaCategories.length > 0;
      
      console.log('[ai-autopilot-chat] 📂 Persona categories:', {
        persona_id: persona.id,
        persona_name: persona.name,
        allowed_categories: hasPersonaCategories ? personaCategories : 'ALL (sem filtro)',
        category_filter_applied: hasPersonaCategories
      });
      
      try {
        // FASE 5: Query Expansion + Semantic Search Múltiplo
        if (OPENAI_API_KEY || LOVABLE_API_KEY) {
          console.log('[ai-autopilot-chat] 🚀 Iniciando Query Expansion...');
          
          // Step 1: Expandir query para múltiplas variações
          let expandedQueries: string[] = [customerMessage];
          
          try {
            const { data: expansionData, error: expansionError } = await supabaseClient.functions.invoke(
              'expand-query',
              { body: { query: customerMessage } }
            );

            if (!expansionError && expansionData?.expanded_queries) {
              expandedQueries = [customerMessage, ...expansionData.expanded_queries];
              console.log(`[ai-autopilot-chat] ✅ Query expandida em ${expandedQueries.length} variações`);
            } else {
              console.log('[ai-autopilot-chat] ⚠️ Usando apenas query original (expansion falhou)');
            }
          } catch (expansionError) {
            console.error('[ai-autopilot-chat] Erro no query expansion:', expansionError);
          }

          // Step 2: Buscar embeddings para todas as queries expandidas
          const articleMap: Map<string, any> = new Map();
          
          for (const query of expandedQueries) {
            if (!OPENAI_API_KEY) continue;
            
            try {
              console.log(`[ai-autopilot-chat] 🔍 Gerando embedding para: "${query.substring(0, 50)}..."`);
              
              const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${OPENAI_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'text-embedding-3-small',
                  input: query,
                }),
              });

              if (embeddingResponse.ok) {
                const embeddingData = await embeddingResponse.json();
                const queryEmbedding = embeddingData.data[0].embedding;
                
                // Buscar artigos similares
                const { data: semanticResults, error: semanticError } = await supabaseClient.rpc(
                  'match_knowledge_articles',
                  {
                    query_embedding: queryEmbedding,
                    match_threshold: 0.75,
                    match_count: 5,
                  }
                );

                if (!semanticError && semanticResults) {
                  // Adicionar ao mapa para deduplicar (mantém melhor similaridade)
                  semanticResults.forEach((article: any) => {
                    const existing = articleMap.get(article.id);
                    if (!existing || article.similarity > existing.similarity) {
                      articleMap.set(article.id, article);
                    }
                  });
                }
              }
            } catch (error) {
              console.error(`[ai-autopilot-chat] ❌ Erro no embedding para query: "${query}"`, error);
            }
          }

          // Step 3: Converter mapa para array e aplicar filtros
          let allArticles = Array.from(articleMap.values());
          console.log(`[ai-autopilot-chat] 📊 Total de artigos únicos encontrados: ${allArticles.length}`);

          // Filtrar por categoria se persona tiver configurado
          if (hasPersonaCategories) {
            allArticles = allArticles.filter((a: any) => 
              personaCategories.includes(a.category)
            );
            console.log(`[ai-autopilot-chat] 🔒 Filtro de categoria: ${articleMap.size} → ${allArticles.length} artigos`);
          }

          if (allArticles.length > 0) {
            // Ordenar por similaridade e pegar top 5
            knowledgeArticles = allArticles
              .sort((a: any, b: any) => b.similarity - a.similarity)
              .slice(0, 5)
              .map((a: any) => ({
                id: a.id,
                title: a.title,
                content: a.content,
                category: a.category,
              }));
            
            console.log(`[ai-autopilot-chat] ✅ Query Expansion + Semantic: ${knowledgeArticles.length} artigos finais:`, 
              allArticles.slice(0, 5).map((a: any) => `${a.title} [${a.category}] (${(a.similarity * 100).toFixed(1)}%)`));
          } else {
            console.log('[ai-autopilot-chat] ⚠️ Nenhum artigo relevante após filtros');
          }
        } else {
          throw new Error('Nenhuma API key disponível para embeddings');
        }
      } catch (embeddingError) {
        // FALLBACK: Busca por palavras-chave (método antigo)
        console.log('[ai-autopilot-chat] ⚠️ Fallback para busca por palavras-chave');
        
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
            
            let query = supabaseClient
              .from('knowledge_articles')
              .select('id, title, content, category')
              .eq('is_published', true)
              .or(orConditions);
            
            if (hasPersonaCategories) {
              query = query.in('category', personaCategories);
            }
            
            const { data: relevantArticles } = await query.limit(5);

            if (relevantArticles && relevantArticles.length > 0) {
              knowledgeArticles = relevantArticles;
              console.log(`[ai-autopilot-chat] ✅ Busca por Palavras-Chave: ${relevantArticles.length} artigos encontrados`);
            }
          }
        } catch (keywordError) {
          console.error('[ai-autopilot-chat] Erro na busca por palavras-chave:', keywordError);
        }
      }
    }

    // 5. FASE 1: Identity Wall - Verificar se contato tem email
    const contactEmail = customer_context?.email || contact.email;
    const contactHasEmail = !!contactEmail;
    const contactName = customer_context?.name || `${contact.first_name} ${contact.last_name}`.trim();
    const contactCompany = contact.company ? ` da empresa ${contact.company}` : '';
    const contactStatus = contact.status || 'lead';
    
    console.log('[ai-autopilot-chat] 🔐 Identity Wall Check:', {
      hasEmail: contactHasEmail,
      email: contactEmail,
      channel: responseChannel,
      isKnownCustomer: contactHasEmail
    });
    
    let knowledgeContext = '';
    if (knowledgeArticles.length > 0) {
      knowledgeContext = `\n\n**📚 BASE DE CONHECIMENTO:**\n${knowledgeArticles.map(a => 
        `**${a.title}**\n${a.content}`
      ).join('\n\n---\n\n')}`;
    }
    
    // FASE 3 & 4: Identity Wall + Diferenciação Cliente vs Lead
    let identityWallNote = '';
    
    // Detectar se é a primeira mensagem pós-verificação (FASE 3)
    const isRecentlyVerified = customer_context?.isVerified === true;
    
    if (contactHasEmail && responseChannel === 'whatsapp') {
      // FASE 4: Cliente conhecido (tem email) - dar boas-vindas
      identityWallNote = `\n\n**✅ CLIENTE CONHECIDO:**
Este cliente JÁ está verificado no sistema.
Nome: ${contactName}${contactCompany}
Email: ${contactEmail}
Status: ${contactStatus}

**IMPORTANTE:** NÃO peça email novamente! Dê boas vindas de forma calorosa reconhecendo que ele já é cliente.
Exemplo: "Olá ${contactName}! Que bom ter você de volta! Como posso ajudar hoje?"

${isRecentlyVerified ? '**⚠️ CLIENTE RECÉM-VERIFICADO:** Esta é a primeira mensagem pós-verificação. Não fazer handoff automático. Ofereça ajuda e pergunte "Como posso te ajudar?".' : ''}`;
      
    } else if (!contactHasEmail && responseChannel === 'whatsapp') {
      // FASE 4: Lead (não tem email) - seguir Identity Wall e direcionar para comercial após verificação
      identityWallNote = `\n\n**🚨 LEAD NOVO - Identity Wall OBRIGATÓRIO:**
Este cliente NÃO tem email cadastrado no sistema (é um LEAD, não um cliente existente).

**FLUXO OBRIGATÓRIO DE IDENTIFICAÇÃO:**
1. PRIMEIRA MENSAGEM: Cumprimente "${contactName}" e solicite o email de forma educada e direta:
   "Olá ${contactName}! Para garantir um atendimento personalizado e seguro, preciso que você me informe seu email."
   
2. AGUARDE o cliente fornecer o email

3. QUANDO cliente fornecer email: Use a ferramenta update_customer_email para registrar e enviar código de verificação

4. APÓS enviar código: Informe ao cliente:
   "📧 Perfeito! Enviamos um código de 6 dígitos para [email]. Por favor, digite o código que você recebeu."

5. AGUARDE o cliente enviar o código de 6 dígitos

6. QUANDO cliente enviar código: Use a ferramenta verify_otp_code para validar

7. APÓS verificação bem-sucedida: Informe que ele será direcionado para o time comercial:
   "✅ Identidade verificada! Vou te conectar com nosso time de vendas para te ajudar da melhor forma. Um consultor vai entrar em contato em breve!"
   E então faça handoff para copilot e chame route-conversation.

**IMPORTANTE:** NÃO atenda dúvidas técnicas, NÃO crie tickets, NÃO responda perguntas até o email estar verificado.
Se o cliente insistir em pular a verificação, explique que é uma política de segurança obrigatória.`;
    } else if (customer_context?.isVerified || contactHasEmail) {
      identityWallNote = `\n\n**IMPORTANTE:** Este é um cliente já verificado. Cumprimente-o pelo nome (${contactName}) de forma calorosa. NÃO peça email ou validação.

${isRecentlyVerified ? '**⚠️ CLIENTE RECÉM-VERIFICADO:** Esta é a primeira mensagem pós-verificação. Não fazer handoff automático. Seja acolhedor e pergunte "Como posso te ajudar?".' : ''}`;
    }
    
    const contextualizedSystemPrompt = `Você é o assistente virtual da empresa.

**REGRAS CRÍTICAS DE RESPOSTA:**

1. **Solicitações Financeiras (PRIORIDADE MÁXIMA):**
   - Se o cliente perguntar sobre: saque, saldo, pix, pagamento, comissão, carteira, transferência
   - USE IMEDIATAMENTE a ferramenta \`create_ticket\` com issue_type='financeiro'
   - Colete informações necessárias e crie o ticket
   - NÃO diga apenas "vou chamar um especialista" - CRIE O TICKET

2. **Devolução/Reembolso/Troca/Defeito:**
   - Colete o número do pedido (se houver)
   - Use \`create_ticket\` com o tipo apropriado

3. **Dúvidas Técnicas:**
   - Use o contexto da base de conhecimento para responder

4. **Small Talk (Saudações/Elogios):**
   - Se o usuário disser "Oi", "Bom dia", "Obrigado" ou fizer elogios, responda de forma educada e breve usando seu conhecimento geral

5. **Se não souber responder:**
   - Diga "Vou transferir para um especialista" (o sistema executará handoff automaticamente)
${knowledgeContext}${identityWallNote}

**Contexto do Cliente:**
- Nome: ${contactName}${contactCompany}
- Status: ${contactStatus}
- Canal: ${responseChannel}
${customer_context?.email || contact.email ? `- Email: ${customer_context?.email || contact.email}` : '- Email: NÃO CADASTRADO - SOLICITAR'}
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
          description: 'Cria um ticket de suporte para qualquer solicitação que precisa de acompanhamento humano: financeiro (saque, saldo, pagamento, pix, comissão), devolução, troca, reembolso, defeito ou outro.',
          parameters: {
            type: 'object',
            properties: {
              issue_type: { 
                type: 'string', 
                enum: ['financeiro', 'devolucao', 'reembolso', 'troca', 'defeito', 'outro'],
                description: 'O tipo de solicitação. Use "financeiro" para saque, saldo, pagamentos, pix, comissão.' 
              },
              subject: { 
                type: 'string', 
                description: 'Resumo breve da solicitação (máximo 100 caracteres).' 
              },
              description: { 
                type: 'string', 
                description: 'Descrição detalhada do problema ou solicitação.' 
              },
              order_id: { 
                type: 'string', 
                description: 'O número do pedido, se aplicável. Deixe vazio se não houver pedido.' 
              }
            },
            required: ['issue_type', 'subject', 'description']
          }
        }
      },
      // FASE 2: Email Capture Tool (envia OTP automaticamente)
      {
        type: 'function',
        function: {
          name: 'update_customer_email',
          description: 'Registra o email do cliente e envia código de verificação OTP automaticamente.',
          parameters: {
            type: 'object',
            properties: {
              email: { type: 'string', description: 'O email fornecido pelo cliente.' }
            },
            required: ['email']
          }
        }
      },
      // FASE 2: OTP Verification Tool
      {
        type: 'function',
        function: {
          name: 'verify_otp_code',
          description: 'Verifica o código de 6 dígitos enviado por email ao cliente.',
          parameters: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'O código de 6 dígitos fornecido pelo cliente.' }
            },
            required: ['code']
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

    // ============================================================
    // FASE 3: TOOL CALLING - Execute first to prevent duplicates
    // ============================================================
    // Handle tool calls (Function Calling)
    let ticketCreatedSuccessfully = false; // 🔒 Flag: true apenas se ticket foi criado COM SUCESSO
    
    if (toolCalls.length > 0) {
      console.log('[ai-autopilot-chat] 🛠️ AI solicitou execução de ferramenta:', toolCalls);
      
      for (const toolCall of toolCalls) {
        // FASE 2: Handle email update and send OTP
        if (toolCall.function.name === 'update_customer_email') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            console.log('[ai-autopilot-chat] 📧 Capturando email e enviando OTP:', args.email);

            // Validar formato do email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(args.email)) {
              console.error('[ai-autopilot-chat] ❌ Email inválido:', args.email);
              assistantMessage = 'O email informado parece estar incorreto. Poderia verificar e me enviar novamente?';
              continue;
            }

            // Update contact email (temporarily)
            const { error: updateError } = await supabaseClient
              .from('contacts')
              .update({ email: args.email })
              .eq('id', contact.id);

            if (updateError) {
              console.error('[ai-autopilot-chat] ❌ Erro ao atualizar email:', updateError);
              assistantMessage = 'Não consegui registrar o email. Por favor, tente novamente.';
              continue;
            }

            // Send OTP code via Edge Function
            const { data: otpData, error: otpError } = await supabaseClient.functions.invoke('send-verification-code', {
              body: { email: args.email }
            });

            if (otpError || !otpData?.success) {
              console.error('[ai-autopilot-chat] ❌ Erro ao enviar OTP:', otpError);
              assistantMessage = 'Não consegui enviar o código de verificação. Por favor, verifique o email e tente novamente.';
              continue;
            }

            console.log('[ai-autopilot-chat] ✅ Email registrado e OTP enviado');
            
            // Dev mode: include code in message
            if (otpData.dev_mode && otpData.code) {
              assistantMessage = `📧 Perfeito! Enviamos um código de 6 dígitos para ${args.email}.\n\n🔧 **Modo Desenvolvimento:** Seu código é ${otpData.code}\n\nPor favor, digite o código para confirmar sua identidade.`;
            } else {
              assistantMessage = `📧 Perfeito! Enviamos um código de 6 dígitos para ${args.email}. Por favor, digite o código que você recebeu para confirmar sua identidade.`;
            }
            
            // Log interaction
            await supabaseClient.from('interactions').insert({
              customer_id: contact.id,
              type: 'note',
              content: `Email capturado via WhatsApp Identity Wall: ${args.email} - OTP enviado`,
              channel: 'whatsapp',
              metadata: { source: 'ai_autopilot_identity_wall', otp_sent: true }
            });
          } catch (error) {
            console.error('[ai-autopilot-chat] ❌ Erro ao processar email:', error);
            assistantMessage = 'Ocorreu um erro. Poderia me enviar o email novamente?';
          }
        } 
        // FASE 2: Handle OTP verification
        else if (toolCall.function.name === 'verify_otp_code') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            console.log('[ai-autopilot-chat] 🔐 Verificando código OTP:', args.code);

            // Buscar email do contato
            const contactEmail = contact.email;
            if (!contactEmail) {
              assistantMessage = 'Por favor, primeiro me informe seu email.';
              continue;
            }

            // Buscar código mais recente não expirado
            const { data: verification, error: verifyError } = await supabaseClient
              .from('email_verifications')
              .select('*')
              .eq('email', contactEmail)
              .eq('code', args.code)
              .eq('verified', false)
              .gte('expires_at', new Date().toISOString())
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (verifyError || !verification) {
              console.error('[ai-autopilot-chat] ❌ Código inválido ou expirado');
              
              // Incrementar tentativas
              if (verification) {
                await supabaseClient
                  .from('email_verifications')
                  .update({ attempts: verification.attempts + 1 })
                  .eq('id', verification.id);
              }
              
              assistantMessage = '❌ Código inválido ou expirado. Por favor, verifique o código ou solicite um novo informando seu email novamente.';
              continue;
            }

            // Marcar como verificado
            await supabaseClient
              .from('email_verifications')
              .update({ verified: true })
              .eq('id', verification.id);

            console.log('[ai-autopilot-chat] ✅ OTP verificado com sucesso');
            
            assistantMessage = `✅ Identidade verificada com sucesso! Seja bem-vindo de volta, ${contactName}! Agora posso te ajudar com o que precisar. 😊`;
            
            // Log interaction
            await supabaseClient.from('interactions').insert({
              customer_id: contact.id,
              type: 'note',
              content: `Identidade verificada via OTP WhatsApp - Email: ${contactEmail}`,
              channel: 'whatsapp',
              metadata: { source: 'ai_autopilot_identity_wall', otp_verified: true }
            });
          } catch (error) {
            console.error('[ai-autopilot-chat] ❌ Erro ao verificar OTP:', error);
            assistantMessage = 'Ocorreu um erro ao verificar o código. Por favor, tente novamente.';
          }
        } 
        else if (toolCall.function.name === 'create_ticket') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            console.log('[ai-autopilot-chat] 🎫 Criando ticket automaticamente:', args);

            // 🔐 SECURITY NOTE: Rate limiting is handled at conversation level (AI autopilot only runs for authenticated conversations)
            // Public ticket creation via forms should implement rate limiting separately

            // Create ticket in database
            const ticketCategory = args.issue_type === 'defeito' ? 'tecnico' : 
                                   args.issue_type === 'financeiro' ? 'financeiro' : 
                                   'financeiro';
            
            const ticketSubject = args.subject || 
                                  (args.order_id ? `${args.issue_type.toUpperCase()} - Pedido ${args.order_id}` : 
                                   `${args.issue_type.toUpperCase()} - ${args.description.substring(0, 50)}`);

            const { data: ticket, error: ticketError } = await supabaseClient
              .from('tickets')
              .insert({
                customer_id: contact.id,
                subject: ticketSubject,
                description: args.description,
                priority: args.issue_type === 'financeiro' ? 'high' : 'medium',
                status: 'open',
                source_conversation_id: conversationId,
                category: ticketCategory,
                internal_note: `Ticket criado automaticamente pela IA${args.order_id ? `. Pedido: ${args.order_id}` : ''}`
              })
              .select()
              .single();

            if (ticketError) {
              console.error('[ai-autopilot-chat] ❌ Erro ao criar ticket (ignorando):', ticketError);
              // ⚠️ NÃO sobrescrever assistantMessage aqui
              // Deixar que o detector de fallback (linhas 886-979) lide com o handoff
              // se a resposta da IA for uma frase de fallback
            } else {
              console.log('[ai-autopilot-chat] ✅ Ticket criado com sucesso:', ticket.id);
              
              ticketCreatedSuccessfully = true; // 🔒 Marcar sucesso (previne duplicação no fallback)
              
              // Link conversation to ticket
              await supabaseClient
                .from('conversations')
                .update({ related_ticket_id: ticket.id })
                .eq('id', conversationId);

              // 🎯 SEMPRE complementar (nunca sobrescrever) para preservar fallback detection
              const ticketIcon = args.issue_type === 'financeiro' ? '💰' : '📦';
              const ticketConfirmation = `\n\n✅ **Protocolo registrado com sucesso!**\n\n📋 **Número do Ticket:** #${ticket.id.slice(0, 8).toUpperCase()}\n${args.order_id ? `🔢 **Pedido:** ${args.order_id}\n` : ''}${ticketIcon} **Tipo:** ${args.issue_type.charAt(0).toUpperCase() + args.issue_type.slice(1)}\n\nNossa equipe vai analisar seu caso e retornar em breve.`;
              
              assistantMessage = assistantMessage + ticketConfirmation;
            }
          } catch (error) {
            console.error('[ai-autopilot-chat] ❌ Erro ao processar tool call (ignorando):', error);
            // ⚠️ NÃO sobrescrever assistantMessage aqui
            // Deixar que o detector de fallback lide com o handoff se necessário
          }
        }
      }
    }

    // ============================================================
    // FASE 4: FALLBACK DETECTOR - After tool calls to prevent duplicates
    // ============================================================
    const fallbackPhrases = [
      'vou chamar um especialista',
      'vou transferir para um atendente',
      'transferir para um atendente',
      'encaminhar para um humano',
      'não tenho essa informação',
      'não encontrei essa informação',
      'não consegui encontrar',
      'momento por favor',
      'chamar um atendente'
    ];

    const isFallbackResponse = fallbackPhrases.some(phrase => 
      assistantMessage.toLowerCase().includes(phrase)
    );

    if (isFallbackResponse) {
      console.log('[ai-autopilot-chat] 🚨 FALLBACK DETECTADO - Executando handoff REAL');
      
      // 1. MUDAR O MODO (Desligar IA)
      await supabaseClient
        .from('conversations')
        .update({ ai_mode: 'copilot' })
        .eq('id', conversationId);
      
      console.log('[ai-autopilot-chat] ✅ ai_mode mudado para copilot');
      
      // 2. CHAMAR O ROTEADOR (Buscar agente disponível)
      const { data: routeResult, error: routeError } = await supabaseClient.functions.invoke('route-conversation', {
        body: { conversationId }
      });
      
      if (routeError) {
        console.error('[ai-autopilot-chat] ❌ Erro ao rotear conversa:', routeError);
      } else {
        console.log('[ai-autopilot-chat] ✅ Conversa roteada:', routeResult);
      }
      
      // 3. CRIAR TICKET AUTOMÁTICO PARA CASOS FINANCEIROS (apenas se não criado por tool call)
      const financialKeywords = ['saque', 'saldo', 'pix', 'dinheiro', 'pagamento', 'comissão', 'carteira', 'transferir', 'transferência'];
      const isFinancialRequest = financialKeywords.some(keyword => 
        customerMessage.toLowerCase().includes(keyword)
      );
      
      // 🔒 Só criar ticket automático se não foi criado COM SUCESSO pelo tool call
      // Se o tool call falhou, permitir que o fallback detector crie como backup
      if (isFinancialRequest && !ticketCreatedSuccessfully) {
        console.log('[ai-autopilot-chat] 💰 Solicitação financeira detectada - Criando ticket de segurança');
        
        const { data: ticket, error: ticketError } = await supabaseClient
          .from('tickets')
          .insert({
            customer_id: contact.id,
            subject: `💰 Solicitação Financeira - ${customerMessage.substring(0, 50)}...`,
            description: `**Mensagem Original:**\n${customerMessage}\n\n**Motivo do Ticket:**\nCriado automaticamente por handoff de IA - solicitação financeira detectada.`,
            priority: 'high',
            status: 'open',
            category: 'financeiro',
            source_conversation_id: conversationId,
            internal_note: '🤖 Ticket criado automaticamente pela IA - Assunto financeiro requer atenção humana'
          })
          .select()
          .single();
        
        if (ticketError) {
          console.error('[ai-autopilot-chat] ❌ Erro ao criar ticket financeiro:', ticketError);
        } else {
          console.log('[ai-autopilot-chat] ✅ Ticket financeiro criado:', ticket?.id);
          
          // Vincular ticket à conversa
          await supabaseClient
            .from('conversations')
            .update({ related_ticket_id: ticket?.id })
            .eq('id', conversationId);
          
          // 🔒 Só enriquecer se mensagem NÃO contém protocolo já (previne duplicação quando tool call criou antes)
          if (!assistantMessage.toLowerCase().includes('protocolo')) {
            assistantMessage = `${assistantMessage}\n\n📋 Criei o protocolo #${ticket?.id?.slice(0, 8).toUpperCase()} para sua solicitação financeira. Um especialista vai analisar seu caso com prioridade.`;
          }
          
          ticketCreatedSuccessfully = true; // 🔒 Atualizar flag DEPOIS de enriquecer
        }
      }
      
      // 4. REGISTRAR NOTA INTERNA (Auditoria)
      await supabaseClient.from('interactions').insert({
        customer_id: contact.id,
        type: 'internal_note',
        content: `🤖→👤 **Handoff Automático Executado**\n\n**Pergunta do Cliente:** "${customerMessage}"\n**Motivo:** IA não encontrou resposta adequada na base de conhecimento.\n**Ação:** Conversa transferida para atendimento humano.${isFinancialRequest ? '\n**Ticket Financeiro:** Criado automaticamente' : ''}`,
        channel: responseChannel,
        metadata: {
          source: 'ai_autopilot_handoff',
          fallback_phrase_detected: true,
          is_financial: isFinancialRequest,
          original_message: customerMessage
        }
      });
      
      console.log('[ai-autopilot-chat] ✅ Nota interna de handoff registrada');
    }
    // ========== FIM DETECTOR DE FALLBACK ==========

    // FASE 5: Deduplicação - Verificar se mensagem similar foi enviada recentemente
    const { data: recentMessages } = await supabaseClient
      .from('messages')
      .select('content, created_at')
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'user')
      .eq('is_ai_generated', true)
      .gte('created_at', new Date(Date.now() - 10000).toISOString()) // Últimos 10 segundos
      .order('created_at', { ascending: false })
      .limit(3);

    const isDuplicate = recentMessages?.some(msg => 
      msg.content === assistantMessage && 
      (Date.now() - new Date(msg.created_at).getTime()) < 5000 // Menos de 5 segundos
    );

    if (isDuplicate) {
      console.warn('[ai-autopilot-chat] ⚠️ Mensagem duplicada detectada - ignorando envio');
      return new Response(JSON.stringify({ 
        status: 'duplicate',
        message: 'Mensagem duplicada ignorada'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 7. Salvar resposta da IA como mensagem (PRIMEIRO salvar para visibilidade interna)
    const { data: savedMessage, error: saveError } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: assistantMessage,
        sender_type: 'user', // 'user' = sistema/agente interno
        message_type: 'ai_response',
        is_ai_generated: true,
        sender_id: null,
        status: 'sending', // CRITICAL: Start with 'sending' status
        channel: responseChannel, // ✅ FASE 4: Adicionar canal
        attachment_url: JSON.stringify({
          persona_id: persona.id,
          persona_name: persona.name,
          used_articles: knowledgeArticles.map(a => ({
            id: a.id,
            title: a.title,
            category: a.category
          }))
        })
      })
      .select()
      .single();

    if (saveError) {
      console.error('[ai-autopilot-chat] Erro ao salvar mensagem:', saveError);
    }

    const messageId = savedMessage?.id;

    // FASE 3: Se Email, enviar resposta via send-email
    if (responseChannel === 'email' && contact.email && messageId) {
      console.log('[ai-autopilot-chat] 📧 Enviando resposta por email:', {
        contactEmail: contact.email,
        messageId
      });

      try {
        const { data: emailResult, error: emailError } = await supabaseClient.functions.invoke('send-email', {
          body: {
            to: contact.email,
            to_name: `${contact.first_name} ${contact.last_name}`.trim(),
            subject: `Re: ${conversation.subject || 'Seu Armazém Drop - Resposta do Suporte'}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563EB;">Olá, ${contact.first_name}!</h2>
                <div style="margin: 20px 0; line-height: 1.6;">
                  ${assistantMessage.replace(/\n/g, '<br>')}
                </div>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
                <p style="color: #6b7280; font-size: 12px;">
                  Esta é uma resposta automática do nosso assistente inteligente.<br>
                  Se precisar de mais ajuda, basta responder este email.
                </p>
              </div>
            `,
            customer_id: contact.id
          }
        });

        if (emailError) {
          console.error('[ai-autopilot-chat] ❌ Erro ao enviar email:', emailError);
          // Atualizar status para failed
          await supabaseClient
            .from('messages')
            .update({ 
              status: 'failed',
              delivery_error: emailError.message || 'Failed to send email'
            })
            .eq('id', messageId);
        } else {
          console.log('[ai-autopilot-chat] ✅ Email enviado com sucesso');
          // Atualizar status para delivered
          await supabaseClient
            .from('messages')
            .update({ status: 'delivered' })
            .eq('id', messageId);
        }
      } catch (emailError) {
        console.error('[ai-autopilot-chat] ❌ Exception ao enviar email:', emailError);
        await supabaseClient
          .from('messages')
          .update({ 
            status: 'failed',
            delivery_error: emailError instanceof Error ? emailError.message : 'Unknown error'
          })
          .eq('id', messageId);
      }
    }
    
    // 8. Se WhatsApp, enviar via Evolution API e atualizar status
    else if (responseChannel === 'whatsapp' && contact.phone && messageId) {
      console.log('[ai-autopilot-chat] 📱 Tentando enviar WhatsApp:', {
        contactPhone: contact.phone,
        contactWhatsappId: contact.whatsapp_id,
        messageId,
        conversationWhatsappInstanceId: conversation.whatsapp_instance_id
      });

      try {
        // FASE 1: Priorizar instância vinculada à conversa
        let whatsappInstance = null;
        
        // 1. Primeiro: tentar usar instância vinculada à conversa
        if (conversation.whatsapp_instance_id) {
          console.log('[ai-autopilot-chat] 🔗 Tentando instância vinculada:', conversation.whatsapp_instance_id);
          const { data } = await supabaseClient
            .from('whatsapp_instances')
            .select('*')
            .eq('id', conversation.whatsapp_instance_id)
            .single();
          
          whatsappInstance = data;
          
          if (whatsappInstance) {
            console.log('[ai-autopilot-chat] ✅ Usando instância vinculada:', {
              instanceId: whatsappInstance.id,
              instanceName: whatsappInstance.instance_name,
              status: whatsappInstance.status
            });
          }
        }
        
        // 2. Fallback: buscar qualquer instância conectada
        if (!whatsappInstance) {
          console.log('[ai-autopilot-chat] 🔄 Fallback: buscando instância conectada...');
          const { data } = await supabaseClient
            .from('whatsapp_instances')
            .select('*')
            .eq('status', 'connected')
            .limit(1)
            .single();
          
          whatsappInstance = data;
          
          if (whatsappInstance) {
            console.log('[ai-autopilot-chat] ✅ Instância conectada encontrada:', {
              instanceId: whatsappInstance.id,
              instanceName: whatsappInstance.instance_name
            });
          }
        }
        
        // FASE 2: Validar status da instância
        if (!whatsappInstance) {
          console.error('[ai-autopilot-chat] ⚠️ NENHUMA instância WhatsApp disponível');
          
          // Salvar mensagem como 'failed' com motivo
          await supabaseClient
            .from('messages')
            .update({ 
              status: 'failed',
              delivery_error: 'Nenhuma instância WhatsApp conectada disponível'
            })
            .eq('id', messageId);
          
          throw new Error('Nenhuma instância WhatsApp disponível');
        }
        
        // Log de aviso se instância não está conectada
        if (whatsappInstance.status !== 'connected') {
          console.warn('[ai-autopilot-chat] ⚠️ Tentando enviar com instância não-conectada:', whatsappInstance.status);
        }

        // FASE 4: Enviar mensagem via Evolution API
        console.log('[ai-autopilot-chat] 📤 Invocando send-whatsapp-message:', {
          instanceId: whatsappInstance.id,
          instanceStatus: whatsappInstance.status,
          phoneNumber: contact.phone,
          whatsappId: contact.whatsapp_id
        });

        const { data: whatsappResponse, error: whatsappError } = await supabaseClient.functions.invoke('send-whatsapp-message', {
          body: {
            instance_id: whatsappInstance.id,
            phone_number: contact.phone,
            whatsapp_id: contact.whatsapp_id,
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

        console.log('[ai-autopilot-chat] ✅ Saldo OK - Resposta Gerada via Evolution API');
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

    // 9. Registrar uso de IA nos logs (não-bloqueante)
    try {
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
      console.log('📊 [USAGE LOG] Uso da IA registrado com sucesso');
    } catch (logError) {
      console.error('⚠️ [USAGE LOG ERROR] Erro ao registrar uso (não bloqueante):', logError);
      // Não bloqueia a resposta ao cliente se o log falhar
    }

    console.log('[ai-autopilot-chat] ✅ Resposta processada com sucesso!');

    // FASE 2: Salvar resposta no cache para futuras consultas (TTL 24h)
    // 🆕 Verificar se NÃO é fallback antes de cachear
    const cacheSkipFallbackPhrases = [
      'vou chamar um especialista',
      'transferir para um atendente',
      'encaminhar para um humano',
      'não tenho essa informação',
      'não consegui registrar'
    ];
    
    const shouldSkipCache = cacheSkipFallbackPhrases.some(phrase => 
      assistantMessage.toLowerCase().includes(phrase)
    );
    
    if (shouldSkipCache) {
      console.log('⚠️ [CACHE SKIP] Resposta de fallback detectada - NÃO cacheando');
    } else {
      try {
        await supabaseClient.from('ai_response_cache').insert({
          question_hash: questionHash,
          answer: assistantMessage,
          context_ids: knowledgeArticles.map(a => ({
            id: a.id,
            title: a.title,
            category: a.category
          })),
        });
        console.log('💾 [CACHE SAVED] Resposta salva no cache para reutilização');
      } catch (cacheError) {
        console.error('⚠️ [CACHE ERROR] Erro ao salvar no cache (não bloqueante):', cacheError);
        // Não bloqueia a resposta se falhar o cache
      }
    }

    return new Response(JSON.stringify({ 
      status: 'success',
      message: assistantMessage,
      from_cache: false,
      persona_used: {
        id: persona.id,
        name: persona.name
      },
      used_articles: knowledgeArticles.map(a => ({
        id: a.id,
        title: a.title,
        category: a.category
      })),
      tool_calls: toolCalls,
      debug: {
        intent: intentType,
        persona_categories: persona.knowledge_base_paths || 'ALL',
        filtered_by_category: (persona.knowledge_base_paths || []).length > 0,
        articles_found: knowledgeArticles.map((a: any) => `${a.title} [${a.category || 'sem categoria'}]`),
        search_performed: knowledgeArticles.length > 0
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
