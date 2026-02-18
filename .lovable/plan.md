

## Correção: Condição Multi-Regra no Início do Master Flow

### Problema Identificado
O motor de fluxo tem **duas funções** de avaliação de condições:
1. `evaluateConditionPath()` (linha 183) - Suporta multi-regras (`condition_rules`) e retorna o ID da regra ou `"else"`
2. `evalCond()` (linha 1065) - Só suporta modo clássico (true/false)

Na travessia inicial do Master Flow (linha 1115), o código usa `evalCond()` e tenta handles `['true', 'yes', '1']` / `['false', 'no', '2']`. Como os handles do nó multi-regra são os IDs das regras (ex: `"abc123"`) e `"else"`, o motor **nunca encontra** o próximo nó e para a travessia.

### Solucao
Atualizar a travessia do Master Flow para detectar se o nó de condição tem `condition_rules` e, nesse caso, usar `evaluateConditionPath()` ao invés de `evalCond()`.

### Correção do Build
Remover referências ao `mux-embed` do `package-lock.json` para resolver o erro de build.

### Seção Técnica

**Arquivo:** `supabase/functions/process-chat-flow/index.ts`

**Trecho a alterar (linhas 1115-1135):**

Antes:
```typescript
if (node.type === 'condition') {
  const result = evalCond(node.data);
  const handles = result ? ['true', 'yes', '1'] : ['false', 'no', '2'];
  let next = null;
  for (const h of handles) {
    next = findNextNode(flowDef, node, h);
    if (next) break;
  }
  ...
}
```

Depois:
```typescript
if (node.type === 'condition') {
  // Detectar multi-regra vs classico
  const hasMultiRules = node.data?.condition_rules?.length > 0;

  if (hasMultiRules) {
    // Multi-regra: usar evaluateConditionPath que retorna rule.id ou "else"
    const path = evaluateConditionPath(node.data, collectedData, userMessage);
    next = findNextNode(flowDef, node, path);
  } else {
    // Classico: true/false com cascata de handles
    const result = evalCond(node.data);
    const handles = result ? ['true', 'yes', '1'] : ['false', 'no', '2'];
    for (const h of handles) {
      next = findNextNode(flowDef, node, h);
      if (next) break;
    }
  }
  ...
}
```

**Arquivo:** `package-lock.json`
- Remover entradas referentes a `mux-embed` e `@mux/mux-player` para resolver o erro de build.

### Impactos
- Nenhum downgrade: condições clássicas (true/false) continuam funcionando exatamente como antes
- Upgrade: condições multi-regra agora funcionam tanto no meio do fluxo quanto no inicio (Master Flow)
- O `evaluateConditionPath()` já existe e já funciona corretamente na travessia pos-resposta (linha 621 e 635)

