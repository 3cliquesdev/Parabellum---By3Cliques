import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper para buscar modelo AI configurado
async function getConfiguredAIModel(supabase: any): Promise<string> {
  try {
    const { data } = await supabase
      .from('system_configurations')
      .select('value')
      .eq('key', 'ai_model_analysis')
      .single();
    return data?.value || 'google/gemini-2.5-flash';
  } catch {
    return 'google/gemini-2.5-flash';
  }
}

// Gerar embedding usando OpenAI
async function generateEmbedding(text: string): Promise<number[] | null> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    console.log('[ai-auto-trainer] OPENAI_API_KEY not configured, skipping embedding');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000), // Limitar tamanho
      }),
    });

    if (!response.ok) {
      console.error('[ai-auto-trainer] Embedding error:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('[ai-auto-trainer] Embedding generation failed:', error);
    return null;
  }
}

// Verificar se artigo já existe (similaridade > 95%)
async function checkDuplicate(supabase: any, embedding: number[]): Promise<{ isDuplicate: boolean; similarTo?: string }> {
  try {
    const { data, error } = await supabase.rpc('search_similar_articles', {
      query_embedding: embedding,
      match_threshold: 0.95,
      match_count: 1,
    });

    if (error) {
      console.error('[ai-auto-trainer] Duplicate check error:', error);
      return { isDuplicate: false };
    }

    if (data && data.length > 0) {
      return { isDuplicate: true, similarTo: data[0].title };
    }

    return { isDuplicate: false };
  } catch {
    return { isDuplicate: false };
  }
}

// Minerar conhecimento de conversa bem-sucedida
async function mineSuccessConversation(
  supabase: any,
  conversationId: string,
  aiModel: string,
  LOVABLE_API_KEY: string
): Promise<{ items: any[]; skipped: boolean; reason?: string; confidence?: number; reasoning?: string }> {
  // Buscar mensagens da conversa
  const { data: messages, error } = await supabase
    .from('messages')
    .select('content, sender_type, is_ai_generated, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error || !messages || messages.length < 3) {
    return { items: [], skipped: true, reason: 'insufficient_messages' };
  }

  // Construir transcript
  const transcript = messages.map((m: any) => 
    `${m.sender_type === 'user' ? 'AGENTE' : 'CLIENTE'}: ${m.content}`
  ).join('\n');

  if (transcript.length < 100) {
    return { items: [], skipped: true, reason: 'transcript_too_short' };
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          {
            role: 'system',
            content: `Você é um Agente de Treinamento de IA. Analise este atendimento e extraia APENAS conhecimento técnico ou regras de negócio.

IGNORE COMPLETAMENTE:
- Saudações (bom dia, obrigado, etc)
- Conversas pessoais
- Confirmações genéricas
- Informações que dependem de contexto específico do cliente

EXTRAIA:
- Procedimentos técnicos explicados
- Regras de negócio mencionadas
- Soluções para problemas recorrentes
- Políticas da empresa

RETORNE JSON VÁLIDO:
{
  "extracted_items": [
    {
      "question": "Pergunta que este conhecimento responde",
      "answer": "Resposta completa e técnica",
      "category": "Categoria (Suporte, Pagamento, Produto, etc)"
    }
  ],
  "confidence_score": 0-100,
  "reasoning": "Por que você extraiu isso e qual a confiança"
}

Se não houver conhecimento útil, retorne: { "extracted_items": [], "confidence_score": 0, "reasoning": "Sem conhecimento extraível" }`
          },
          { role: 'user', content: `TRANSCRIPT:\n${transcript.substring(0, 10000)}` }
        ],
      }),
    });

    if (!response.ok) {
      console.error('[ai-auto-trainer] AI response error:', response.status);
      return { items: [], skipped: true, reason: 'ai_error' };
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '{}';
    
    // Parse JSON (tentar extrair do content)
    let parsed;
    try {
      // Tentar extrair JSON de dentro do texto
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      console.error('[ai-auto-trainer] Failed to parse AI response');
      return { items: [], skipped: true, reason: 'parse_error' };
    }

    return {
      items: parsed.extracted_items || [],
      skipped: false,
      confidence: parsed.confidence_score,
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    console.error('[ai-auto-trainer] Mining error:', error);
    return { items: [], skipped: true, reason: 'exception' };
  }
}

