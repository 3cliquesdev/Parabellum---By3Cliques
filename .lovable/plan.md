

# Plano: Upgrade Anti-Alucinação + Telemetria de IA

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Diagnóstico — O que JÁ existe vs O que FALTA

| Requisito | Status | Detalhe |
|---|---|---|
| Modo Persistente (loop IA) | ✅ Existe | `ai_persistent`, `max_ai_interactions`, `exit_keywords` — motor funcional |
| Score de Confiança | ✅ Existe | `calculateConfidenceScore` com thresholds dinâmicos (direct/cautious/handoff) |
| Modo Estrito Anti-Alucinação | ✅ Existe | `strictMode` filtra artigos < 80% similaridade |
| Prompt "não invente" | ✅ Existe | Regras no prompt: "NUNCA invente", "cite a fonte" |
| Fontes RAG configuráveis | ✅ Existe | `allowedSources` por nó (KB, CRM, tracking, sandbox) |
| Kill Switch | ✅ Existe | `ai_global_enabled = false` bloqueia tudo |
| Tabela `ai_events` | ⚠️ Estrutura existe | Tabela criada mas **NUNCA recebe dados** — zero logging |
| Logging de confiança | ❌ Falta | `ConfidenceLog` é definido como interface mas nunca é persistido |
| Tag `resolved_by_ai` | ❌ Falta | Nenhum marcador de resolução pela IA |
| Motivo de transferência | ❌ Falta | Quando transfere, não registra se foi por keyword, limite, sem base, ou pedido |
| Artigos utilizados na resposta | ❌ Falta | IA usa artigos mas não registra quais foram citados |
| Métricas de loop persistente | ❌ Falta | Contador existe no estado mas não é logado em `ai_events` |

## Solução — 3 Upgrades Cirúrgicos

### Upgrade 1: Logging em `ai_events` (Telemetria Real)

Após cada resposta da IA no `ai-autopilot-chat`, inserir registro em `ai_events` com:

```text
entity_type: 'conversation'
entity_id: conversation_id
event_type: 'ai_response' | 'ai_transfer' | 'ai_fallback'
output_json: {
  confidence_score: 0.85,
  confidence_action: 'direct' | 'cautious' | 'handoff',
  articles_used: ['titulo-1', 'titulo-2'],
  articles_count: 2,
  interaction_number: 3,        // qual interação no loop
  max_interactions: 10,
  exit_reason: null | 'keyword' | 'max_reached' | 'no_kb' | 'user_request',
  query_preview: 'como rastrear meu pedido...',
  persistent_mode: true
}
tokens_used: (do response)
latency_ms: (tempo da chamada)
department_id: (da conversa)
```

**Onde:** No bloco principal de resposta do `ai-autopilot-chat` (~linhas 7050-7150), após gerar a resposta e antes de retornar.

### Upgrade 2: Motivo de Transferência Estruturado

Quando o motor persistente (`process-chat-flow`) decide sair do loop, registrar o motivo:

| Motivo | Quando |
|---|---|
| `exit_keyword` | Cliente disse "atendente", "humano", etc. |
| `max_interactions` | Atingiu `max_ai_interactions` |
| `low_confidence` | Score abaixo do mínimo (modo estrito) |
| `user_frustration` | Padrão de frustração detectado (futuro) |

**Onde:** No bloco de saída do loop persistente em `process-chat-flow` (~linhas 963-985), inserir em `ai_events` com `event_type: 'ai_transfer'`.

### Upgrade 3: Tag de Resolução (`resolved_by_ai`)

Quando a conversa é encerrada e a IA foi a última a interagir (sem transferência), marcar na conversa:

- Adicionar coluna `resolved_by` na tabela `conversations` (valores: `ai`, `human`, `mixed`, `null`)
- Preencher automaticamente no fechamento

**Implementação:** Migration SQL para adicionar a coluna + lógica no fluxo de fechamento.

## Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/ai-autopilot-chat/index.ts` | Inserir log em `ai_events` após cada resposta |
| `supabase/functions/process-chat-flow/index.ts` | Log de transferência com motivo no bloco persistente |
| Migration SQL | `ALTER TABLE conversations ADD COLUMN resolved_by TEXT` |

## Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — são INSERTs de logging, não alteram lógica existente |
| Performance | Mínimo — 1 INSERT extra por interação IA (async) |
| Kill Switch | Não afetado |
| Rollback | Remover os INSERTs; DROP COLUMN `resolved_by` |

## O que NÃO precisa de upgrade (já funciona)

- Score de confiança com thresholds dinâmicos ✅
- Modo estrito anti-alucinação ✅
- Prompt com regras de "não inventar" ✅
- Citação de fontes no prompt ✅
- Fontes RAG configuráveis por nó ✅
- Modo persistente com exit_keywords ✅
- Auto-traversal de nós ✅

