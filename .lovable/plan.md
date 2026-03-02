

# Corrigir: IA dentro de fluxo deve avançar para próximo nó em vez de fazer handoff direto

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Problema

Quando a IA está operando dentro de um nó `ai_response` de um Chat Flow e não consegue resolver a dúvida do cliente (strict RAG handoff ou confidence handoff), ela executa o handoff diretamente: finaliza o flow state, transfere para humano e envia "vou te conectar com um especialista".

Isso **quebra a soberania do fluxo**. O fluxo tem um próximo nó definido (ex: "Múltipla Escolha: Você já é nosso cliente?"), mas a IA ignora completamente e faz transferência por conta própria.

## Causa raiz

No `ai-autopilot-chat/index.ts`, dois blocos de handoff (strict RAG ~linha 4097 e confidence ~linha 4757) **não verificam se existe `flow_context`**. Quando há `flow_context`, o handoff deveria ser delegado de volta ao `process-chat-flow` para que o fluxo avance normalmente.

## Correção

**Arquivo**: `supabase/functions/ai-autopilot-chat/index.ts`

### 1. Strict RAG handoff (linhas ~4097-4198)
Adicionar guard: se `flow_context` existe, **não executar handoff direto**. Em vez disso, retornar `status: 'flow_advance_needed'` para que o `process-chat-flow` avance para o próximo nó do fluxo.

### 2. Confidence handoff (linhas ~4757-4870)
Mesmo tratamento: se `flow_context` existe, retornar sinal de avanço em vez de executar handoff.

### Lógica do retorno quando `flow_context` está presente

```text
ai-autopilot-chat detecta handoff necessário
  └─ flow_context existe?
       ├─ SIM → return { status: 'flow_advance_needed', reason: '...' }
       │         (NÃO muda ai_mode, NÃO finaliza flow state, NÃO envia mensagem)
       │         O process-chat-flow já trata isso: quando ai_response retorna
       │         sem resposta válida, ele avança para o próximo nó do fluxo
       └─ NÃO → handoff direto (comportamento atual mantido)
```

### O que muda no `process-chat-flow`?
Nada precisa mudar. O `process-chat-flow` já tem a lógica de avanço quando o nó AI atinge condição de saída (max_interactions, exit_keyword). O `ai-autopilot-chat` apenas precisa **parar de agir por conta própria** quando está dentro de um fluxo.

Concretamente: quando o `ai-autopilot-chat` retorna `flow_advance_needed`, o webhook/listener que o chamou deve re-invocar `process-chat-flow` com uma flag indicando que a IA quer sair do nó — equivalente a `max_interactions` reached. Vou verificar como o webhook trata o retorno do autopilot para garantir essa integração.

**Arquivo adicional**: `supabase/functions/meta-whatsapp-webhook/index.ts` — verificar tratamento do retorno do autopilot quando `flow_advance_needed`

### Sem risco de regressão
- Autopilot global (sem flow_context) continua com handoff direto — comportamento preservado
- Apenas fluxos com próximo nó definido são afetados
- A soberania do fluxo é restaurada