// Minerar correção de falha (fallback + resposta humana)
async function mineFailureCorrection(
  supabase: any,
  conversationId: string,
  aiModel: string,
  LOVABLE_API_KEY: string
): Promise<{ item: any | null; skipped: boolean; reason?: string }> {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('content, sender_type, is_ai_generated, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error || !messages) {
    return { item: null, skipped: true, reason: 'no_messages' };
  }

  // Encontrar mensagem de fallback
  const fallbackPatterns = ['especialista', 'humano', 'atendente', 'transferir'];
  const fallbackIndex = messages.findIndex((m: any) => 
    m.is_ai_generated && 
    fallbackPatterns.some(p => m.content?.toLowerCase().includes(p))
  );

  if (fallbackIndex === -1) {
    return { item: null, skipped: true, reason: 'no_fallback_found' };
  }

  // Mensagem do cliente ANTES do fallback
  const customerQuestion = messages
    .slice(0, fallbackIndex)
    .filter((m: any) => m.sender_type === 'contact')
    .pop()?.content;

  // Resposta do agente humano APÓS o fallback
  const humanResponse = messages
    .slice(fallbackIndex + 1)
    .find((m: any) => m.sender_type === 'user' && !m.is_ai_generated)?.content;

  if (!customerQuestion || !humanResponse) {
    return { item: null, skipped: true, reason: 'missing_context' };
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          {
            role: 'system',
            content: `Você é um Agente de Correção de IA. A IA não soube responder uma pergunta e um humano resolveu.

SUA TAREFA:
Crie uma regra de conhecimento para que a IA saiba responder da próxima vez.

RETORNE JSON VÁLIDO:
{
  "question": "Pergunta reformulada de forma clara e genérica",
  "answer": "Resposta completa baseada no que o humano explicou",
  "category": "Categoria apropriada",
  "confidence_score": 0-100,
  "reasoning": "Por que esta regra é útil"
}`
          },
          {
            role: 'user',
            content: `PERGUNTA DO CLIENTE:\n${customerQuestion}\n\nRESPOSTA DO HUMANO:\n${humanResponse}`
          }
        ],
      }),
    });

    if (!response.ok) {
      return { item: null, skipped: true, reason: 'ai_error' };
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '{}';
    
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      return { item: null, skipped: true, reason: 'parse_error' };
    }

    return {
      item: {
        question: parsed.question,
        answer: parsed.answer,
        category: parsed.category,
        confidence_score: parsed.confidence_score,
        reasoning: parsed.reasoning,
      },
      skipped: false,
    };
  } catch (error) {
    console.error('[ai-auto-trainer] Failure mining error:', error);
    return { item: null, skipped: true, reason: 'exception' };
  }
}

