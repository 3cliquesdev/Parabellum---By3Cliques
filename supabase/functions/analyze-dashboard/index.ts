import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { metricsData, context, startDate, endDate } = await req.json();

    console.log(`[analyze-dashboard] Context: ${context}, Period: ${startDate} to ${endDate}`);

    // Enrich data from DB when context is 'support'
    let enrichedData = { ...metricsData };

    if (context === 'support') {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const sb = createClient(supabaseUrl, supabaseKey);

      const [metricsRes, countsRes] = await Promise.all([
        sb.rpc('get_support_metrics_consolidated', { p_start: startDate, p_end: endDate }),
        sb.rpc('get_support_dashboard_counts', { p_start: startDate, p_end: endDate }),
      ]);

      if (metricsRes.data) {
        const m = metricsRes.data as any;
        enrichedData.avgFRT = m.avgFRT ?? m.avgfrt ?? 0;
        enrichedData.avgMTTR = m.avgMTTR ?? m.avgmttr ?? 0;
        enrichedData.avgCSAT = m.avgCSAT ?? m.avgcsat ?? 0;
        enrichedData.totalRatings = m.totalRatings ?? m.totalratings ?? 0;
      }
      if (countsRes.data) {
        const c = countsRes.data as any;
        enrichedData.tickets_open = c.tickets_open ?? 0;
        enrichedData.conversations_total = c.conversations_total ?? 0;
        enrichedData.conversations_closed = c.conversations_closed ?? 0;
        enrichedData.sla_risk = c.sla_risk ?? 0;
      }

      console.log('[analyze-dashboard] Enriched support data:', JSON.stringify(enrichedData));
    }

    const systemPrompts: Record<string, string> = {
      support: `Você é um Diretor de Operações de Suporte experiente com expertise em SLA, atendimento ao cliente e eficiência operacional. Analise os dados de suporte e forneça insights acionáveis sobre gargalos, tendências e oportunidades de melhoria.`,
      sales: `Você é um Diretor Comercial experiente com expertise em funis de vendas, conversão e performance de equipes. Analise os dados de vendas e identifique oportunidades de crescimento, gargalos no pipeline e estratégias para aumentar a conversão.`,
      ai: `Você é um especialista em IA aplicada a operações de negócios. Analise o uso de automação e inteligência artificial, identificando oportunidades de otimização, economia de custos e áreas onde a IA está gerando mais valor.`,
      onboarding: `Você é um especialista em Customer Success e Onboarding. Analise a jornada de novos clientes, identifique pontos de atrito no onboarding e sugira melhorias para aumentar a taxa de adoção e reduzir time-to-value.`,
      whatsapp: `Você é um especialista em comunicação omnichannel e WhatsApp Business. Analise o tráfego e engajamento no WhatsApp, identifique padrões de comportamento e sugira estratégias para melhorar a experiência do cliente.`,
      financial: `Você é um Diretor Financeiro experiente com expertise em análise de receitas, margem de contribuição e performance de vendas. Analise os dados financeiros e forneça insights sobre tendências de faturamento, sazonalidade e oportunidades de crescimento.`,
    };

    const systemPrompt = systemPrompts[context] || systemPrompts.support;

    const userPrompt = `
# Dados do Dashboard (Período: ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')})

\`\`\`json
${JSON.stringify(enrichedData, null, 2)}
\`\`\`

---

## Sua Tarefa:

Analise profundamente estes dados e forneça uma análise executiva estruturada em **Markdown** seguindo este formato:

### 📊 Tendência Geral
- Identifique se os números estão melhorando, piorando ou estagnados.
- Use dados concretos para sustentar sua análise.

### ⚠️ Gargalos Identificados
- Aponte os principais problemas ou pontos de atenção.
- Seja específico sobre onde está o problema.

### 💡 Sugestões Práticas
- Dê recomendações acionáveis e específicas.
- Priorize ações de alto impacto que a equipe pode implementar imediatamente.

---

**Importante:**
- Seja direto e use bullet points.
- Use emojis para destacar pontos-chave.
- Mantenha um tom profissional mas acessível.
- Se os dados estiverem incompletos ou insuficientes, mencione isso.
`;

    let analysis: string | null = null;

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    console.log('[analyze-dashboard] Chamando OpenAI...');
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_completion_tokens: 1500,
      }),
    });

    if (openaiResponse.ok) {
      const data = await openaiResponse.json();
      analysis = data.choices?.[0]?.message?.content;
      if (analysis) {
        console.log('[analyze-dashboard] ✅ Análise gerada via OpenAI');
      }
    } else {
      const errorText = await openaiResponse.text();
      console.error('[analyze-dashboard] OpenAI falhou:', openaiResponse.status, errorText);
      throw new Error(`OpenAI error: ${openaiResponse.status}`);
    }

    if (!analysis) {
      throw new Error('Não foi possível gerar análise');
    }

    return new Response(
      JSON.stringify({ analysis }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[analyze-dashboard] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
