

# Upgrade: Pipeline Comercial + Performance Mensal no ai-governor

## O que muda

### 1. Nova query: Leads novos no pipeline (deals abertos criados hoje)
Em `collectSalesMetrics`, após a query de won deals, adicionar consulta de deals `status='open'` criados no período, classificados por fonte (Formulário, WhatsApp, WebChat, Kiwify, Outro).

### 2. Nova query: Performance do time comercial no MÊS
Query de deals won no mês com `assigned_to` nos `commercialRepsIds`, agrupados por rep com nome do perfil — ranking mensal separado do ranking diário existente.

### 3. Return ampliado
Adicionar `newLeadsToday`, `topNewSources`, `topRepsMonth` ao retorno de `collectSalesMetrics`.

### 4. Alerta comercial mais inteligente (linha 232)
Substituir alerta genérico por versão que considera performance mensal: se zero no mês → alerta forte; se zero hoje mas tem no mês → alerta moderado.

### 5. WhatsApp: novas seções
- `📥 NOVOS LEADS HOJE (pipeline)` com breakdown por fonte
- `👥 TIME COMERCIAL (mês)` com ranking mensal (substitui o ranking diário atual)

### 6. Email: novas seções HTML
- Seção Pipeline Leads com cards por fonte
- Seção Time Comercial Mês com tabela ranking mensal

### 7. Prompt da IA: contexto adicional
Adicionar dados de pipeline comercial e performance mensal do time ao prompt para análise mais completa.

## Arquivo modificado
`supabase/functions/ai-governor/index.ts` — único arquivo, upgrade puro, sem mudanças em tabelas/RLS.

## Impacto
- Zero regressão: todas as métricas existentes continuam inalteradas
- Dados adicionais enriquecem o relatório sem remover nada
- O `topReps` (diário) continua existindo; `topRepsMonth` é complementar

