

# Upgrade: Aprendizado Passivo com Aprovação Humana

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Estado Atual

O pipeline base **já existe e funciona**:
- `passive-learning-cron` seleciona conversas fechadas com CSAT >= 4
- `extract-knowledge-from-chat` gera candidatos com status `pending`
- `/knowledge/curation` (KnowledgeCuration.tsx) permite Aprovar / Editar+Aprovar / Rejeitar
- `useApproveCandidate` cria artigo na KB + gera embedding
- Guard-rails: Kill Switch, Shadow Mode, `learned_at`, dedup por metadata

## O que falta (upgrades do plano)

### 1. Migração: Adicionar colunas de segurança na `knowledge_candidates`

Campos novos:
- `contains_pii` (boolean, default false) -- flag de PII detectado
- `risk_level` (text, default 'low', check in low/medium/high) -- nível de risco
- `duplicate_of` (uuid, nullable, FK para knowledge_articles) -- artigo similar
- `clarity_score` (integer, nullable) -- pontuação de clareza
- `completeness_score` (integer, nullable) -- pontuação de completude
- `evidence_snippets` (jsonb, default '[]') -- trechos de evidência da conversa
- `sanitized_solution` (text, nullable) -- versão sanitizada sugerida pela IA

### 2. Upgrade na Edge Function `extract-knowledge-from-chat`

Adicionar ao prompt de extração:
- Detecção de PII (CPF, telefone, email, endereço) com flag `contains_pii`
- Classificação de `risk_level` (low/medium/high)
- Extração de `evidence_snippets` (2-3 mensagens relevantes)
- Scores de `clarity_score` e `completeness_score`
- Se PII detectado, gerar `sanitized_solution` (versão limpa)

Adicionar busca por duplicatas via embedding similarity contra artigos existentes (se disponivel) ou por texto, salvando `duplicate_of`.

### 3. Upgrade na UI de Curadoria (`KnowledgeCuration.tsx`)

Melhorias no card do candidato:
- Badges de PII warning (vermelho) e risk_level (colorido)
- Seção de "Trechos de Evidência" (evidence_snippets)
- Se `contains_pii = true`, mostrar alerta + botao para usar versão sanitizada
- Se `duplicate_of` preenchido, mostrar link "Artigo similar: X" com opção de atualizar em vez de criar novo
- Ordenação default: risk_level ASC, created_at DESC
- Scores de clareza/completude visíveis

Adicionar filtros:
- Por risk_level
- Por contains_pii
- Por categoria

### 4. Upgrade no hook `useKnowledgeCandidates`

- Incluir novos campos na query (contains_pii, risk_level, duplicate_of, evidence_snippets, clarity_score, completeness_score, sanitized_solution)
- Adicionar parâmetros de ordenação e filtro

### 5. Regra de bloqueio de aprovação

No `useApproveCandidate`:
- Se `contains_pii = true` e solução não foi editada, bloquear aprovação direta (forçar "Editar e Aprovar")
- Se `risk_level = 'high'`, exigir confirmação extra

## Fora do escopo (não altera)
- Pipeline do CRON (já funciona)
- Kill Switch / Shadow Mode (já implementados)
- Fluxo de embedding pós-aprovação (já existe)
- Notificações para gerentes (já existe)

## Impacto
- Zero regressão: campos novos são nullable/default, código existente continua funcionando
- Upgrade puro: mais informação para o curador, mais segurança contra PII

## Sequência de implementação
1. Migração SQL (novos campos)
2. Upgrade da edge function (extração enriquecida)
3. Upgrade dos hooks (query + approve)
4. Upgrade da UI (cards + filtros + bloqueios)