// Salvar conhecimento extraído
async function saveKnowledge(
  supabase: any,
  item: any,
  source: string
): Promise<{ created: boolean; status: string; articleId?: string; skipped?: boolean; reason?: string; confidence?: number }> {
  // Gerar embedding
  const textForEmbedding = `${item.question}\n${item.answer}`;
  const embedding = await generateEmbedding(textForEmbedding);

  // Verificar duplicata se tiver embedding
  if (embedding) {
    const { isDuplicate, similarTo } = await checkDuplicate(supabase, embedding);
    if (isDuplicate) {
      console.log(`[ai-auto-trainer] Duplicata detectada: similar a "${similarTo}"`);
      return { created: false, status: 'duplicate', skipped: true, reason: `Similar a: ${similarTo}` };
    }
  }

  // Decidir status baseado no confidence_score
  const confidence = item.confidence_score || 0;
  let status = 'draft';
  let isPublished = false;

  if (confidence > 90) {
    status = 'published';
    isPublished = true;
  } else if (confidence < 70) {
    // Muito baixa confiança - descartar
    return { created: false, status: 'discarded', skipped: true, reason: 'low_confidence' };
  }

  // Salvar artigo
  const { data: article, error } = await supabase
    .from('knowledge_articles')
    .insert({
      title: item.question,
      content: item.answer,
      category: item.category || 'Auto-Aprendizado',
      tags: [source, confidence > 90 ? 'auto_approved' : 'pending_review'],
      source: source,
      is_published: isPublished,
      embedding: embedding,
    })
    .select()
    .single();

  if (error) {
    console.error('[ai-auto-trainer] Save error:', error);
    return { created: false, status: 'error', reason: error.message };
  }

  console.log(`[ai-auto-trainer] Artigo salvo: ${article.id} (${status}, confidence: ${confidence})`);

  return {
    created: true,
    status: status,
    articleId: article.id,
    confidence: confidence,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!LOVABLE_API_KEY) {
    console.error('[ai-auto-trainer] LOVABLE_API_KEY not configured');
    return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const startTime = Date.now();

  console.log('[ai-auto-trainer] ⏰ Iniciando execução...');

  // Buscar modelo AI configurado
  const aiModel = await getConfiguredAIModel(supabase);
  console.log(`[ai-auto-trainer] Usando modelo: ${aiModel}`);

  // Janela de tempo: última hora
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  let articlesPublished = 0;
  let articlesAsDraft = 0;
  let skippedDuplicates = 0;
  let skippedLowConfidence = 0;
  let conversationsProcessed = 0;
  let failuresProcessed = 0;

  try {
    // ===== FONTE 1: SUCESSOS HUMANOS =====
    console.log('[ai-auto-trainer] 📊 Buscando conversas bem-sucedidas...');
    
    // Buscar conversas fechadas com rating >= 4 ou status resolved
    const { data: successConversations, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        status,
        closed_at,
        conversation_ratings(rating)
      `)
      .eq('status', 'closed')
      .gte('closed_at', oneHourAgo)
      .limit(20); // Limitar para não sobrecarregar

    if (convError) {
      console.error('[ai-auto-trainer] Erro buscando conversas:', convError);
    }

    const eligibleConversations = (successConversations || []).filter((c: any) => {
      const rating = c.conversation_ratings?.[0]?.rating;
      return rating >= 4 || c.status === 'closed';
    });

    console.log(`[ai-auto-trainer] Encontradas ${eligibleConversations.length} conversas elegíveis`);

    for (const conv of eligibleConversations) {
      conversationsProcessed++;
      const result = await mineSuccessConversation(supabase, conv.id, aiModel, LOVABLE_API_KEY);
      
      if (result.skipped) {
        console.log(`[ai-auto-trainer] Conversa ${conv.id} pulada: ${result.reason}`);
        continue;
      }

      for (const item of result.items) {
        if (!item.question || !item.answer) continue;

        const saveResult = await saveKnowledge(supabase, item, 'auto_mining_success');
        
        if (saveResult.created) {
          if (saveResult.status === 'published') {
            articlesPublished++;
          } else {
            articlesAsDraft++;
          }
        } else if (saveResult.reason?.includes('Similar')) {
          skippedDuplicates++;
        } else if (saveResult.status === 'discarded') {
          skippedLowConfidence++;
        }
      }
    }

    // ===== FONTE 2: CORREÇÃO DE FALHAS =====
    console.log('[ai-auto-trainer] 🔧 Buscando conversas com fallback...');
    
    // Buscar mensagens com padrão de fallback
    const { data: fallbackMessages, error: fallbackError } = await supabase
      .from('messages')
      .select('conversation_id')
      .eq('is_ai_generated', true)
      .or('content.ilike.%especialista%,content.ilike.%humano%,content.ilike.%transferir%')
      .gte('created_at', oneHourAgo)
      .limit(20);

    if (fallbackError) {
      console.error('[ai-auto-trainer] Erro buscando fallbacks:', fallbackError);
    }

    // Unique conversation IDs
    const fallbackConvIds = [...new Set((fallbackMessages || []).map((m: any) => m.conversation_id))];
    console.log(`[ai-auto-trainer] Encontradas ${fallbackConvIds.length} conversas com fallback`);

    for (const convId of fallbackConvIds) {
      failuresProcessed++;
      const result = await mineFailureCorrection(supabase, convId, aiModel, LOVABLE_API_KEY);
      
      if (result.skipped || !result.item) {
        console.log(`[ai-auto-trainer] Fallback ${convId} pulado: ${result.reason}`);
        continue;
      }

      const saveResult = await saveKnowledge(supabase, result.item, 'auto_mining_failure_fix');
      
      if (saveResult.created) {
        if (saveResult.status === 'published') {
          articlesPublished++;
        } else {
          articlesAsDraft++;
        }
      } else if (saveResult.reason?.includes('Similar')) {
        skippedDuplicates++;
      } else if (saveResult.status === 'discarded') {
        skippedLowConfidence++;
      }
    }

    // ===== AUDITORIA =====
    const executionTime = Date.now() - startTime;
    const summary = {
      articles_published: articlesPublished,
      articles_as_draft: articlesAsDraft,
      duplicates_skipped: skippedDuplicates,
      low_confidence_skipped: skippedLowConfidence,
      success_conversations_processed: conversationsProcessed,
      failure_corrections_processed: failuresProcessed,
      execution_time_ms: executionTime,
      executed_at: new Date().toISOString(),
      ai_model: aiModel,
    };

    const { error: auditError } = await supabase.from('audit_logs').insert({
      action: 'ai_auto_training',
      table_name: 'knowledge_articles',
      new_data: summary,
    });

    if (auditError) {
      console.error('[ai-auto-trainer] Erro salvando audit_log:', auditError);
    } else {
      console.log('[ai-auto-trainer] Audit log salvo com sucesso');
    }

    console.log('[ai-auto-trainer] ✅ Execução concluída:', summary);

    return new Response(JSON.stringify({
      success: true,
      ...summary,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('[ai-auto-trainer] ❌ Erro fatal:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
