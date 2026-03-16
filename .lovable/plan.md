

# Diagnóstico: IA sem Contexto + Alucinação

## Problema 1: `collectedData` nunca é injetado no system prompt

O produto escolhido pelo cliente (`collectedData.produto = "Drop Nacional"`) é passado ao autopilot via `flow_context.collectedData`, mas **nunca aparece no system prompt da IA**. O autopilot usa `collectedData` apenas para:
- `kbProductFilter` (filtrar artigos da KB)
- `email` (para verificação)
- `__ai.interaction_count` (anti-loop)

**A IA literalmente não sabe qual produto o cliente escolheu, nem qual assunto do menu selecionou.** Por isso começa "sem contexto".

### Correção
Injetar um bloco `**CONTEXTO DO FLUXO:**` no system prompt do autopilot (`ai-autopilot-chat/index.ts`), extraindo dados relevantes do `flow_context.collectedData`:
```
**CONTEXTO DO FLUXO (dados já coletados):**
- Produto: Drop Nacional
- Assunto: Pedidos e Entregas
```

Isso vai logo após o `agentContextBlock` (linha ~6612), antes do `contextualizedSystemPrompt`.

## Problema 2: Return path incompleto na linha 2919

No `process-chat-flow/index.ts`, quando o fluxo avança de um nó "ask" (menu) para um nó `ai_response`, a linha 2919 retorna apenas:
```json
{ useAI, aiNodeActive, nodeId, flowId, contextPrompt, useKnowledgeBase, collectedData }
```

**Faltam 12+ campos críticos**: `personaId`, `kbCategories`, `kbProductFilter`, `objective`, `maxSentences`, `forbidQuestions`, `forbidOptions`, `forbidFinancial`, `forbidCancellation`, `forbidCommercial`, `forbidSupport`, `forbidConsultant`, `allowedSources`, `responseFormat`, `fallbackMessage`, `flowName`.

Sem `personaId`, a IA roda sem persona (sem system_prompt, sem tools, sem temperatura). Sem `objective`, o prompt restritivo não é ativado. Sem `forbid_*`, as travas de intenção são desativadas. **Isso explica a alucinação.**

### Correção
Expandir o return na linha 2919 com todos os campos, igual aos outros return points (ex: linhas 2067-2093, 4322-4358).

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/process-chat-flow/index.ts` (linha 2919) | Expandir return com todos os campos |
| `supabase/functions/ai-autopilot-chat/index.ts` (linha ~6612) | Injetar `collectedData` no system prompt |

## Impacto

- Todas as IAs especialistas receberão contexto completo (produto + assunto + dados coletados)
- A persona correta será carregada em todos os caminhos de entrada
- As travas de intenção funcionarão em todos os cenários
- A alucinação será eliminada pela combinação de persona + objective + contexto

