import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getAIConfig, createKillSwitchResponse } from "../_shared/ai-config-cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Prompt ético que NÃO avalia pessoas
const INSIGHTS_PROMPT = `Você é um ANALISTA DE OPERAÇÕES focado em padrões de sistema.

Seu papel é identificar PADRÕES em dados agregados de um sistema de atendimento com IA (Copilot).

REGRAS ABSOLUTAS:
- NUNCA mencione agentes específicos, nomes ou IDs
- NUNCA faça rankings ou comparações entre pessoas
- NUNCA use tom punitivo ou de cobrança
- Foque APENAS em padrões do SISTEMA, não de pessoas
- Seja direto e acionável

Analise os dados e retorne 3-5 insights acionáveis no formato JSON:

{
  "insights": [
    {
      "type": "positive" | "warning" | "opportunity",
      "title": "Título curto do insight (max 50 chars)",
      "description": "Descrição do padrão encontrado (max 120 chars)",
      "action": "Sugestão de ação para melhoria (max 100 chars)"
    }
  ]
}

Exemplos de bons insights:
- "Conversas com uso de 2+ sugestões resolvem 31% mais rápido"
- "Fila de Suporte tem alta criação de KB Gaps → falta cobertura"
- "Categoria de Dúvidas de Pagamento tem CSAT menor sem Copilot"
- "Taxa de adoção cresceu 15% no último mês"
- "Sugestões estão sendo geradas mas pouco usadas → revisar qualidade"

Exemplos de insights PROIBIDOS:
- "O agente João tem baixa adoção" ❌
- "Maria é a melhor em usar sugestões" ❌
- "Cobrar equipe para usar mais IA" ❌
- "Agentes precisam ser mais produtivos" ❌`;

// Prompt mais cauteloso para poucos dados
const CAUTIOUS_PROMPT_SUFFIX = `

ATENÇÃO: A base de dados é pequena (menos de 50 conversas).
- Seja mais cauteloso nas conclusões
- Use palavras como "indica", "sugere", "pode indicar" em vez de afirmações definitivas
- Evite percentuais muito específicos
- Foque em tendências gerais, não em números absolutos`;

interface InsightRequest {
  healthScore: any;
  comparison: any[];
  evolution: any[];
  kbGaps: any[];
}

interface Insight {
  type: "positive" | "warning" | "opportunity";
  title: string;
  description: string;
  action: string;
  confidence: "alta" | "média";
}

// Determina nível de confiança baseado em volume
function getConfidence(totalConversations: number): "alta" | "média" {
  return totalConversations >= 50 ? "alta" : "média";
}

