
# Plano de Implementação: Fase 5B + 5C — Health Score da Operação e Insights Acionáveis

## Resumo Executivo

Esta fase implementa dois módulos complementares:
- **Fase 5B**: Health Score da Operação (agregado, não individual) — métricas de saúde do sistema
- **Fase 5C**: Insights Acionáveis — padrões resumidos pela IA sem avaliação de pessoas

---

## Diagnóstico do Estado Atual

| Componente | Status | Observação |
|------------|--------|------------|
| `agent_quality_metrics` | ✅ Existe | Base para agregação |
| `AgentQualityDashboard` | ✅ Existe | `/reports/quality` - foco em agentes |
| Página `/reports/impact` | ❌ Não existe | Precisa criar |
| Views SQL de correlação | ❌ Não existem | Precisa criar |
| Gráficos comparativos | ❌ Não existem | Precisa criar |
| Insights via IA | ❌ Não existe | Precisa criar |

---

## Arquitetura da Solução

### Fase 5B — Health Score da Operação

```text
┌─────────────────────────────────────────────────────────────────────┐
│                   agent_quality_metrics                              │
│  (copilot_active, suggestions_used, resolution_time, csat...)       │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Views SQL de Agregação (Período/Fila)                   │
│  - v_copilot_health_score                                           │
│  - v_copilot_impact_comparison                                      │
│  - v_kb_coverage_by_category                                        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   CopilotImpactDashboard                             │
│  - Health Score geral (gauge)                                       │
│  - Cards: Adoção IA, Eficiência, Cobertura KB, CSAT                 │
│  - Gráfico: Com IA vs Sem IA                                        │
│  - Gráfico: Evolução mensal                                         │
│  - Tabela: KB Gaps por categoria                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Fase 5C — Insights Acionáveis

```text
┌─────────────────────────────────────────────────────────────────────┐
│              Dados Agregados (Views SQL)                             │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Edge Function: generate-copilot-insights                │
│  - Analisa correlações numéricas                                    │
│  - IA resume padrões (sem avaliar pessoas)                          │
│  - Retorna 3-5 insights acionáveis                                  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   CopilotInsightsCard                                │
│  - Cada insight = problema + sugestão                               │
│  - Ex: "Fila X tem alta criação de KB Gaps → falta cobertura"       │
│  - ⚠️ NUNCA menciona agentes específicos                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Alterações Detalhadas

### 1. Migração SQL: Funções RPC de Agregação

Criar funções SQL para calcular métricas agregadas sem expor dados individuais:

