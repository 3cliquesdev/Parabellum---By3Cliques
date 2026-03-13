import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// PROMPT OBSERVADOR - FASE 3: IA Silenciosa / Copiloto Interno
// ============================================================
const OBSERVER_PROMPT = `Você é um ANALISTA INTERNO DE ATENDIMENTO.
Seu papel é OBSERVAR conversas e GERAR SUGESTÕES para agentes humanos.

⚠️ REGRAS ABSOLUTAS (NUNCA QUEBRE):
- Você NÃO fala com o cliente.
- Você NÃO envia mensagens.
- Você NÃO executa ações.
- Você NÃO altera status de conversa.
- Você NÃO cria tickets, fluxos ou decisões.
- Você NÃO decide nada sozinho.

Você APENAS:
1. Sugere respostas para o agente
2. Identifica lacunas de conhecimento (KB Gap)
3. Classifica o tipo de problema para fins analíticos

---

## 📥 CONTEXTO DISPONÍVEL
Você receberá:
- Histórico recente da conversa
- Base de Conhecimento APROVADA
- Departamento da conversa
- Status da conversa (aberta ou fechada)

---

## 🎯 OBJETIVOS

### 1️⃣ SUGESTÃO DE RESPOSTA (reply)
Se existir uma resposta clara baseada na KB ou padrão histórico:
- Gere uma sugestão curta e profissional
- Não use emojis
- Não faça perguntas
- Não ofereça opções
- Não mencione processos internos

Formato:
"Explique objetivamente X conforme política Y."

---

### 2️⃣ DETECÇÃO DE LACUNA DE CONHECIMENTO (kb_gap)
Se o problema:
- Aparece no atendimento
- NÃO existe na KB
- Foi resolvido manualmente

Então gere um alerta de lacuna:
"Este tipo de problema não possui artigo na KB."

⚠️ Não invente solução.

---

### 3️⃣ CLASSIFICAÇÃO INTERNA (classification)
Classifique a conversa apenas para relatórios internos.

Exemplos:
- "Rastreio / Logística"
- "Financeiro / Reembolso"
- "Erro de Etiqueta"
- "Configuração Inicial"
- "Exceção Operacional"

---

## 📤 FORMATO DE RESPOSTA (OBRIGATÓRIO)
Responda SEMPRE em JSON válido.

{
  "suggestions": [
    {
      "type": "reply | kb_gap | classification",
      "content": "Texto da sugestão",
      "confidence_score": 0-100
    }
  ]
}

---

## 🛑 RESTRIÇÕES CRÍTICAS
- Se NÃO houver sugestão útil → retorne lista vazia
- NÃO repita informações já existentes na KB
- NÃO gere múltiplas sugestões redundantes
- NÃO seja prolixo
- NÃO explique seu raciocínio
- NÃO use linguagem conversacional

---

## 🧯 FALLBACK OBRIGATÓRIO
Se não houver contribuição clara:

{
  "suggestions": []
}`;

interface SmartReplyRequest {
  conversationId: string;
  maxMessages?: number;
  includeKBSearch?: boolean;
}

interface ObserverSuggestion {
  type: 'reply' | 'kb_gap' | 'classification';
  content: string;
  confidence_score: number;
}

interface ObserverResponse {
  suggestions: ObserverSuggestion[];
}

