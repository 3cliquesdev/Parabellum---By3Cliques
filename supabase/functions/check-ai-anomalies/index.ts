import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Thresholds de anomalia (warning level)
const THRESHOLDS = {
  CSAT_DROP_PERCENT: 15,           // Queda de CSAT > 15%
  RESOLUTION_INCREASE_PERCENT: 25, // Aumento de tempo de resolução > 25%
  ADOPTION_DROP_PERCENT: 30,       // Queda de adoção do Copilot > 30%
};

// Thresholds de severidade (warning vs critical)
const SEVERITY_THRESHOLDS: Record<string, { warning: number; critical: number }> = {
  csat_drop: {
    warning: 15,   // 15-24% = warning
    critical: 25,  // >= 25% = critical
  },
  resolution_increase: {
    warning: 25,   // 25-49% = warning
    critical: 50,  // >= 50% = critical
  },
  adoption_drop: {
    warning: 30,   // 30-49% = warning
    critical: 50,  // >= 50% = critical
  },
};

// Função helper para calcular severidade dinamicamente
function getSeverity(metricType: string, changePercent: number): 'warning' | 'critical' {
  const thresholds = SEVERITY_THRESHOLDS[metricType];
  if (!thresholds) return 'warning';
  
  return changePercent >= thresholds.critical ? 'critical' : 'warning';
}

interface AnomalyResult {
  metric_type: string;
  current_value: number;
  previous_value: number;
  change_percent: number;
  threshold_percent: number;
  severity: 'warning' | 'critical';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[check-ai-anomalies] 🔍 Iniciando verificação de anomalias...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const anomalies: AnomalyResult[] = [];

    // ============================================
    // 1. Verificar CSAT Drop
    // ============================================
    console.log('[check-ai-anomalies] Verificando CSAT...');
    
    const { data: currentCSAT } = await supabaseClient
      .from('conversation_ratings')
      .select('rating')
      .gte('created_at', sevenDaysAgo.toISOString());

    const { data: previousCSAT } = await supabaseClient
      .from('conversation_ratings')
      .select('rating')
      .gte('created_at', fourteenDaysAgo.toISOString())
      .lt('created_at', sevenDaysAgo.toISOString());

    if (currentCSAT && currentCSAT.length > 0 && previousCSAT && previousCSAT.length > 0) {
      const currentAvg = currentCSAT.reduce((sum, r) => sum + r.rating, 0) / currentCSAT.length;
      const previousAvg = previousCSAT.reduce((sum, r) => sum + r.rating, 0) / previousCSAT.length;
      
      if (previousAvg > 0) {
        const changePercent = ((previousAvg - currentAvg) / previousAvg) * 100;
        
        if (changePercent > THRESHOLDS.CSAT_DROP_PERCENT) {
          anomalies.push({
            metric_type: 'csat_drop',
            current_value: Number(currentAvg.toFixed(2)),
            previous_value: Number(previousAvg.toFixed(2)),
            change_percent: Number(changePercent.toFixed(1)),
            threshold_percent: THRESHOLDS.CSAT_DROP_PERCENT,
            severity: getSeverity('csat_drop', changePercent),
          });
          console.log(`[check-ai-anomalies] ⚠️ CSAT drop detectado: ${changePercent.toFixed(1)}% (${getSeverity('csat_drop', changePercent)})`);
        }
      }
    }

    // ============================================
    // 2. Verificar Resolution Time Increase
    // ============================================
    console.log('[check-ai-anomalies] Verificando tempo de resolução...');

    const { data: currentResolution } = await supabaseClient
      .from('conversations')
      .select('created_at, closed_at')
      .eq('status', 'closed')
      .not('closed_at', 'is', null)
      .gte('closed_at', sevenDaysAgo.toISOString());

    const { data: previousResolution } = await supabaseClient
      .from('conversations')
      .select('created_at, closed_at')
      .eq('status', 'closed')
      .not('closed_at', 'is', null)
      .gte('closed_at', fourteenDaysAgo.toISOString())
      .lt('closed_at', sevenDaysAgo.toISOString());