```sql
-- ============================================================
-- RPC 1: Health Score Geral da Operação
-- ============================================================
CREATE OR REPLACE FUNCTION get_copilot_health_score(
  p_start_date TIMESTAMPTZ DEFAULT (CURRENT_DATE - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT CURRENT_DATE,
  p_department_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_conversations BIGINT,
  copilot_active_count BIGINT,
  copilot_adoption_rate NUMERIC,
  avg_resolution_time_with_copilot INTEGER,
  avg_resolution_time_without_copilot INTEGER,
  resolution_improvement_percent NUMERIC,
  avg_csat_with_copilot NUMERIC,
  avg_csat_without_copilot NUMERIC,
  csat_improvement_percent NUMERIC,
  kb_gap_count BIGINT,
  kb_coverage_rate NUMERIC,
  suggestions_used_total BIGINT,
  suggestions_available_total BIGINT,
  suggestion_usage_rate NUMERIC,
  health_score NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH metrics AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE copilot_active = true) as active,
      AVG(resolution_time_seconds) FILTER (WHERE copilot_active = true) as res_with,
      AVG(resolution_time_seconds) FILTER (WHERE copilot_active = false OR copilot_active IS NULL) as res_without,
      AVG(csat_rating::numeric) FILTER (WHERE copilot_active = true AND csat_rating IS NOT NULL) as csat_with,
      AVG(csat_rating::numeric) FILTER (WHERE (copilot_active = false OR copilot_active IS NULL) AND csat_rating IS NOT NULL) as csat_without,
      COUNT(*) FILTER (WHERE created_kb_gap = true) as gaps,
      SUM(COALESCE(suggestions_used, 0)) as used,
      SUM(COALESCE(suggestions_available, 0)) as available
    FROM agent_quality_metrics m
    LEFT JOIN conversations c ON m.conversation_id = c.id
    WHERE m.created_at BETWEEN p_start_date AND p_end_date
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
  )
  SELECT
    m.total,
    m.active,
    ROUND(CASE WHEN m.total > 0 THEN (m.active::numeric / m.total) * 100 ELSE 0 END, 1),
    COALESCE(m.res_with, 0)::integer,
    COALESCE(m.res_without, 0)::integer,
    ROUND(CASE WHEN m.res_without > 0 THEN ((m.res_without - m.res_with) / m.res_without) * 100 ELSE 0 END, 1),
    ROUND(COALESCE(m.csat_with, 0), 2),
    ROUND(COALESCE(m.csat_without, 0), 2),
    ROUND(CASE WHEN m.csat_without > 0 THEN ((m.csat_with - m.csat_without) / m.csat_without) * 100 ELSE 0 END, 1),
    m.gaps,
    ROUND(CASE WHEN m.total > 0 THEN ((m.total - m.gaps)::numeric / m.total) * 100 ELSE 100 END, 1),
    m.used,
    m.available,
    ROUND(CASE WHEN m.available > 0 THEN (m.used::numeric / m.available) * 100 ELSE 0 END, 1),
    -- Health Score: média ponderada dos indicadores (0-100)
    ROUND(
      (
        COALESCE(CASE WHEN m.total > 0 THEN (m.active::numeric / m.total) * 100 ELSE 0 END, 0) * 0.25 +
        COALESCE(CASE WHEN m.total > 0 THEN ((m.total - m.gaps)::numeric / m.total) * 100 ELSE 100 END, 0) * 0.25 +
        COALESCE(m.csat_with * 20, 50) * 0.25 +
        COALESCE(CASE WHEN m.available > 0 THEN (m.used::numeric / m.available) * 100 ELSE 0 END, 0) * 0.25
      ), 0
    )
  FROM metrics m;
END;
$$;

-- ============================================================
-- RPC 2: Evolução Mensal do Copilot
-- ============================================================
CREATE OR REPLACE FUNCTION get_copilot_monthly_evolution(
  p_months INTEGER DEFAULT 6,
  p_department_id UUID DEFAULT NULL
)
RETURNS TABLE (
  month TEXT,
  copilot_active_count BIGINT,
  total_conversations BIGINT,
  adoption_rate NUMERIC,
  avg_resolution_time INTEGER,
  avg_csat NUMERIC,
  kb_gaps_created BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(m.created_at, 'Mon/YYYY') as month,
    COUNT(*) FILTER (WHERE m.copilot_active = true),
    COUNT(*),
    ROUND(COUNT(*) FILTER (WHERE m.copilot_active = true)::numeric / NULLIF(COUNT(*), 0) * 100, 1),
    COALESCE(AVG(m.resolution_time_seconds)::integer, 0),
    ROUND(COALESCE(AVG(m.csat_rating::numeric), 0), 2),
    COUNT(*) FILTER (WHERE m.created_kb_gap = true)
  FROM agent_quality_metrics m
  LEFT JOIN conversations c ON m.conversation_id = c.id
  WHERE m.created_at >= (CURRENT_DATE - (p_months || ' months')::interval)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
  GROUP BY TO_CHAR(m.created_at, 'Mon/YYYY'), DATE_TRUNC('month', m.created_at)
  ORDER BY DATE_TRUNC('month', m.created_at);
END;
$$;

-- ============================================================
-- RPC 3: KB Gaps por Categoria (para identificar lacunas)
-- ============================================================
CREATE OR REPLACE FUNCTION get_kb_gaps_by_category(
  p_start_date TIMESTAMPTZ DEFAULT (CURRENT_DATE - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  category TEXT,
  gap_count BIGINT,
  converted_to_article BIGINT,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(m.classification_label, 'Não classificado') as category,
    COUNT(*) FILTER (WHERE m.created_kb_gap = true),
    COUNT(*) FILTER (WHERE m.created_kb_gap = true AND EXISTS (
      SELECT 1 FROM knowledge_articles k 
      WHERE k.draft_from_gap_id IN (
        SELECT a.id FROM ai_suggestions a WHERE a.conversation_id = m.conversation_id
      )
    )),
    ROUND(
      COUNT(*) FILTER (WHERE m.created_kb_gap = true AND EXISTS (
        SELECT 1 FROM knowledge_articles k 
        WHERE k.draft_from_gap_id IN (
          SELECT a.id FROM ai_suggestions a WHERE a.conversation_id = m.conversation_id
        )
      ))::numeric / NULLIF(COUNT(*) FILTER (WHERE m.created_kb_gap = true), 0) * 100
    , 1)
  FROM agent_quality_metrics m
  WHERE m.created_at BETWEEN p_start_date AND p_end_date
    AND m.classification_label IS NOT NULL
  GROUP BY m.classification_label
  ORDER BY COUNT(*) FILTER (WHERE m.created_kb_gap = true) DESC;
END;
$$;

-- ============================================================
-- RPC 4: Comparativo Com IA vs Sem IA
-- ============================================================
CREATE OR REPLACE FUNCTION get_copilot_comparison(
  p_start_date TIMESTAMPTZ DEFAULT (CURRENT_DATE - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  group_label TEXT,
  total_conversations BIGINT,
  avg_resolution_seconds INTEGER,
  avg_csat NUMERIC,
  avg_suggestions_used NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    'Com Copilot'::text,
    COUNT(*),
    COALESCE(AVG(resolution_time_seconds)::integer, 0),
    ROUND(COALESCE(AVG(csat_rating::numeric), 0), 2),
    ROUND(COALESCE(AVG(suggestions_used::numeric), 0), 1)
  FROM agent_quality_metrics
  WHERE created_at BETWEEN p_start_date AND p_end_date
    AND copilot_active = true
  UNION ALL
  SELECT
    'Sem Copilot'::text,
    COUNT(*),
    COALESCE(AVG(resolution_time_seconds)::integer, 0),
    ROUND(COALESCE(AVG(csat_rating::numeric), 0), 2),
    0::numeric
  FROM agent_quality_metrics
  WHERE created_at BETWEEN p_start_date AND p_end_date
    AND (copilot_active = false OR copilot_active IS NULL);
END;
$$;
```