// ============================================================
// NORMALIZAÇÃO: Calcular system_confidence_score
// Evita que a IA infle scores arbitrariamente
// ============================================================
function calculateSystemConfidence(
  suggestion: ObserverSuggestion, 
  kbContext: string
): number {
  let systemScore = 50; // Base
  
  if (suggestion.type === 'reply') {
    // +30 se KB foi encontrada
    if (kbContext !== 'Nenhum artigo relevante encontrado.') {
      systemScore += 30;
    }
    // +10 se resposta é curta e objetiva (< 200 chars)
    if (suggestion.content.length < 200) {
      systemScore += 10;
    }
    // +10 se não contém perguntas
    if (!suggestion.content.includes('?')) {
      systemScore += 10;
    }
  } else if (suggestion.type === 'kb_gap') {
    // KB Gap sempre score fixo (precisa de revisão humana)
    systemScore = 60;
  } else if (suggestion.type === 'classification') {
    // Classification sempre confiança média
    systemScore = 70;
  }
  
  return Math.min(100, systemScore);
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

    const { conversationId, maxMessages = 15, includeKBSearch = true }: SmartReplyRequest = await req.json();
    
    console.log(`[generate-smart-reply] 🧠 Gerando sugestões Copilot para conversa ${conversationId}...`);

    // 1. Buscar conversa e verificar modo + cooldown
    const { data: conversation, error: convError } = await supabaseClient
      .from('conversations')
      .select(`
        ai_mode, 
        contact_id, 
        channel,
        department,
        status,
        last_suggestion_at,
        contacts!inner(
          first_name, 
          last_name, 
          company
        )
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('[generate-smart-reply] Conversa não encontrada:', convError);
      return new Response(JSON.stringify({ 
        status: 'silent_fallback',
        suggestions_count: 0,
        suggestions: []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // ============================================================
    // ANTI-SPAM: Verificar cooldown de 60 segundos
    // ============================================================
    const lastSuggestionAt = conversation.last_suggestion_at 
      ? new Date(conversation.last_suggestion_at) 
      : null;
    const now = new Date();
    const COOLDOWN_MS = 60000; // 60 segundos

    if (lastSuggestionAt && (now.getTime() - lastSuggestionAt.getTime()) < COOLDOWN_MS) {
      const secondsRemaining = Math.ceil((COOLDOWN_MS - (now.getTime() - lastSuggestionAt.getTime())) / 1000);
      console.log(`[generate-smart-reply] ⏳ Cooldown ativo (${secondsRemaining}s restantes), ignorando...`);
      return new Response(JSON.stringify({ 
        status: 'skipped', 
        reason: 'cooldown_60s',
        seconds_remaining: secondsRemaining
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
      return new Response(JSON.stringify({ 
        status: 'silent_fallback',
        suggestions_count: 0,
        suggestions: []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Buscar artigos relevantes da KB (busca semântica)
    let kbContext = 'Nenhum artigo relevante encontrado.';
    
    if (includeKBSearch) {
      const lastCustomerMessage = messages.find(m => m.sender_type === 'customer')?.content || '';
      
      if (lastCustomerMessage) {
        // Buscar artigos publicados relevantes
        const { data: articles } = await supabaseClient
          .from('knowledge_articles')
          .select('title, content, category')
          .eq('is_published', true)
          .textSearch('content', lastCustomerMessage.split(' ').slice(0, 5).join(' | '))
          .limit(5);
        
        if (articles && articles.length > 0) {
          kbContext = articles.map(a => 
            `- **${a.title}** (${a.category || 'Geral'}): ${a.content.substring(0, 200)}...`
          ).join('\n');
        }
      }
    }

    // 4. Preparar contexto para IA (ordem cronológica)
    const reversedMessages = [...messages].reverse();
    
    const conversationContext = reversedMessages.map(m => {
      const role = m.sender_type === 'customer' ? 'Cliente' : 
                   m.sender_type === 'agent' ? 'Agente' : 'Sistema';
      return `${role}: ${m.content}`;
    }).join('\n');

    const contact = conversation.contacts as any;
    const contactName = contact?.first_name 
      ? `${contact.first_name} ${contact.last_name || ''}`.trim()
      : 'Cliente';

    // 5. Buscar nome do departamento
    let departmentName = 'Não definido';
    if (conversation.department) {
      const { data: dept } = await supabaseClient
        .from('departments')
        .select('name')
        .eq('id', conversation.department)
        .single();
      if (dept) departmentName = dept.name;
    }

    console.log('[generate-smart-reply] Chamando OpenAI com prompt Observador...');

    // 6. Chamar OpenAI com prompt estruturado
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    const userPrompt = `## Contexto da Conversa (${contactName}):
${conversationContext}

## Base de Conhecimento Disponível:
${kbContext}

## Departamento:
${departmentName}

## Status:
${conversation.status}

Analise e gere suas sugestões em JSON.`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        max_completion_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: 'system', content: OBSERVER_PROMPT },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[generate-smart-reply] Erro na chamada AI:', aiResponse.status, errorText);
      throw new Error(`OpenAI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '{"suggestions":[]}';
    
    console.log('[generate-smart-reply] Resposta bruta da IA:', rawContent.substring(0, 200));

    // 7. Parsear e validar resposta JSON
    let observerResponse: ObserverResponse;
    try {
      observerResponse = JSON.parse(rawContent);
      if (!Array.isArray(observerResponse.suggestions)) {
        observerResponse = { suggestions: [] };
      }
    } catch (parseError) {
      console.error('[generate-smart-reply] Erro ao parsear JSON:', parseError);
      observerResponse = { suggestions: [] };
    }

    console.log(`[generate-smart-reply] Sugestões geradas: ${observerResponse.suggestions.length}`);

    // 8. Salvar sugestões na tabela ai_suggestions
    const savedSuggestions = [];
    
    for (const suggestion of observerResponse.suggestions) {
      // Validar tipo
      if (!['reply', 'kb_gap', 'classification'].includes(suggestion.type)) {
        console.warn('[generate-smart-reply] Tipo inválido ignorado:', suggestion.type);
        continue;
      }

      // ============================================================
      // ANTI-DUPLICIDADE: Limitar 1 classification por conversa
      // ============================================================
      if (suggestion.type === 'classification') {
        const { data: existingClassification } = await supabaseClient
          .from('ai_suggestions')
          .select('id')
          .eq('conversation_id', conversationId)
          .eq('suggestion_type', 'classification')
          .limit(1)
          .maybeSingle();
        
        if (existingClassification) {
          console.log('[generate-smart-reply] ⏭️ Classification já existe, pulando...');
          continue;
        }
        
        // Atualizar timestamp de classificação
        await supabaseClient
          .from('conversations')
          .update({ last_classified_at: new Date().toISOString() })
          .eq('id', conversationId);
      }

      // ============================================================
      // NORMALIZAÇÃO: Calcular score final = MIN(AI, System)
      // ============================================================
      const aiConfidence = Math.min(100, Math.max(0, suggestion.confidence_score || 0));
      const systemConfidence = calculateSystemConfidence(suggestion, kbContext);
      const finalConfidence = Math.min(aiConfidence, systemConfidence);

      const insertData: any = {
        conversation_id: conversationId,
        suggestion_type: suggestion.type,
        confidence_score: finalConfidence,
        used: false,
        context: {
          contact_name: contactName,
          messages_count: messages.length,
          department: departmentName,
          ai_confidence: aiConfidence,
          system_confidence: systemConfidence,
          generated_at: new Date().toISOString()
        }
      };

      // Mapear campos específicos por tipo
      if (suggestion.type === 'reply') {
        insertData.suggested_reply = suggestion.content;
      } else if (suggestion.type === 'kb_gap') {
        insertData.kb_gap_description = suggestion.content;
        insertData.suggested_reply = ''; // Campo obrigatório
      } else if (suggestion.type === 'classification') {
        insertData.classification_label = suggestion.content;
        insertData.suggested_reply = ''; // Campo obrigatório
      }

      const { data: savedSuggestion, error: saveError } = await supabaseClient
        .from('ai_suggestions')
        .insert(insertData)
        .select()
        .single();

      if (saveError) {
        console.error('[generate-smart-reply] Erro ao salvar sugestão:', saveError);
      } else {
        savedSuggestions.push(savedSuggestion);
        console.log(`[generate-smart-reply] ✅ Sugestão ${suggestion.type} salva: ${savedSuggestion.id} (conf: ${finalConfidence}%)`);
      }
    }

    // ============================================================
    // Atualizar timestamp de última sugestão (anti-spam)
    // ============================================================
    await supabaseClient
      .from('conversations')
      .update({ last_suggestion_at: new Date().toISOString() })
      .eq('id', conversationId);

    // ============================================================
    // AJUSTE 3: Registrar suggestions_available para métricas
    // ============================================================
    const replyCount = savedSuggestions.filter(s => s.suggestion_type === 'reply').length;
    
    if (replyCount > 0) {
      // Buscar agente atribuído à conversa
      const { data: convAgent } = await supabaseClient
        .from('conversations')
        .select('assigned_to')
        .eq('id', conversationId)
        .single();

      if (convAgent?.assigned_to) {
        // Buscar registro existente de métricas
        const { data: existingMetric } = await supabaseClient
          .from('agent_quality_metrics')
          .select('id, suggestions_available')
          .eq('conversation_id', conversationId)
          .eq('agent_id', convAgent.assigned_to)
          .maybeSingle();

        // Acumular (soma novas replies ao total existente)
        const currentAvailable = existingMetric?.suggestions_available || 0;
        const newTotal = currentAvailable + replyCount;

        await supabaseClient
          .from('agent_quality_metrics')
          .upsert({
            agent_id: convAgent.assigned_to,
            conversation_id: conversationId,
            suggestions_available: newTotal,
            copilot_active: true,
          }, { 
            onConflict: 'agent_id,conversation_id',
            ignoreDuplicates: false 
          });

        console.log(`[generate-smart-reply] 📊 Métricas atualizadas: suggestions_available = ${newTotal}`);
      }
    }

    console.log(`[generate-smart-reply] ✅ ${savedSuggestions.length} sugestões salvas com sucesso!`);

    return new Response(JSON.stringify({ 
      status: 'success',
      suggestions_count: savedSuggestions.length,
      suggestions: savedSuggestions
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // ============================================================
    // FALHA SILENCIOSA: Log interno apenas, retorno vazio para agente
    // Sempre 200 para não disparar erro no frontend
    // ============================================================
    console.error('[generate-smart-reply] ❌ Erro silenciado:', error);
    
    return new Response(JSON.stringify({ 
      status: 'silent_fallback',
      suggestions_count: 0,
      suggestions: []
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
