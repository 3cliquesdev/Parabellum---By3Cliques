

# Plano de Ajustes Finos — Fase 5 (Produção-Ready)

## Resumo Executivo

Este plano implementa 3 ajustes finos para aumentar transparência, confiabilidade e eficiência da Fase 5:

- **Ajuste A**: Health Score explicável — componentes individuais retornados pelo RPC
- **Ajuste B**: Insights com nível de confiança — indicador determinístico de volume de dados
- **Ajuste C**: Cache inteligente dos Insights — evitar custos e inconsistências

---

## Diagnóstico do Estado Atual

| Ajuste | Status | Impacto |
|--------|--------|---------|
| Health Score explicável | ❌ Falta | Gestor não sabe por que score é X e não Y |
| Confiança nos insights | ❌ Falta | Insights "fortes" em bases pequenas |
| Cache de insights | ❌ Falta | Custo desnecessário e mudanças frequentes |

---

## Alterações Detalhadas

### Ajuste A — Health Score Explicável

**Objetivo**: Retornar os 4 componentes individuais do score (cada um vale 0-25 pts)

**Migração SQL** — Atualizar RPC `get_copilot_health_score`:

```sql
-- Adicionar colunas de componentes na RETURNS TABLE:
adoption_component NUMERIC,    -- 0-25 pts
kb_component NUMERIC,          -- 0-25 pts
csat_component NUMERIC,        -- 0-25 pts
usage_component NUMERIC,       -- 0-25 pts
data_quality TEXT              -- 'alta' | 'média' | 'baixa'

-- Cálculo individual (já existe, só expor):
adoption_component = (adoption_rate / 100) * 25
kb_component = (kb_coverage_rate / 100) * 25
csat_component = (csat_normalizado / 100) * 25
usage_component = (suggestion_usage_rate / 100) * 25

-- data_quality baseado em volume:
-- 'alta' = total_conversations >= 100
-- 'média' = total_conversations >= 30
-- 'baixa' = total_conversations < 30
```

**Frontend** — Atualizar `HealthScoreGauge.tsx`:

Adicionar breakdown abaixo do gauge:

```text
Health Score: 72
├ Adoção IA: 18 pts
├ Cobertura KB: 17 pts
├ CSAT: 19 pts
└ Aproveitamento: 18 pts
```

Se `data_quality = 'baixa'`, mostrar aviso:

```text
⚠️ Poucos dados — score pode não refletir tendência real
```

**Atualizar interface TypeScript**:

```typescript
interface CopilotHealthScore {
  // ... campos existentes ...
  adoption_component: number;
  kb_component: number;
  csat_component: number;
  usage_component: number;
  data_quality: 'alta' | 'média' | 'baixa';
}
```

---

### Ajuste B — Insights com Nível de Confiança

**Objetivo**: Cada insight indica se tem volume suficiente para ser confiável

**Lógica (determinística, fora da IA)**:

```typescript
// Regra simples baseada em volume:
const getConfidence = (totalConversations: number): 'alta' | 'média' => {
  return totalConversations >= 50 ? 'alta' : 'média';
};
```

**Edge Function** — Atualizar `generate-copilot-insights`:

1. Calcular confiança ANTES de enviar para IA
2. Adicionar campo `confidence` ao retorno
3. Se poucos dados, ajustar prompt para IA ser mais cautelosa

```typescript
interface Insight {
  type: 'positive' | 'warning' | 'opportunity';
  title: string;
  description: string;
  action: string;
  confidence: 'alta' | 'média';  // NOVO
}
```

**Frontend** — Atualizar `CopilotInsightsCard.tsx`:

Mostrar badge de confiança ao lado do tipo:

```text
[Positivo] [Confiança: Alta] Alta adoção do Copilot
```

Se confiança = 'média', mostrar tooltip:

```text
"Baseado em volume limitado de dados. Aguarde mais conversas para maior precisão."
```

---

### Ajuste C — Cache Inteligente dos Insights

**Objetivo**: Evitar regenerar insights a cada refresh

**Estratégia**:

1. Criar tabela `copilot_insights_cache`
2. Chave: `period + department_id`
3. TTL: 12 horas
4. Invalidar: manualmente ou quando período muda

**Migração SQL**:

```sql
CREATE TABLE IF NOT EXISTS public.copilot_insights_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,         -- "30_null" ou "30_dept-uuid"
  insights JSONB NOT NULL,
  source TEXT DEFAULT 'ai',
  confidence TEXT DEFAULT 'alta',
  total_conversations INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '12 hours')
);

-- RLS: apenas leitura autenticada
ALTER TABLE copilot_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cache"
  ON copilot_insights_cache FOR SELECT
  TO authenticated
  USING (true);

-- Índice para busca por cache_key
CREATE INDEX idx_insights_cache_key ON copilot_insights_cache(cache_key);

-- Função para limpar cache expirado
CREATE OR REPLACE FUNCTION cleanup_expired_insights_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM copilot_insights_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;
```

