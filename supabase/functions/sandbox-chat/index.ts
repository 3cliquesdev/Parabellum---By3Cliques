import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Valid OpenAI models
const VALID_OPENAI_MODELS = new Set([
  'gpt-4o', 'gpt-4o-mini',
  'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
  'gpt-5', 'gpt-5-mini', 'gpt-5-nano',
  'o3', 'o3-mini', 'o4-mini',
]);

const REASONING_MODELS = new Set(['o3', 'o3-mini', 'o4-mini']);

// Helper: Buscar modelo AI configurado no banco
async function getConfiguredAIModel(supabase: any): Promise<string> {
  try {
    const { data } = await supabase
      .from('system_configurations')
      .select('value')
      .eq('key', 'ai_default_model')
      .maybeSingle();
    
    const model = data?.value || 'gpt-4o-mini';
    if (VALID_OPENAI_MODELS.has(model)) return model;
    // Legacy gateway names → fallback
    if (model.startsWith('openai/') || model.startsWith('google/')) {
      return 'gpt-4o-mini';
    }
    return model;
  } catch (error) {
    console.error('[sandbox-chat] Error fetching AI model config:', error);
    return 'gpt-4o-mini';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { messages, personaId, useKnowledgeBase = false, aiProvider = 'lovable', customerContext } = await req.json();
    
    console.log('[sandbox-chat] Processing request for persona:', personaId);
    console.log('[sandbox-chat] Knowledge Base:', useKnowledgeBase, '| Provider:', aiProvider);
    console.log('[sandbox-chat] Customer Context:', customerContext ? `${customerContext.first_name} (${customerContext.status})` : 'None');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    // LOVABLE_API_KEY removida - usando OpenAI diretamente
    
    // Buscar modelo configurado dinamicamente
    const configuredModel = await getConfiguredAIModel(supabase);
    console.log(`[sandbox-chat] Configured AI model: ${configuredModel}`);

    // Fetch persona details
    const { data: persona, error: personaError } = await supabase
      .from('ai_personas')
      .select(`
        *,
        ai_persona_tools (
          ai_tools (
            id,
            name,
            description,
            function_schema,
            is_enabled
          )
        )
      `)
      .eq('id', personaId)
      .single();

    if (personaError || !persona) {
      console.error('[sandbox-chat] Error fetching persona:', personaError);
      return new Response(
        JSON.stringify({ error: 'Persona not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[sandbox-chat] Persona loaded:', persona.name);

    // 🎓 Buscar exemplos de treinamento (Few-Shot Learning) - Tabela dedicada
    const { data: trainingExamples } = await supabase
      .from('ai_training_examples')
      .select('*')
      .eq('persona_id', personaId)
      .eq('is_active', true)
      .limit(10);

    console.log('[sandbox-chat] Training examples (ai_training_examples):', trainingExamples?.length || 0);

    // 🎓 TAMBÉM buscar artigos de treinamento do Sandbox (salvos em knowledge_articles)
    const { data: rawSandboxArticles } = await supabase
      .from('knowledge_articles')
      .select('id, title, content')
      .eq('source', 'sandbox_training')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(50); // Buscar mais para deduplicar

    // 🔄 Deduplicar artigos pelo título (manter apenas o mais recente)
    const seenTitles = new Set<string>();
    const sandboxTrainingArticles = rawSandboxArticles?.filter((article: any) => {
      const normalizedTitle = article.title.toLowerCase().trim();
      if (seenTitles.has(normalizedTitle)) {
        return false;
      }
      seenTitles.add(normalizedTitle);
      return true;
    }).slice(0, 10) || [];

    console.log('[sandbox-chat] Sandbox training articles (after dedup):', sandboxTrainingArticles?.length || 0, '(raw:', rawSandboxArticles?.length || 0, ')');

    // Build tools array from persona's linked tools
    const tools = persona.ai_persona_tools
      ?.filter((pt: any) => pt.ai_tools?.is_enabled)
      .map((pt: any) => ({
        type: "function",
        function: pt.ai_tools.function_schema
      })) || [];

    console.log('[sandbox-chat] Available tools:', tools.length);

    // Get last user message for processing
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()?.content || '';
    
    // FASE 2: Intent Classification
    let intentType = 'search';
    let handoffTriggered = false;
    let handoffReason = '';
    
    if (lastUserMessage) {
      try {
        console.log('[sandbox-chat] Classifying intent...');
        
        const intentPayload = {
          messages: [
            { 
              role: 'system', 
              content: `Classifique a mensagem:
- "skip" APENAS se for: saudação pura (oi, olá, bom dia), confirmação pura (ok, entendi, beleza), ou elogio/agradecimento puro (obrigado, valeu)
- "search" para QUALQUER outra coisa (perguntas, dúvidas, problemas, informações, etc.)

Se tiver QUALQUER indício de pergunta ou dúvida, responda "search".
Responda APENAS: skip ou search`
            },
            { role: 'user', content: lastUserMessage }
          ],
          temperature: 0.1,
          ...(['o3', 'o3-mini', 'o4-mini'].includes(configuredModel)
            ? { max_completion_tokens: 10 }
            : { max_tokens: 10 })
        };

        let intentResponse;
        if (OPENAI_API_KEY) {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model: configuredModel, ...intentPayload }),
          });
          intentResponse = await res.json();
        }

        intentType = intentResponse?.choices?.[0]?.message?.content?.trim().toLowerCase() || 'search';
        console.log('[sandbox-chat] Intent detected:', intentType);
      } catch (error) {
        console.error('[sandbox-chat] Intent classification failed:', error);
        intentType = 'search';
      }
      
      // FASE 3: Auto-Handoff Detection
      const handoffTriggers = [
        'falar com humano',
        'atendente',
        'falar com pessoa',
        'falar com alguém',
        'preciso de ajuda humana',
        'quero falar com',
      ];
      
      const normalizedMessage = lastUserMessage.toLowerCase();
      if (handoffTriggers.some(trigger => normalizedMessage.includes(trigger))) {
        handoffTriggered = true;
        handoffReason = 'customer_requested_human';
        console.log('[sandbox-chat] 🚨 Handoff trigger detected: customer requested human');
      }
    }

    // FASE 1: Query Expansion + Knowledge Base Search
    // Criar few-shot messages a partir de ai_training_examples
    const fewShotFromExamples = trainingExamples?.flatMap((example: any) => [
      { role: 'user', content: example.input_text },
      { role: 'assistant', content: example.ideal_output }
    ]) || [];

    // 🎓 Criar few-shot messages a partir de artigos de treinamento do Sandbox
    // O título contém a pergunta ("Treinamento: [pergunta]") e o content contém a resposta correta
    const fewShotFromSandbox = sandboxTrainingArticles?.flatMap((article: any) => {
      // Extrair pergunta do título: "Treinamento: [pergunta...]" → "[pergunta...]"
      const question = article.title.replace(/^Treinamento:\s*/i, '').substring(0, 200);
      return [
        { role: 'user', content: question },
        { role: 'assistant', content: article.content }
      ];
    }) || [];

    // Combinar ambas as fontes (limite de 10 pares no total)
    const fewShotMessages = [...fewShotFromSandbox, ...fewShotFromExamples].slice(0, 20);

    console.log('[sandbox-chat] Few-shot messages prepared:', fewShotMessages.length, '(sandbox:', fewShotFromSandbox.length / 2, 'pares + examples:', fewShotFromExamples.length / 2, 'pares)');

    // 🎓 Se temos exemplos de treinamento, adicionar instrução PRIORITÁRIA
    // Esta instrução deve sobrescrever qualquer outra regra do prompt
    const trainingInstruction = fewShotMessages.length > 0
      ? `## 🎯 REGRA ABSOLUTA (SOBRESCREVE TODAS AS OUTRAS):\nVocê foi TREINADO com exemplos específicos abaixo. Quando a pergunta do cliente for SIMILAR ou IDÊNTICA a um dos exemplos, você DEVE copiar a resposta do exemplo EXATAMENTE como está, sem modificar, sem pedir informações adicionais, sem seguir nenhuma outra regra deste prompt. Os exemplos de treinamento têm PRIORIDADE MÁXIMA sobre qualquer outra instrução.\n\n`
      : '';

    let knowledgeArticles: any[] = [];
    let systemPrompt = persona.system_prompt;
    let semanticSearchUsed = false;
    let queriesExecuted: string[] = [];

    if (useKnowledgeBase && intentType === 'search' && lastUserMessage) {
      console.log('[sandbox-chat] Knowledge base search enabled');
      
      const personaCategories = persona.knowledge_base_paths || [];
      const hasPersonaCategories = personaCategories.length > 0;
      
      console.log('[sandbox-chat] Persona categories:', {
        persona_id: persona.id,
        persona_name: persona.name,
        allowed_categories: hasPersonaCategories ? personaCategories : 'ALL',
        category_filter_applied: hasPersonaCategories
      });

      // Query Expansion
      let expandedQueries: string[] = [lastUserMessage];
      
      try {
        console.log('[sandbox-chat] 🚀 Query Expansion...');
        
        const { data: expansionData, error: expansionError } = await supabase.functions.invoke(
          'expand-query',
          { body: { query: lastUserMessage } }
        );

        if (!expansionError && expansionData?.expanded_queries) {
          expandedQueries = [lastUserMessage, ...expansionData.expanded_queries];
          queriesExecuted = expandedQueries;
          console.log('[sandbox-chat] ✅ Expanded to', expandedQueries.length, 'queries');
        } else {
          queriesExecuted = [lastUserMessage];
        }
      } catch (error) {
        console.error('[sandbox-chat] Query expansion failed:', error);
        queriesExecuted = [lastUserMessage];
      }

      // Multi-query semantic search with deduplication
      if (OPENAI_API_KEY) {
        try {
          console.log('[sandbox-chat] Semantic search for', expandedQueries.length, 'queries...');
          
          const articleMap: Map<string, any> = new Map();
          
          for (const query of expandedQueries) {
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
              
              const { data: semanticResults, error: semanticError } = await supabase.rpc(
                'match_knowledge_articles',
                {
                  query_embedding: queryEmbedding,
                  match_threshold: 0.50,
                  match_count: 5,
                }
              );

              if (!semanticError && semanticResults) {
                semanticResults.forEach((article: any) => {
                  const existing = articleMap.get(article.id);
                  if (!existing || article.similarity > existing.similarity) {
                    articleMap.set(article.id, article);
                  }
                });
              }
            }
          }
          
          let allArticles = Array.from(articleMap.values());
          
          if (hasPersonaCategories) {
            allArticles = allArticles.filter((a: any) => personaCategories.includes(a.category));
            console.log('[sandbox-chat] Category filter:', articleMap.size, '→', allArticles.length);
          }
          
          if (allArticles.length > 0) {
            knowledgeArticles = allArticles
              .sort((a: any, b: any) => b.similarity - a.similarity)
              .slice(0, 5)
              .map((a: any) => ({
                id: a.id,
                title: a.title,
                content: a.content,
                category: a.category,
                similarity: a.similarity,
              }));
            
            semanticSearchUsed = true;
            console.log('[sandbox-chat] ✅ Semantic search:', knowledgeArticles.length, 'articles');
          }
        } catch (error) {
          console.error('[sandbox-chat] Semantic search failed:', error);
        }
      }

      // Fallback: keyword-based search
      if (knowledgeArticles.length === 0 && hasPersonaCategories) {
        console.log('[sandbox-chat] Fallback: keyword search...');
        
        const { data: articles } = await supabase
          .from('knowledge_articles')
          .select('id, title, content, category')
          .eq('is_published', true)
          .in('category', personaCategories)
          .limit(5);

        knowledgeArticles = articles || [];
        console.log('[sandbox-chat] ✅ Keyword search:', knowledgeArticles.length, 'articles');
      }
      
      // Check for knowledge gap (triggers handoff)
      if (knowledgeArticles.length === 0 && intentType === 'search') {
        handoffTriggered = true;
        handoffReason = 'knowledge_gap';
        console.log('[sandbox-chat] 🚨 Handoff: no relevant articles found');
      }

      console.log('[sandbox-chat] Final article count:', knowledgeArticles.length);

      if (knowledgeArticles.length > 0) {
        const kbContext = knowledgeArticles.map((a: any) => 
          `[Artigo: ${a.title}${a.similarity ? ` | Relevância: ${Math.round(a.similarity * 100)}%` : ''}]\n${a.content}`
        ).join('\n\n---\n\n');

        systemPrompt = `${persona.system_prompt}\n\n## BASE DE CONHECIMENTO DISPONÍVEL:\n\n${kbContext}\n\nUSE estas informações da base de conhecimento para responder quando relevante.`;
      }
    }

    // FASE 3: Inject Customer Context
    if (customerContext) {
      const contextInfo = `

## CLIENTE IDENTIFICADO:
- Nome: ${customerContext.first_name} ${customerContext.last_name}
- Email: ${customerContext.email}
- Status: ${customerContext.status === 'customer' ? 'Cliente Existente' : 'Lead/Novo Contato'}

Você está conversando com um cliente identificado. Use essas informações para personalizar suas respostas.`;
      
      systemPrompt = `${systemPrompt}${contextInfo}`;
      console.log('[sandbox-chat] Customer context injected into prompt');
    }

    // Adicionar instrução de treinamento NO INÍCIO do system prompt (prioridade)
    const finalSystemPrompt = trainingInstruction + systemPrompt;

    const aiMessages = [
      { role: "system", content: finalSystemPrompt },
      ...fewShotMessages,  // ✨ Injetar exemplos de treinamento
      ...messages
    ];

    console.log('[sandbox-chat] Final messages structure:', {
      system: 1,
      fewShot: fewShotMessages.length,
      conversation: messages.length,
      total: aiMessages.length
    });

    // Prepare AI call based on provider
    let actualProvider = aiProvider;
    let aiResponse: Response | null = null;

    if (aiProvider === 'openai' || !aiResponse) {
      if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      console.log('[sandbox-chat] Calling OpenAI with model:', configuredModel);
      
      const isReasoningModel = ['o3', 'o3-mini', 'o4-mini'].includes(configuredModel);
      const openaiPayload: any = {
        model: configuredModel,
        messages: aiMessages,
        temperature: isReasoningModel ? undefined : (persona.temperature || 0.7),
        ...(isReasoningModel
          ? { max_completion_tokens: persona.max_tokens || 500 }
          : { max_tokens: persona.max_tokens || 500 }),
      };

      if (tools.length > 0) {
        openaiPayload.tools = tools;
      }

      aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(openaiPayload),
      });
    }

    if (!aiResponse) {
      throw new Error('No AI response received');
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[sandbox-chat] AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Erro de billing na API OpenAI. Verifique sua conta OpenAI.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI API error: ${aiResponse.status} ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log('[sandbox-chat] AI response received');

    const choice = aiData.choices[0];
    const message = choice.message;

    // FASE 4: Extract and execute tool calls if present
    const toolCalls = message.tool_calls || [];
    console.log('[sandbox-chat] Tool calls:', toolCalls.length);

    const executionTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        content: message.content || '',
        tool_calls: toolCalls,
        persona: {
          name: persona.name,
          role: persona.role,
          temperature: persona.temperature,
        },
        debug: {
          model: configuredModel,
          ai_provider: actualProvider,
          intent_classification: intentType,
          queries_executed: queriesExecuted,
          knowledge_search_performed: useKnowledgeBase && intentType === 'search',
          semantic_search_used: semanticSearchUsed,
          articles_found: knowledgeArticles.length,
          articles: knowledgeArticles.map(a => ({ 
            id: a.id, 
            title: a.title, 
            category: a.category,
            similarity: a.similarity ? `${Math.round(a.similarity * 100)}%` : undefined
          })),
          persona_categories: persona.knowledge_base_paths || [],
          handoff_triggered: handoffTriggered,
          handoff_reason: handoffReason,
          execution_time_ms: executionTime,
          prompt_tokens: aiData.usage?.prompt_tokens || 0,
          completion_tokens: aiData.usage?.completion_tokens || 0,
          total_tokens: aiData.usage?.total_tokens || 0,
          customer_context: customerContext || undefined,
          tools_executed: [], // FASE 2: Tool execution results will be added here
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sandbox-chat] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