### 2. Edge Function: `generate-copilot-insights` (Nova)

**Arquivo:** `supabase/functions/generate-copilot-insights/index.ts`

```typescript
// Prompt seguro que NÃO avalia pessoas
const INSIGHTS_PROMPT = `Você é um ANALISTA DE OPERAÇÕES.

Seu papel é identificar PADRÕES em dados agregados de um sistema de atendimento com IA.

REGRAS ABSOLUTAS:
- NUNCA mencione agentes específicos ou nomes
- NUNCA faça rankings ou comparações entre pessoas
- NUNCA use tom punitivo ou de cobrança
- Foque APENAS em padrões do SISTEMA, não de pessoas

Analise os dados e retorne 3-5 insights acionáveis no formato JSON:

{
  "insights": [
    {
      "type": "positive" | "warning" | "opportunity",
      "title": "Título curto do insight",
      "description": "Descrição do padrão encontrado",
      "action": "Sugestão de ação para melhoria"
    }
  ]
}

Exemplos de bons insights:
- "Conversas com uso de 2+ sugestões resolvem 31% mais rápido"
- "Fila de Suporte tem alta criação de KB Gaps → falta cobertura"
- "Categoria de Dúvidas de Pagamento tem CSAT menor sem Copilot"
- "Sugestões estão sendo geradas mas pouco usadas → revisar qualidade"

Exemplos de insights PROIBIDOS:
- "O agente João tem baixa adoção" ❌
- "Maria é a melhor em usar sugestões" ❌
- "Cobrar equipe para usar mais IA" ❌`;
```

**Lógica principal:**
- Recebe dados agregados (health score, comparativo, evolução)
- Chama IA para identificar padrões
- Retorna insights sem expor dados individuais

### 3. Hook: `useCopilotHealthScore` (Novo)

**Arquivo:** `src/hooks/useCopilotHealthScore.tsx`

