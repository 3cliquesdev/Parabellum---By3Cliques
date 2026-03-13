import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
};

// ============================================================
// 🚀 AI STREAMING EDGE FUNCTION
// Token-by-token SSE streaming para latência <1s
// ============================================================

interface StreamRequest {
  conversationId: string;
  customerMessage: string;
}

// Helper: Buscar modelo AI configurado
async function getConfiguredAIModel(supabaseClient: any): Promise<string> {
  return 'gpt-5-mini';
}

// Helper: Buscar persona ativa
async function getActivePersona(supabaseClient: any): Promise<any> {
  const { data } = await supabaseClient
    .from('ai_personas')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

// Helper: Buscar histórico de mensagens
async function getConversationHistory(
  supabaseClient: any,
  conversationId: string,
  limit: number = 30
): Promise<Array<{ role: string; content: string }>> {
  const { data } = await supabaseClient
    .from('messages')
    .select('content, sender_type, is_ai_generated')
    .eq('conversation_id', conversationId)
    .eq('is_internal', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data) return [];

  // Inverter para ordem cronológica e mapear para formato de chat
  return data.reverse().map((msg: any) => ({
    role: msg.sender_type === 'contact' ? 'user' : 'assistant',
    content: msg.content
  }));
}

// Helper: Buscar artigos da KB por similaridade
async function searchKnowledgeBase(
  supabaseClient: any,
  query: string,
  limit: number = 5
): Promise<Array<{ id: string; title: string; content: string; similarity: number }>> {
  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) return [];

    // Gerar embedding da query
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

    if (!embeddingResponse.ok) return [];
    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data?.[0]?.embedding;
    if (!queryEmbedding) return [];

    // Buscar artigos similares via RPC
    const { data } = await supabaseClient.rpc('match_knowledge_articles', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: limit
    });

    return data || [];
  } catch (err) {
    console.error('[ai-chat-stream] KB search error:', err);
    return [];
  }
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const t0 = Date.now();
  console.log('[ai-chat-stream] 🚀 Request received at:', new Date().toISOString());

  try {
    const body: StreamRequest = await req.json();
    const { conversationId, customerMessage } = body;

    if (!conversationId || !customerMessage) {
      return new Response(JSON.stringify({ error: 'Missing conversationId or customerMessage' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Inicializar Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Buscar conversa e contato em paralelo
    const [conversationResult, personaResult, historyResult, modelResult] = await Promise.all([
      supabaseClient
        .from('conversations')
        .select(`
          id, channel, ai_mode, department,
          contacts:contact_id (id, first_name, last_name, email, phone)
        `)
        .eq('id', conversationId)
        .single(),
      getActivePersona(supabaseClient),
      getConversationHistory(supabaseClient, conversationId, 30),
      getConfiguredAIModel(supabaseClient),
    ]);

    if (conversationResult.error || !conversationResult.data) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const conversation = conversationResult.data;
    const contact = conversation.contacts as any;
    const persona = personaResult;
    const history = historyResult;
    const aiModel = modelResult;

    // Buscar artigos relevantes da KB
    const kbArticles = await searchKnowledgeBase(supabaseClient, customerMessage, 5);
    
    const t1 = Date.now();
    console.log('[ai-chat-stream] ⏱️ Context fetched in:', t1 - t0, 'ms');

    // Construir system prompt
    const contactName = contact?.first_name || 'Cliente';
    const kbContext = kbArticles.length > 0
      ? `\n\n**INFORMAÇÕES DA BASE DE CONHECIMENTO:**\n${kbArticles.map(a => `- ${a.title}: ${a.content.slice(0, 500)}`).join('\n')}`
      : '';

    const systemPrompt = persona?.system_prompt 
      ? `${persona.system_prompt}\n\nVocê está conversando com ${contactName}.${kbContext}`
      : `Você é um assistente virtual prestativo e amigável. Responda de forma clara e concisa.\n\nVocê está conversando com ${contactName}.${kbContext}`;

    // Construir messages para a API
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: customerMessage }
    ];

    // Broadcast typing indicator via Supabase Realtime
    const typingChannel = supabaseClient.channel(`typing-${conversationId}`);
    await typingChannel.subscribe();
    await typingChannel.send({
      type: 'broadcast',
      event: 'ai_typing',
      payload: { isTyping: true, conversationId }
    });

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Chamar OpenAI com streaming
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiModel,
        messages,
        stream: true,
        max_completion_tokens: 1024,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[ai-chat-stream] OpenAI API error:', aiResponse.status, errorText);
      
      // Handle rate limits
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'OpenAI billing error. Please check your API account.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'OpenAI API error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const t2 = Date.now();
    console.log('[ai-chat-stream] ⏱️ AI stream started in:', t2 - t0, 'ms (TTFB)');

    // Criar ReadableStream para SSE
    const encoder = new TextEncoder();
    let fullContent = '';
    const messageId = crypto.randomUUID();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = aiResponse.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            
            // Processar linhas SSE
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Manter última linha incompleta no buffer

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                
                if (content) {
                  fullContent += content;
                  
                  // Emitir token para o cliente
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content, done: false })}\n\n`)
                  );
                }
              } catch {
                // JSON incompleto, será processado no próximo chunk
              }
            }
          }

          // Processar buffer restante
          if (buffer.trim()) {
            const lines = buffer.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]' || !jsonStr) continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullContent += content;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content, done: false })}\n\n`)
                  );
                }
              } catch { /* ignore */ }
            }
          }

          const t3 = Date.now();
          console.log('[ai-chat-stream] ⏱️ Stream complete in:', t3 - t0, 'ms, content length:', fullContent.length);

          // Salvar mensagem completa no banco
          const { data: savedMessage, error: saveError } = await supabaseClient
            .from('messages')
            .insert({
              id: messageId,
              conversation_id: conversationId,
              content: fullContent,
              sender_type: 'user',
              is_ai_generated: true,
              channel: conversation.channel || 'web_chat',
              status: 'sent',
            })
            .select('id')
            .single();

          if (saveError) {
            console.error('[ai-chat-stream] Failed to save message:', saveError);
          } else {
            console.log('[ai-chat-stream] ✅ Message saved:', savedMessage?.id);
          }

          // Atualizar last_message_at
          await supabaseClient
            .from('conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', conversationId);

          // Broadcast typing = false
          await typingChannel.send({
            type: 'broadcast',
            event: 'ai_typing',
            payload: { isTyping: false, conversationId }
          });
          await supabaseClient.removeChannel(typingChannel);

          // Log de observabilidade
          const totalTime = Date.now() - t0;
          console.log('[ai-chat-stream] 📊 METRICS:', {
            t0_request: t0,
            t1_context: t1 - t0,
            t2_ttfb: t2 - t0,
            t3_total: totalTime,
            tokens_approx: Math.round(fullContent.length / 4),
            model: aiModel
          });

          // Enviar evento final com messageId
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              content: '', 
              done: true, 
              messageId: savedMessage?.id || messageId,
              totalTime
            })}\n\n`)
          );

          controller.close();

        } catch (streamError) {
          console.error('[ai-chat-stream] Stream error:', streamError);
          
          // Salvar conteúdo parcial se houver
          if (fullContent.length > 0) {
            await supabaseClient.from('messages').insert({
              id: messageId,
              conversation_id: conversationId,
              content: fullContent + '\n\n_[Resposta interrompida]_',
              sender_type: 'user',
              is_ai_generated: true,
              channel: conversation.channel || 'web_chat',
              status: 'failed',
            });
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted', done: true })}\n\n`)
          );
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });

  } catch (error) {
    console.error('[ai-chat-stream] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