    if (currentResolution && currentResolution.length > 0 && previousResolution && previousResolution.length > 0) {
      const calcAvgMinutes = (convs: Array<{ created_at: string; closed_at: string }>) => {
        const totalMinutes = convs.reduce((sum, c) => {
          const created = new Date(c.created_at).getTime();
          const closed = new Date(c.closed_at).getTime();
          return sum + (closed - created) / (1000 * 60);
        }, 0);
        return totalMinutes / convs.length;
      };

      const currentAvgMinutes = calcAvgMinutes(currentResolution);
      const previousAvgMinutes = calcAvgMinutes(previousResolution);

      if (previousAvgMinutes > 0) {
        const changePercent = ((currentAvgMinutes - previousAvgMinutes) / previousAvgMinutes) * 100;

        if (changePercent > THRESHOLDS.RESOLUTION_INCREASE_PERCENT) {
          anomalies.push({
            metric_type: 'resolution_increase',
            current_value: Number(currentAvgMinutes.toFixed(0)),
            previous_value: Number(previousAvgMinutes.toFixed(0)),
            change_percent: Number(changePercent.toFixed(1)),
            threshold_percent: THRESHOLDS.RESOLUTION_INCREASE_PERCENT,
            severity: getSeverity('resolution_increase', changePercent),
          });
          console.log(`[check-ai-anomalies] ⚠️ Resolution time increase: ${changePercent.toFixed(1)}% (${getSeverity('resolution_increase', changePercent)})`);
        }
      }
    }

    // ============================================
    // 3. Verificar Copilot Adoption Drop
    // ============================================
    console.log('[check-ai-anomalies] Verificando adoção do Copilot...');

    const { data: currentAdoption } = await supabaseClient
      .from('agent_quality_metrics')
      .select('copilot_active')
      .gte('created_at', sevenDaysAgo.toISOString());

    const { data: previousAdoption } = await supabaseClient
      .from('agent_quality_metrics')
      .select('copilot_active')
      .gte('created_at', fourteenDaysAgo.toISOString())
      .lt('created_at', sevenDaysAgo.toISOString());

    if (currentAdoption && currentAdoption.length > 0 && previousAdoption && previousAdoption.length > 0) {
      const currentRate = (currentAdoption.filter(a => a.copilot_active).length / currentAdoption.length) * 100;
      const previousRate = (previousAdoption.filter(a => a.copilot_active).length / previousAdoption.length) * 100;

      if (previousRate > 0) {
        const changePercent = ((previousRate - currentRate) / previousRate) * 100;

        if (changePercent > THRESHOLDS.ADOPTION_DROP_PERCENT) {
          anomalies.push({
            metric_type: 'adoption_drop',
            current_value: Number(currentRate.toFixed(1)),
            previous_value: Number(previousRate.toFixed(1)),
            change_percent: Number(changePercent.toFixed(1)),
            threshold_percent: THRESHOLDS.ADOPTION_DROP_PERCENT,
            severity: getSeverity('adoption_drop', changePercent),
          });
          console.log(`[check-ai-anomalies] ⚠️ Adoption drop: ${changePercent.toFixed(1)}% (${getSeverity('adoption_drop', changePercent)})`);
        }
      }
    }

    // ============================================
    // 4. Registrar anomalias encontradas
    // ============================================
    if (anomalies.length > 0) {
      console.log(`[check-ai-anomalies] 🚨 ${anomalies.length} anomalias detectadas!`);

      // Inserir em ai_anomaly_logs
      const { error: insertError } = await supabaseClient
        .from('ai_anomaly_logs')
        .insert(anomalies);

      if (insertError) {
        console.error('[check-ai-anomalies] Erro ao inserir anomalias:', insertError);
      }

      // Criar alertas administrativos
      for (const anomaly of anomalies) {
        const alertTitle = getAlertTitle(anomaly.metric_type);
        const alertMessage = `${alertTitle}: variação de ${anomaly.change_percent}% detectada (threshold: ${anomaly.threshold_percent}%)`;

        await supabaseClient
          .from('admin_alerts')
          .insert({
            title: alertTitle,
            message: alertMessage,
            type: anomaly.severity === 'critical' ? 'error' : 'warning',
            metadata: anomaly,
          });
      }

      console.log('[check-ai-anomalies] ✅ Anomalias registradas e alertas criados');
    } else {
      console.log('[check-ai-anomalies] ✅ Nenhuma anomalia detectada');
    }

    return new Response(
      JSON.stringify({
        success: true,
        anomalies_detected: anomalies.length,
        anomalies,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-ai-anomalies] ❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getAlertTitle(metricType: string): string {
  switch (metricType) {
    case 'csat_drop':
      return '📉 Queda de CSAT detectada';
    case 'resolution_increase':
      return '⏱️ Aumento no tempo de resolução';
    case 'adoption_drop':
      return '📊 Queda na adoção do Copilot';
    default:
      return '⚠️ Anomalia de IA detectada';
  }
}