// Gera cache key consistente
function getCacheKey(period: number, departmentId: string | null): string {
  return `${period}_${departmentId || 'null'}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // ============================================
    // FASE 6: Kill Switch (Cached)
    // ============================================
    const aiConfig = await getAIConfig(supabaseClient);

    if (!aiConfig.ai_global_enabled) {
      console.log('[generate-copilot-insights] 🚫 Kill Switch ativo - retornando');
      return new Response(
        JSON.stringify({ 
          status: 'disabled', 
          reason: 'kill_switch',
          ai_global_enabled: false,
          insights: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: InsightRequest = await req.json();
    const { healthScore, comparison, evolution, kbGaps } = body;

    const totalConversations = healthScore?.total_conversations || 0;
    const confidence = getConfidence(totalConversations);
    
    // Extrair período do request (default 30 dias)
    const period = 30;
    const departmentId = null;
    const cacheKey = getCacheKey(period, departmentId);

    console.log(`[generate-copilot-insights] 📊 Verificando cache para key: ${cacheKey}`);

    // 1. Verificar cache
    const { data: cached } = await supabaseClient
      .from('copilot_insights_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached) {
      console.log(`[generate-copilot-insights] ✅ Cache hit! Retornando ${cached.insights.length} insights`);
      return new Response(
        JSON.stringify({ 
          insights: cached.insights.map((i: any) => ({ ...i, confidence: cached.confidence })),
          source: "cache",
          confidence: cached.confidence,
          generatedAt: cached.created_at
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[generate-copilot-insights] 🔄 Cache miss, gerando novos insights");

    // Build context for AI
    const dataContext = `
## Dados do Health Score da Operação (últimos 30 dias)
- Total de conversas: ${totalConversations}
- Conversas com Copilot ativo: ${healthScore?.copilot_active_count || 0}
- Taxa de adoção: ${healthScore?.copilot_adoption_rate || 0}%
- Tempo médio com Copilot: ${healthScore?.avg_resolution_time_with_copilot || 0}s
- Tempo médio sem Copilot: ${healthScore?.avg_resolution_time_without_copilot || 0}s
- Melhoria de eficiência: ${healthScore?.resolution_improvement_percent || 0}%
- CSAT médio com Copilot: ${healthScore?.avg_csat_with_copilot || 0}
- CSAT médio sem Copilot: ${healthScore?.avg_csat_without_copilot || 0}
- Cobertura KB: ${healthScore?.kb_coverage_rate || 0}%
- KB Gaps criados: ${healthScore?.kb_gap_count || 0}
- Sugestões usadas: ${healthScore?.suggestions_used_total || 0}
- Sugestões disponíveis: ${healthScore?.suggestions_available_total || 0}
- Taxa de aproveitamento: ${healthScore?.suggestion_usage_rate || 0}%
- Health Score geral: ${healthScore?.health_score || 0}/100

## Comparativo Com IA vs Sem IA
${JSON.stringify(comparison || [], null, 2)}

## Evolução Mensal (últimos meses)
${JSON.stringify(evolution || [], null, 2)}

## KB Gaps por Categoria
${JSON.stringify(kbGaps || [], null, 2)}
`;

    // Ajustar prompt se poucos dados
    const systemPrompt = confidence === "média" 
      ? INSIGHTS_PROMPT + CAUTIOUS_PROMPT_SUFFIX 
      : INSIGHTS_PROMPT;

    // Call AI to generate insights
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: dataContext },
        ],
        max_completion_tokens: 1000,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      console.error("[generate-copilot-insights] ❌ Erro na chamada AI:", await aiResponse.text());
      
      // Fallback: generate basic insights without AI
      const fallbackInsights = generateFallbackInsights(healthScore, comparison, kbGaps, confidence);
      
      return new Response(
        JSON.stringify({ 
          insights: fallbackInsights,
          source: "fallback",
          confidence,
          generatedAt: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    let insights: Insight[] = [];

    try {
      const parsed = JSON.parse(content || "{}");
      insights = parsed.insights || [];
    } catch (parseError) {
      console.error("[generate-copilot-insights] ⚠️ Erro ao parsear JSON, usando fallback");
      insights = generateFallbackInsights(healthScore, comparison, kbGaps, confidence);
    }

    // Validate and sanitize insights, add confidence
    insights = insights.slice(0, 5).map((insight) => ({
      type: ["positive", "warning", "opportunity"].includes(insight.type) ? insight.type : "opportunity",
      title: String(insight.title || "").slice(0, 60),
      description: String(insight.description || "").slice(0, 150),
      action: String(insight.action || "").slice(0, 120),
      confidence,
    }));

    console.log(`[generate-copilot-insights] ✅ ${insights.length} insights gerados (confiança: ${confidence})`);

    // 3. Salvar no cache
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(); // 12 horas
    
    const { error: cacheError } = await supabaseClient
      .from('copilot_insights_cache')
      .upsert({
        cache_key: cacheKey,
        insights,
        source: 'ai',
        confidence,
        total_conversations: totalConversations,
        created_at: new Date().toISOString(),
        expires_at: expiresAt
      }, { 
        onConflict: 'cache_key' 
      });

    if (cacheError) {
      console.warn("[generate-copilot-insights] ⚠️ Erro ao salvar cache:", cacheError.message);
    } else {
      console.log("[generate-copilot-insights] 💾 Cache salvo com sucesso");
    }

    // 4. Salvar warnings na tabela de auditoria (copilot_insights_events)
    const warnings = insights.filter((i: Insight) => i.type === 'warning');
    
    if (warnings.length > 0) {
      console.log(`[generate-copilot-insights] 📋 Salvando ${warnings.length} warnings para auditoria`);
      
      const { error: auditError } = await supabaseClient
        .from('copilot_insights_events')
        .insert(
          warnings.map((w: Insight) => ({
            insight_type: w.type,
            title: w.title,
            description: w.description,
            action: w.action,
            confidence: w.confidence,
            health_score_at_time: healthScore?.health_score,
            total_conversations_at_time: totalConversations,
            department_id: departmentId,
            source: 'ai',
            health_score_version: 'v1'
          }))
        );

      if (auditError) {
        console.warn("[generate-copilot-insights] ⚠️ Erro ao salvar auditoria:", auditError.message);
      } else {
        console.log("[generate-copilot-insights] ✅ Warnings salvos para auditoria");
      }
    }

    return new Response(
      JSON.stringify({ 
        insights,
        source: "ai",
        confidence,
        generatedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[generate-copilot-insights] ❌ Erro:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Fallback insights when AI is unavailable
function generateFallbackInsights(
  healthScore: any, 
  comparison: any[], 
  kbGaps: any[], 
  confidence: "alta" | "média"
): Insight[] {
  const insights: Insight[] = [];
  const prefix = confidence === "média" ? "indica " : "";

  // Insight 1: Adoption rate
  const adoptionRate = healthScore?.copilot_adoption_rate || 0;
  if (adoptionRate >= 70) {
    insights.push({
      type: "positive",
      title: "Alta adoção do Copilot",
      description: `${prefix}${adoptionRate}% das conversas utilizam o assistente IA`,
      action: "Continue promovendo as melhores práticas da equipe",
      confidence,
    });
  } else if (adoptionRate >= 40) {
    insights.push({
      type: "opportunity",
      title: "Adoção do Copilot pode melhorar",
      description: `${prefix}${adoptionRate}% de adoção — há espaço para crescimento`,
      action: "Identifique barreiras e promova treinamentos",
      confidence,
    });
  } else {
    insights.push({
      type: "warning",
      title: "Baixa adoção do Copilot",
      description: `${prefix}Apenas ${adoptionRate}% das conversas usam IA`,
      action: "Investigue motivos e promova benefícios do assistente",
      confidence,
    });
  }

  // Insight 2: Resolution time
  const resWithCopilot = healthScore?.avg_resolution_time_with_copilot || 0;
  const resWithoutCopilot = healthScore?.avg_resolution_time_without_copilot || 0;
  if (resWithCopilot > 0 && resWithoutCopilot > resWithCopilot) {
    const improvement = Math.round(((resWithoutCopilot - resWithCopilot) / resWithoutCopilot) * 100);
    insights.push({
      type: "positive",
      title: "Copilot acelera resoluções",
      description: `${prefix}Conversas com IA resolvem ${improvement}% mais rápido`,
      action: "Considere expandir uso para outras filas",
      confidence,
    });
  }

  // Insight 3: KB Gaps
  const gapCount = healthScore?.kb_gap_count || 0;
  if (gapCount > 10) {
    const topGap = kbGaps?.[0];
    insights.push({
      type: "warning",
      title: "Alta criação de KB Gaps",
      description: `${prefix}${gapCount} gaps identificados${topGap ? ` — categoria "${topGap.category}" lidera` : ""}`,
      action: "Priorize criação de artigos para categorias com mais gaps",
      confidence,
    });
  } else if (gapCount > 0) {
    insights.push({
      type: "opportunity",
      title: "Oportunidade de expandir KB",
      description: `${prefix}${gapCount} gaps podem virar novos artigos`,
      action: "Revise sugestões de artigos no painel de KB",
      confidence,
    });
  }

  // Insight 4: Suggestion usage
  const usageRate = healthScore?.suggestion_usage_rate || 0;
  if (usageRate < 30 && healthScore?.suggestions_available_total > 0) {
    insights.push({
      type: "opportunity",
      title: "Sugestões pouco utilizadas",
      description: `${prefix}Apenas ${usageRate}% das sugestões são aproveitadas`,
      action: "Avalie qualidade das sugestões e relevância do contexto",
      confidence,
    });
  }

  return insights.slice(0, 5);
}