```typescript
export function useCopilotHealthScore(period: number = 30, departmentId?: string) {
  return useQuery({
    queryKey: ['copilot-health-score', period, departmentId],
    queryFn: async () => {
      const startDate = subDays(new Date(), period).toISOString();
      const endDate = new Date().toISOString();
      
      const { data, error } = await supabase.rpc('get_copilot_health_score', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_department_id: departmentId || null
      });
      
      if (error) throw error;
      return data?.[0] || null;
    },
  });
}

export function useCopilotMonthlyEvolution(months: number = 6, departmentId?: string) {
  return useQuery({
    queryKey: ['copilot-monthly-evolution', months, departmentId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_copilot_monthly_evolution', {
        p_months: months,
        p_department_id: departmentId || null
      });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCopilotComparison(period: number = 30) {
  return useQuery({
    queryKey: ['copilot-comparison', period],
    queryFn: async () => {
      const startDate = subDays(new Date(), period).toISOString();
      const endDate = new Date().toISOString();
      
      const { data, error } = await supabase.rpc('get_copilot_comparison', {
        p_start_date: startDate,
        p_end_date: endDate
      });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useKBGapsByCategory(period: number = 30) {
  return useQuery({
    queryKey: ['kb-gaps-by-category', period],
    queryFn: async () => {
      const startDate = subDays(new Date(), period).toISOString();
      const endDate = new Date().toISOString();
      
      const { data, error } = await supabase.rpc('get_kb_gaps_by_category', {
        p_start_date: startDate,
        p_end_date: endDate
      });
      if (error) throw error;
      return data || [];
    },
  });
}
```

### 4. Página: `CopilotImpactDashboard.tsx` (Nova)

**Arquivo:** `src/pages/CopilotImpactDashboard.tsx`

**Estrutura:**

```typescript
export default function CopilotImpactDashboard() {
  return (
    <Layout>
      <div className="container py-6 max-w-7xl">
        {/* Header com filtro de período e departamento */}
        
        {/* Health Score Gauge */}
        <HealthScoreGauge score={healthScore} />
        
        {/* Cards de Indicadores */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <MetricCard title="Adoção IA" value={`${metrics.copilot_adoption_rate}%`} />
          <MetricCard title="Eficiência" value={`-${metrics.resolution_improvement_percent}%`} />
          <MetricCard title="Cobertura KB" value={`${metrics.kb_coverage_rate}%`} />
          <MetricCard title="CSAT Médio" value={metrics.avg_csat_with_copilot} />
          <MetricCard title="Aproveitamento" value={`${metrics.suggestion_usage_rate}%`} />
        </div>
        
        {/* Gráfico: Com IA vs Sem IA */}
        <CopilotComparisonChart />
        
        {/* Gráfico: Evolução Mensal */}
        <MonthlyEvolutionChart />
        
        {/* Tabela: KB Gaps por Categoria */}
        <KBGapsByCategoryTable />
        
        {/* Insights Acionáveis */}
        <CopilotInsightsCard />
        
        {/* Banner ético */}
        <EthicalBanner />
      </div>
    </Layout>
  );
}
```

### 5. Componentes de Visualização

**5.1 HealthScoreGauge.tsx** — Gauge radial mostrando score 0-100

```typescript
// Usando RadialBarChart do recharts
// Score é colorido: 
// - 🔴 < 40 (crítico)
// - 🟡 40-70 (atenção)
// - 🟢 > 70 (saudável)
```

**5.2 CopilotComparisonChart.tsx** — Barras lado a lado

```typescript
// BarChart comparando:
// - Tempo de resolução
// - CSAT médio
// Entre "Com Copilot" vs "Sem Copilot"
```

**5.3 MonthlyEvolutionChart.tsx** — Linha temporal

```typescript
// LineChart mostrando:
// - Taxa de adoção
// - Tempo de resolução
// - CSAT
// Ao longo dos meses
```

**5.4 CopilotInsightsCard.tsx** — Insights gerados

