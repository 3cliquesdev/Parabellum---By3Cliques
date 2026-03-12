import { createClient } from "npm:@supabase/supabase-js@2";
import { getAIConfig, createKillSwitchResponse, AI_STATUS } from "../_shared/ai-config-cache.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KB_DRAFT_PROMPT = `Você é um ANALISTA DE CONHECIMENTO INTERNO.

Seu papel é transformar um PROBLEMA REAL em um ARTIGO DE BASE DE CONHECIMENTO.

REGRAS ABSOLUTAS:
- NÃO publique nada
- NÃO invente informações
- NÃO use tom comercial
- NÃO fale com cliente
- NÃO cite a conversa original
- NÃO mencione nomes de clientes ou dados pessoais

O artigo deve ser:
- Claro
- Objetivo
- Reutilizável
- Técnico e neutro

BASEIE-SE APENAS no problema informado e no contexto fornecido.
Se não houver informação suficiente, indique "[REVISAR: informação não disponível]".

Formato OBRIGATÓRIO (JSON):

{
  "title": "Título objetivo do problema",
  "when_to_use": "Quando este artigo deve ser usado pelo agente",
  "solution": "Passo a passo claro para resolver o problema",
  "tags": ["tag1", "tag2"]
}`;

interface GenerateDraftRequest {
  gapId: string;
  conversationId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ============================================
    // FASE 6: Kill Switch + Shadow Mode (Cached)
    // ============================================
    const aiConfig = await getAIConfig(supabaseClient);

    if (!aiConfig.ai_global_enabled) {
      console.log('[generate-kb-draft] 🚫 Kill Switch ativo - retornando');
      return createKillSwitchResponse(corsHeaders);
    }

    const isShadowMode = aiConfig.ai_shadow_mode;

    const { gapId, conversationId }: GenerateDraftRequest = await req.json();

    console.log(`[generate-kb-draft] Gerando draft para KB Gap: ${gapId} (Shadow Mode: ${isShadowMode})`);

    // 1. Buscar o KB Gap
    const { data: gap, error: gapError } = await supabaseClient
      .from('ai_suggestions')
      .select('*')
      .eq('id', gapId)
      .eq('suggestion_type', 'kb_gap')
      .single();

    if (gapError || !gap) {
      console.error('[generate-kb-draft] KB Gap não encontrado:', gapError);
      return new Response(JSON.stringify({ 
        error: 'KB Gap não encontrado' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Buscar contexto da conversa (se disponível)
    let conversationContext = '';
    const convId = conversationId || gap.conversation_id;
    
    if (convId) {
      const { data: messages } = await supabaseClient
        .from('messages')
        .select('content, sender_type')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
        .limit(20);

      if (messages && messages.length > 0) {
        conversationContext = messages.map(m => 
          `${m.sender_type === 'customer' ? 'Cliente' : 'Agente'}: ${m.content}`
        ).join('\n');
      }
    }

    // 3. Chamar IA para gerar draft
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    const userPrompt = `## Problema Detectado (KB Gap):
${gap.kb_gap_description}

## Contexto da Conversa Original:
${conversationContext || 'Não disponível'}

Gere um artigo de base de conhecimento em JSON.`;

    console.log('[generate-kb-draft] Chamando IA para gerar draft...');

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_completion_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          { role: 'system', content: KB_DRAFT_PROMPT },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[generate-kb-draft] AI error:', aiResponse.status, errorText);
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '{}';

    console.log('[generate-kb-draft] Resposta da IA recebida');

    // 4. Parsear resposta
    let draft;
    try {
      draft = JSON.parse(rawContent);
    } catch {
      console.warn('[generate-kb-draft] Falha ao parsear JSON, usando fallback');
      draft = {
        title: gap.kb_gap_description?.substring(0, 100) || 'Novo Artigo',
        when_to_use: '[REVISAR: geração automática falhou]',
        solution: '[REVISAR: geração automática falhou]',
        tags: []
      };
    }

    // 5. Criar artigo como draft (sempre unpublished)
    const { data: article, error: insertError } = await supabaseClient
      .from('knowledge_articles')
      .insert({
        title: draft.title,
        content: draft.solution,
        problem: draft.title,
        solution: draft.solution,
        when_to_use: draft.when_to_use,
        when_not_to_use: null,
        category: 'Gerado por IA',
        tags: draft.tags || [],
        source: 'ai_draft',
        draft_from_gap_id: gapId,
        source_conversation_id: convId,
        is_published: false, // NEVER auto-publish
        needs_review: true, // AJUSTE 1: Marcar sempre para revisão obrigatória
        embedding_generated: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[generate-kb-draft] Erro ao inserir artigo:', insertError);
      throw insertError;
    }

    // 6. Marcar KB Gap como usado
    await supabaseClient
      .from('ai_suggestions')
      .update({ used: true })
      .eq('id', gapId);

    // ============================================
    // FASE 6: Registrar na ai_learning_timeline
    // ============================================
    await supabaseClient
      .from('ai_learning_timeline')
      .insert({
        learning_type: 'draft',
        summary: `Draft KB criado: "${draft.title}" a partir de gap detectado`,
        source_conversations: convId ? 1 : 0,
        source_conversation_ids: convId ? [convId] : null,
        confidence: 'alta',
        status: isShadowMode ? 'pending' : 'pending', // Sempre pending para revisão
        related_article_id: article.id,
        metadata: { 
          gap_id: gapId, 
          shadow_mode: isShadowMode,
          gap_description: gap.kb_gap_description?.substring(0, 200)
        }
      });

    console.log(`[generate-kb-draft] ✅ Draft criado: ${article.id} (Shadow Mode: ${isShadowMode})`);

    return new Response(JSON.stringify({ 
      success: true,
      article,
      status: isShadowMode ? AI_STATUS.SUGGESTED_ONLY : AI_STATUS.APPLIED, // Semantic status
      applied: !isShadowMode // Backward compatibility
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-kb-draft] Erro:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