**Edge Function** — Atualizar lógica:

```typescript
// 1. Verificar cache
const cacheKey = `${period}_${departmentId || 'null'}`;
const { data: cached } = await supabase
  .from('copilot_insights_cache')
  .select('*')
  .eq('cache_key', cacheKey)
  .gt('expires_at', new Date().toISOString())
  .maybeSingle();

if (cached) {
  return { insights: cached.insights, source: 'cache', confidence: cached.confidence };
}

// 2. Gerar novos insights
const insights = await generateWithAI(...);

// 3. Salvar no cache
await supabase.from('copilot_insights_cache').upsert({
  cache_key: cacheKey,
  insights,
  source: 'ai',
  confidence,
  total_conversations: healthScore.total_conversations,
  expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
}, { onConflict: 'cache_key' });
```

**Frontend** — Indicar fonte do insight:

```typescript
// No CopilotInsightsCard, mostrar badge:
{source === 'cache' && (
  <Badge variant="outline" className="text-xs">
    Cache
  </Badge>
)}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Migração SQL | Criar | Atualizar RPC + criar tabela de cache |
| `src/hooks/useCopilotHealthScore.tsx` | Modificar | Adicionar novos campos na interface |
| `src/components/copilot/HealthScoreGauge.tsx` | Modificar | Mostrar breakdown de componentes |
| `supabase/functions/generate-copilot-insights/index.ts` | Modificar | Adicionar cache e confiança |
| `src/hooks/useCopilotInsights.tsx` | Modificar | Atualizar interface com confidence |
| `src/components/copilot/CopilotInsightsCard.tsx` | Modificar | Mostrar badges de confiança e cache |

---

## Seção Técnica

### Nova Interface TypeScript — CopilotHealthScore

```typescript
export interface CopilotHealthScore {
  // Métricas existentes
  total_conversations: number;
  copilot_active_count: number;
  copilot_adoption_rate: number;
  // ... outras métricas ...
  health_score: number;
  
  // NOVOS: Componentes explicáveis
  adoption_component: number;    // 0-25
  kb_component: number;          // 0-25
  csat_component: number;        // 0-25
  usage_component: number;       // 0-25
  data_quality: 'alta' | 'média' | 'baixa';
}
```

### Nova Interface TypeScript — CopilotInsight

```typescript
export interface CopilotInsight {
  type: 'positive' | 'warning' | 'opportunity';
  title: string;
  description: string;
  action: string;
  confidence: 'alta' | 'média';  // NOVO
}

export interface InsightsResponse {
  insights: CopilotInsight[];
  source: 'ai' | 'cache' | 'fallback';
  confidence: 'alta' | 'média';
  generatedAt: string;
}
```

### Fórmula do Health Score (Explicável)

```text
Health Score = adoption_component + kb_component + csat_component + usage_component

Onde:
├ adoption_component = (copilot_adoption_rate / 100) × 25
├ kb_component = (kb_coverage_rate / 100) × 25
├ csat_component = (CSAT_normalizado / 100) × 25  [CSAT × 20]
└ usage_component = (suggestion_usage_rate / 100) × 25
```

### Lógica de Data Quality

```sql
CASE 
  WHEN total >= 100 THEN 'alta'
  WHEN total >= 30 THEN 'média'
  ELSE 'baixa'
END as data_quality
```

---

## Critérios de Aceitação

| Teste | Resultado Esperado |
|-------|-------------------|
| Ver Health Score | ✅ Mostra breakdown: Adoção X pts, KB Y pts... |
| Score com poucos dados | ✅ Aviso de "data_quality = baixa" |
| Insight com volume alto | ✅ Badge "Confiança: Alta" |
| Insight com pouco volume | ✅ Badge "Confiança: Média" + tooltip |
| Refresh rápido (<12h) | ✅ Usa cache, não chama IA |
| Mudar período | ✅ Invalida cache, gera novo |
| Badge de cache | ✅ Mostra "Cache" quando aplicável |

---

## Ordem de Implementação

1. **Migração SQL**: Atualizar RPC + criar tabela cache
2. **Frontend**: Atualizar interfaces TypeScript
3. **Backend**: Atualizar edge function com cache e confiança
4. **Frontend**: Atualizar HealthScoreGauge com breakdown
5. **Frontend**: Atualizar CopilotInsightsCard com badges
6. **Deploy**: Publicar edge functions
7. **Teste**: Validar todos os critérios

---

## Resultado Esperado

**Antes**:
> "Health Score: 68 — por que não 75?"

**Depois**:
> "Health Score: 68 = Adoção 17pts + KB 18pts + CSAT 16pts + Uso 17pts"

**Antes**:
> Insights mudam a cada refresh, custando tokens

**Depois**:
> Cache de 12h, custo reduzido em ~90%

**Antes**:
> Insight "forte" baseado em 10 conversas

**Depois**:
> Badge "Confiança: Média" + tooltip explicativo

