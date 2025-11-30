import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, personaId, useKnowledgeBase = false, aiProvider = 'lovable' } = await req.json();
    
    console.log('[sandbox-chat] Processing request for persona:', personaId);
    console.log('[sandbox-chat] Knowledge Base:', useKnowledgeBase, '| Provider:', aiProvider);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Build tools array from persona's linked tools
    const tools = persona.ai_persona_tools
      ?.filter((pt: any) => pt.ai_tools?.is_enabled)
      .map((pt: any) => ({
        type: "function",
        function: pt.ai_tools.function_schema
      })) || [];

    console.log('[sandbox-chat] Available tools:', tools.length);

    // Knowledge Base Search with Semantic Search
    let knowledgeArticles: any[] = [];
    let systemPrompt = persona.system_prompt;
    let usedSemanticSearch = false;

    if (useKnowledgeBase) {
      console.log('[sandbox-chat] Knowledge base search enabled');
      
      // Get last user message
      const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
      
      if (lastUserMessage) {
        const userQuestion = lastUserMessage.content;
        console.log('[sandbox-chat] User question:', userQuestion);

        try {
          // Try semantic search first
          const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
          
          if (OPENAI_API_KEY) {
            console.log('[sandbox-chat] Attempting semantic search with OpenAI embeddings');
            
            // Generate embedding for the user's question
            const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: userQuestion,
              }),
            });

            if (embeddingResponse.ok) {
              const embeddingData = await embeddingResponse.json();
              const queryEmbedding = embeddingData.data[0].embedding;

              // Search using pgvector similarity
              const { data: semanticArticles, error: semanticError } = await supabase.rpc(
                'match_knowledge_articles',
                {
                  query_embedding: queryEmbedding,
                  match_threshold: 0.75,
                  match_count: 10,
                }
              );

              if (!semanticError && semanticArticles && semanticArticles.length > 0) {
                console.log(`[sandbox-chat] Semantic search found ${semanticArticles.length} articles`);

                // Filter by persona's knowledge_base_paths if configured
                let filteredArticles = semanticArticles;
                if (persona.knowledge_base_paths?.length > 0) {
                  filteredArticles = semanticArticles.filter((a: any) => 
                    persona.knowledge_base_paths.includes(a.category)
                  );
                  console.log(`[sandbox-chat] Filtered to ${filteredArticles.length} articles by categories:`, persona.knowledge_base_paths);
                }

                knowledgeArticles = filteredArticles.slice(0, 5).map((a: any) => ({
                  ...a,
                  similarity: a.similarity
                }));
                usedSemanticSearch = true;
              } else {
                console.log('[sandbox-chat] Semantic search returned no results');
              }
            } else {
              console.log('[sandbox-chat] OpenAI embedding generation failed');
            }
          }
        } catch (error) {
          console.error('[sandbox-chat] Semantic search failed:', error);
        }

        // Fallback to keyword search if semantic search didn't work
        if (knowledgeArticles.length === 0 && persona.knowledge_base_paths?.length > 0) {
          console.log('[sandbox-chat] Falling back to keyword search by category');
          
          const { data: articles } = await supabase
            .from('knowledge_articles')
            .select('id, title, content, category')
            .eq('is_published', true)
            .in('category', persona.knowledge_base_paths)
            .limit(5);

          knowledgeArticles = articles || [];
        }

        console.log('[sandbox-chat] Final article count:', knowledgeArticles.length);

        if (knowledgeArticles.length > 0) {
          const kbContext = knowledgeArticles.map((a: any) => 
            `[Artigo: ${a.title}${a.similarity ? ` | Relevância: ${Math.round(a.similarity * 100)}%` : ''}]\n${a.content}`
          ).join('\n\n---\n\n');

          systemPrompt = `${persona.system_prompt}\n\n## BASE DE CONHECIMENTO DISPONÍVEL:\n\n${kbContext}\n\nUSE estas informações da base de conhecimento para responder quando relevante.`;
        }
      }
    }

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    // Prepare AI call based on provider
    let actualProvider = aiProvider;
    let aiResponse: Response | null = null;

    if (aiProvider === 'openai') {
      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
      
      if (!OPENAI_API_KEY) {
        console.log('[sandbox-chat] OpenAI key not found, falling back to Lovable AI');
        actualProvider = 'lovable';
      } else {
        console.log('[sandbox-chat] Calling OpenAI (gpt-4o-mini)');
        
        const openaiPayload: any = {
          model: "gpt-4o-mini",
          messages: aiMessages,
          temperature: persona.temperature || 0.7,
          max_tokens: persona.max_tokens || 500,
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

        if (!aiResponse.ok) {
          console.log('[sandbox-chat] OpenAI failed, falling back to Lovable AI');
          actualProvider = 'lovable';
        }
      }
    }

    if (actualProvider === 'lovable' || !aiResponse) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        throw new Error('LOVABLE_API_KEY not configured');
      }

      console.log('[sandbox-chat] Calling Lovable AI (Gemini)');

      const aiPayload: any = {
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        temperature: persona.temperature || 0.7,
        max_tokens: persona.max_tokens || 500,
      };

      if (tools.length > 0) {
        aiPayload.tools = tools;
      }

      aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(aiPayload),
      });
    }

    if (!aiResponse) {
      throw new Error('No AI response received from any provider');
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
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI API error: ${aiResponse.status} ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log('[sandbox-chat] AI response received');

    const choice = aiData.choices[0];
    const message = choice.message;

    // Extract tool calls if present
    const toolCalls = message.tool_calls || [];
    console.log('[sandbox-chat] Tool calls:', toolCalls.length);

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
          model: actualProvider === 'openai' ? 'gpt-4o-mini' : 'google/gemini-2.5-flash',
          ai_provider: actualProvider,
          knowledge_search_performed: useKnowledgeBase,
          semantic_search_used: usedSemanticSearch,
          articles_found: knowledgeArticles.length,
          articles: knowledgeArticles.map(a => ({ 
            id: a.id, 
            title: a.title, 
            category: a.category,
            similarity: a.similarity ? Math.round(a.similarity * 100) : null
          })),
          persona_categories: persona.knowledge_base_paths || [],
          prompt_tokens: aiData.usage?.prompt_tokens || 0,
          completion_tokens: aiData.usage?.completion_tokens || 0,
          total_tokens: aiData.usage?.total_tokens || 0,
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
