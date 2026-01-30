import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getAIConfig } from "../_shared/ai-config-cache.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, ticketId, departmentId } = await req.json();
    
    console.log('[extract-knowledge] Processing conversation:', conversationId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ============================================
    // FASE 6: Kill Switch + Shadow Mode (Cached)
    // ============================================
    const aiConfig = await getAIConfig(supabase);

    if (!aiConfig.ai_global_enabled) {
      console.log('[extract-knowledge] 🚫 Kill Switch ativo - retornando');
      return new Response(
        JSON.stringify({ success: false, reason: 'kill_switch' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isShadowMode = aiConfig.ai_shadow_mode;
    console.log(`[extract-knowledge] Shadow Mode: ${isShadowMode ? 'ATIVO' : 'Inativo'}`);

    // 🆕 FASE 2: Guard-rail - verificar se já foi aprendido
    const { data: conversation } = await supabase
      .from('conversations')
      .select('learned_at')
      .eq('id', conversationId)
      .single();

    if (conversation?.learned_at) {
      console.log(`[extract-knowledge] Conversa ${conversationId} já aprendida em ${conversation.learned_at}`);
      return new Response(
        JSON.stringify({ success: false, reason: 'already_learned' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // 🆕 FASE 2: Prompt estruturado para extração
    const structuredPrompt = `Você é um Agente de Extração de Conhecimento.

Analise este atendimento BEM-SUCEDIDO (CSAT >= 4) e extraia conhecimento REUTILIZÁVEL.

IGNORE COMPLETAMENTE:
- Saudações (bom dia, obrigado, etc)
- Agradecimentos e despedidas
- Informações específicas do cliente (nome, CPF, número de pedido)
- Contexto pessoal ou emocional
- Promessas ou exceções feitas para este cliente específico

EXTRAIA APENAS:
- Procedimentos técnicos explicados pelo agente
- Regras de negócio mencionadas
- Soluções para problemas recorrentes
- Políticas da empresa

RETORNE JSON ESTRUTURADO:
{
  "extracted_items": [
    {
      "problem": "Problema em 1 frase clara (máx 150 caracteres)",
      "solution": "Solução objetiva e completa (máx 500 caracteres)",
      "when_to_use": "Quando aplicar esta solução",
      "when_not_to_use": "Quando NÃO aplicar (exceções)",
      "tags": ["tag1", "tag2"],
      "category": "Categoria apropriada (ex: Pagamento, Rastreio, Produto)"
    }
  ],
  "confidence_score": 0-100,
  "reasoning": "Por que você extraiu isso e qual a confiança"
}

Se não houver conhecimento útil, retorne: { "extracted_items": [], "confidence_score": 0, "reasoning": "Motivo" }`;

    // Chamar IA para extrair conhecimento
    console.log('[extract-knowledge] Calling AI to analyze conversation...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: structuredPrompt
          },
          {
            role: 'user',
            content: `Histórico da conversa:\n\n${chatHistory.substring(0, 15000)}`
          }
        ],
        temperature: 0.3, // Baixa temperatura para extração consistente
        max_tokens: 2000,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    let extractedKnowledge;
    
    try {
      const content = aiData.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      extractedKnowledge = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseError) {
      console.error('[extract-knowledge] Parse error:', parseError);
      return new Response(
        JSON.stringify({ success: false, reason: 'parse_error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const items = extractedKnowledge.extracted_items || [];
    const globalConfidence = extractedKnowledge.confidence_score || 0;

    if (items.length === 0) {
      console.log('[extract-knowledge] No useful knowledge extracted');
      return new Response(
        JSON.stringify({ success: false, reason: 'no_knowledge_found', reasoning: extractedKnowledge.reasoning }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🆕 FASE 2: Filtrar itens com confiança muito baixa
    if (globalConfidence < 70) {
      console.log(`[extract-knowledge] Confidence too low: ${globalConfidence}`);
      return new Response(
        JSON.stringify({ success: false, reason: 'low_confidence', confidence: globalConfidence }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[extract-knowledge] Extracted ${items.length} items with confidence ${globalConfidence}`);

    // 🆕 FASE 2: Salvar em knowledge_candidates (NÃO em KB diretamente)
    const savedCandidates = [];
    
    for (const item of items) {
      if (!item.problem || !item.solution) continue;

      const { data: candidate, error: insertError } = await supabase
        .from('knowledge_candidates')
        .insert({
          problem: item.problem.substring(0, 500),
          solution: item.solution.substring(0, 2000),
          when_to_use: item.when_to_use?.substring(0, 500) || null,
          when_not_to_use: item.when_not_to_use?.substring(0, 500) || null,
          category: item.category || 'Aprendizado Passivo',
          tags: item.tags || ['passive_learning'],
          source_conversation_id: conversationId,
          department_id: departmentId || null,
          confidence_score: globalConfidence,
          extracted_by: 'extract-knowledge-from-chat',
          status: 'pending', // 🆕 Sempre como pendente para curadoria
        })
        .select()
        .single();

      if (insertError) {
        console.error('[extract-knowledge] Error saving candidate:', insertError);
      } else {
        savedCandidates.push(candidate);
        console.log(`[extract-knowledge] Candidate saved: ${candidate.id}`);
      }
    }

    // ============================================
    // FASE 6: Registrar na ai_learning_timeline
    // ============================================
    if (savedCandidates.length > 0) {
      await supabase
        .from('ai_learning_timeline')
        .insert({
          learning_type: 'kb',
          summary: `Conhecimento extraído: ${savedCandidates.length} item(s) de conversa com agente ${agentName}`,
          source_conversations: 1,
          source_conversation_ids: [conversationId],
          confidence: globalConfidence >= 85 ? 'alta' : 'média',
          status: isShadowMode ? 'pending' : 'pending', // Sempre pending para revisão humana
          department_id: departmentId || null,
          metadata: { 
            candidate_ids: savedCandidates.map((c: any) => c.id),
            agent_name: agentName,
            confidence_score: globalConfidence,
            shadow_mode: isShadowMode
          }
        });

      console.log(`[extract-knowledge] 📋 Registrado na ai_learning_timeline (Shadow Mode: ${isShadowMode})`);
    }

    // Notificar gerentes sobre novos candidatos
    if (savedCandidates.length > 0) {
      const { data: managers } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'manager', 'support_manager', 'cs_manager']);

      if (managers && managers.length > 0) {
        for (const manager of managers) {
          await supabase.from('notifications').insert({
            user_id: manager.user_id,
            type: 'knowledge_approval',
            title: '🤖 Conhecimento Extraído para Curadoria',
            message: `A IA extraiu ${savedCandidates.length} item(s) do atendimento de ${agentName}. Revise na curadoria.`,
            metadata: {
              candidate_ids: savedCandidates.map(c => c.id),
              conversation_id: conversationId,
              ticket_id: ticketId,
              agent_name: agentName,
              confidence: globalConfidence,
            },
            read: false,
          });
        }
      }
    }

    console.log(`[extract-knowledge] ${savedCandidates.length} candidates saved for curation`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        candidates_created: savedCandidates.length,
        confidence: globalConfidence,
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