```typescript
// Cards com insights:
// - Ícone por tipo (positive/warning/opportunity)
// - Título + descrição
// - Ação sugerida
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Migração SQL | Criar | RPCs de agregação |
| `supabase/functions/generate-copilot-insights/index.ts` | Criar | Edge function de insights |
| `src/hooks/useCopilotHealthScore.tsx` | Criar | Hooks para métricas agregadas |
| `src/hooks/useCopilotInsights.tsx` | Criar | Hook para insights via IA |
| `src/pages/CopilotImpactDashboard.tsx` | Criar | Página `/reports/impact` |
| `src/components/copilot/HealthScoreGauge.tsx` | Criar | Gauge de health score |
| `src/components/copilot/CopilotComparisonChart.tsx` | Criar | Gráfico comparativo |
| `src/components/copilot/MonthlyEvolutionChart.tsx` | Criar | Gráfico de evolução |
| `src/components/copilot/KBGapsByCategoryTable.tsx` | Criar | Tabela de gaps |
| `src/components/copilot/CopilotInsightsCard.tsx` | Criar | Card de insights |
| `src/App.tsx` | Modificar | Adicionar rota `/reports/impact` |
| `supabase/config.toml` | Modificar | Declarar `generate-copilot-insights` |

---

## Fórmula do Health Score

```text
Health Score = (
  Adoção IA × 0.25 +
  Cobertura KB × 0.25 +
  CSAT Normalizado × 0.25 +
  Aproveitamento IA × 0.25
)

Onde:
- Adoção IA = (conversas com copilot / total) × 100
- Cobertura KB = (conversas sem KB Gap / total) × 100
- CSAT Normalizado = CSAT médio × 20 (escala 1-5 → 0-100)
- Aproveitamento IA = (sugestões usadas / disponíveis) × 100
```

---

## Garantias Éticas (Linha Vermelha)

| Garantia | Implementação |
|----------|---------------|
| IA não avalia pessoas | ✅ Insights só mencionam padrões de sistema |
| Nenhum score individual público | ✅ Dashboard mostra apenas agregados |
| Agentes veem apenas dados próprios | ✅ RLS já implementado |
| Gestores veem agregado | ✅ Funções RPC não expõem agent_id |
| Sem ranking competitivo | ✅ Não há ordenação por performance |
| Métricas para melhoria | ✅ Foco em insights acionáveis |

---

## Critérios de Aceitação

| Teste | Resultado Esperado |
|-------|-------------------|
| Ver Health Score | ✅ Gauge 0-100 com cor |
| Ver impacto do Copilot | ✅ Comparativo claro (Com vs Sem) |
| Ver onde falta KB | ✅ Tabela de KB Gaps por categoria |
| Ver evolução mensal | ✅ Gráfico de tendências |
| Evitar score punitivo | ✅ Sem ranking de agentes |
| Insights acionáveis | ✅ 3-5 padrões identificados |
| Filtrar por período | ✅ 7/14/30/90 dias |
| Filtrar por departamento | ✅ Select com opções |
| Dados auditáveis | ✅ SQL puro, sem magic numbers |

---

## Seção Técnica

### Dependências Utilizadas
- `recharts` (já instalado) — Gráficos
- `@tanstack/react-query` (já instalado) — Cache de dados
- `date-fns` (já instalado) — Manipulação de datas

### Padrões Seguidos
- RPCs SQL para agregação (não expose dados individuais)
- Edge function com prompt seguro (sem avaliação de pessoas)
- Hooks com staleTime adequado (10 min para métricas)
- Componentes reutilizáveis do shadcn/ui

---

## Ordem de Implementação

1. **Migração SQL**: Criar RPCs de agregação
2. **Backend**: Criar `generate-copilot-insights` edge function
3. **Frontend**: Criar hooks de métricas
4. **Frontend**: Criar componentes de visualização
5. **Frontend**: Criar página `CopilotImpactDashboard`
6. **Roteamento**: Adicionar `/reports/impact` no App.tsx
7. **Deploy**: Publicar edge functions + testar
8. **Validação**: Testar garantias éticas

---

## Resultado Esperado

**Antes:**
> "Temos IA e métricas"

**Depois:**
> "Sabemos exatamente onde a IA gera valor, onde não gera e o que melhorar."

Dashboard pronto para:
- Escalar time com dados
- Justificar investimento em IA
- Melhorar cobertura da KB
- Identificar gaps de treinamento
