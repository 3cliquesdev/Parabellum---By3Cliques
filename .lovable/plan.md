

# Fix: Condição com multi-regras não deve avaliar com mensagem vazia

## Problema

Quando o fluxo inicia (manual ou automático) e encontra um nó de **Condição com multi-regras** (keywords), a travessia inicial avalia a condição com mensagem vazia `""` → nunca dá match → cai no `else` → vai direto para a IA, ignorando completamente as regras configuradas (Onboarding, Carnaval).

O fluxo "Master Flow + IA Entrada (Rascunho)" também tem **edges órfãs** (`true`/`false`) junto com os novos rule IDs, causando conflitos.

## Correção

### 1. Edge Function `process-chat-flow/index.ts` — Parar na condição quando não tem mensagem

**Travessia manual (linha ~626-633)**: Se o nó é `condition` com multi-regras de keywords e não há `userMessage`, **parar a travessia** e salvar o estado como `waiting_input` nesse nó. Na próxima mensagem do usuário, a condição será avaliada corretamente.

**Travessia de novo fluxo (linha ~1950-1957)**: Mesma lógica — se `userMessage` está vazio ou é apenas o trigger automático, parar na condição.

Lógica:
```
if (hasMultiRules && !userMessage) {
  // Parar aqui — aguardar mensagem real do usuário
  contentNode = currentNode; // mantém na condição
  break;
}
```

Quando o usuário enviar a próxima mensagem, o fluxo ativo terá `current_node_id` apontando para o nó de condição, e o código existente de "processar fluxo ativo" (que já usa `userMessage`) avaliará corretamente.

### 2. Limpar edges órfãs do fluxo rascunho

SQL: Remover edges com `sourceHandle` = `true` ou `false` do nó de condição `1769459229369` no fluxo `20a05c59-da7e-4eb9-89f7-731b1b7fb3db`.

### 3. Tratamento no fluxo ativo — Condição como nó corrente

Quando `current_node_id` aponta para um nó `condition` e chega uma mensagem:
- Avaliar a condição com a mensagem real
- Seguir o path correto (rule ID ou else)
- Continuar a travessia normal

Verificar que o código existente já trata isso no bloco de "processar fluxo ativo" (linhas ~1080-1081).

## Impacto
- **Zero regressão**: Condições clássicas (`has_data`, `is_true`) não usam `userMessage` e continuam funcionando
- Apenas condições de **keyword** (multi-regra com `contains`) passam a esperar mensagem real
- O nó de condição fica como `waiting_input` até o usuário mandar a primeira mensagem

