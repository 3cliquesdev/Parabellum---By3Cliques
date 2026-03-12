import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[generate-sales-insights] Iniciando geração de insights...');

    // Extrair parâmetros de período do body
    const { startDate, endDate } = await req.json().catch(() => ({}));
    console.log('[generate-sales-insights] Período recebido:', { startDate, endDate });

    // Criar cliente Supabase com service role para buscar dados
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar dados de vendas com filtro de período
    let dealsQuery = supabase
      .from('deals')
      .select('status, value, created_at, closed_at, stage_id, stages(name)');
    
    if (startDate) {
      dealsQuery = dealsQuery.gte('created_at', startDate);
    }
    if (endDate) {
      dealsQuery = dealsQuery.lte('created_at', endDate);
    }

    const { data: deals, error: dealsError } = await dealsQuery;

    if (dealsError) {
      console.error('[generate-sales-insights] Erro ao buscar deals:', dealsError);
      throw dealsError;
    }

    // Calcular métricas
    const totalDeals = deals.length;
    const openDeals = deals.filter(d => d.status === 'open').length;
    const wonDeals = deals.filter(d => d.status === 'won').length;
    const lostDeals = deals.filter(d => d.status === 'lost').length;
    const finalizedDeals = wonDeals + lostDeals;
    const conversionRate = finalizedDeals > 0 ? parseFloat(((wonDeals / finalizedDeals) * 100).toFixed(1)) : 0;
    const totalValue = deals.filter(d => d.status === 'won').reduce((sum, d) => sum + (d.value || 0), 0);
    const avgDealValue = wonDeals > 0 ? parseFloat((totalValue / wonDeals).toFixed(0)) : 0;

    // Buscar dados de conversão dos últimos 30 dias
    const { data: conversionData, error: conversionError } = await supabase.rpc('get_conversion_rate_timeline', {
      p_days_back: 30,
    });

    if (conversionError) {
      console.error('[generate-sales-insights] Erro ao buscar timeline de conversão:', conversionError);
    }

    const recentConversionTrend = conversionData && conversionData.length > 0
      ? parseFloat((conversionData[conversionData.length - 1].conversion_rate - conversionData[0].conversion_rate).toFixed(1))
      : 0;

    console.log('[generate-sales-insights] Métricas calculadas:', {
      totalDeals,
      openDeals,
      wonDeals,
      lostDeals,
      conversionRate,
      totalValue,
      avgDealValue,
      recentConversionTrend,
    });

    // Preparar prompt para IA
    const prompt = `Você é um analista de vendas especializado em CRM. Analise os dados abaixo e gere insights concisos e acionáveis sobre a performance de vendas.

DADOS:
- Total de negócios: ${totalDeals}
- Negócios em aberto: ${openDeals}
- Negócios ganhos: ${wonDeals}
- Negócios perdidos: ${lostDeals}
- Taxa de conversão: ${conversionRate}%
- Valor total ganho: R$ ${totalValue.toLocaleString('pt-BR')}
- Ticket médio: R$ ${avgDealValue.toLocaleString('pt-BR')}
- Tendência de conversão (últimos 30 dias): ${recentConversionTrend}%

INSTRUÇÕES:
1. Identifique 2-3 insights principais sobre a performance
2. Destaque pontos positivos e áreas de atenção
3. Seja direto e objetivo (máximo 4 frases)
4. Use linguagem clara e profissional
5. Não use markdown, apenas texto simples

Responda APENAS com os insights, sem introdução ou conclusão.`;

    let insights = '';
    let aiProvider = 'fallback';

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (openaiApiKey) {
      try {
        console.log('[generate-sales-insights] Chamando OpenAI...');
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Você é um analista de vendas especializado em CRM.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 300,
          }),
        });

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          insights = openaiData.choices[0].message.content;
          aiProvider = 'openai';
          console.log('[generate-sales-insights] ✅ Insights gerados via OpenAI');
        } else {
          const errorText = await openaiResponse.text();
          console.warn('[generate-sales-insights] OpenAI falhou:', openaiResponse.status, errorText);
        }
      } catch (openaiError) {
        console.warn('[generate-sales-insights] Erro ao chamar OpenAI:', openaiError);
      }
    }

    // Fallback baseado em métricas (se OpenAI falhou)
    if (!insights) {
      console.log('[generate-sales-insights] 📊 Usando fallback baseado em métricas');
      insights = `Performance de vendas no período: ${totalDeals} negócios totais, com ${wonDeals} ganhos (${conversionRate}% de conversão) gerando R$ ${totalValue.toLocaleString('pt-BR')} em receita. Ticket médio de R$ ${avgDealValue.toLocaleString('pt-BR')}. ${recentConversionTrend > 0 ? `Tendência positiva de +${recentConversionTrend}% nos últimos 30 dias` : recentConversionTrend < 0 ? `Atenção: tendência negativa de ${recentConversionTrend}% nos últimos 30 dias` : 'Conversão estável nos últimos 30 dias'}.`;
      aiProvider = 'fallback';
    }

    return new Response(
      JSON.stringify({
        insights,
        metrics: {
          totalDeals,
          openDeals,
          wonDeals,
          lostDeals,
          conversionRate,
          totalValue,
          avgDealValue,
          recentConversionTrend,
        },
        generatedAt: new Date().toISOString(),
        aiProvider, // 'openai', 'lovable', ou 'fallback'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[generate-sales-insights] Erro fatal:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
