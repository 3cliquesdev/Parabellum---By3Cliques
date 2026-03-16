

# Auditoria do Fluxo V5 Enterprise — Problemas Encontrados

## Resultado: 3 problemas detectados (1 crítico, 2 moderados)

---

### PROBLEMA 1 — CRITICO: `{{produto}}` NÃO é interpolado no `objective`

O campo `objective` de todos os nós de IA contém `{{produto}}` (ex: "Resolver dúvidas sobre pedidos, rastreio e devoluções do produto {{produto}} do cliente").

**O que acontece**: O motor `process-chat-flow` passa o `objective` **raw** para o `ai-autopilot-chat` sem chamar `replaceVariables()`. O autopilot recebe e usa o texto literal `{{produto}}` no prompt da LLM.

**Impacto**: A IA vai receber no prompt: *"Responder dúvidas sobre pedidos do produto {{produto}}"* em vez de *"...do produto Drop Nacional"*. Perde todo o contexto de produto.

**Correção**: Em todos os 7 pontos do `process-chat-flow/index.ts` onde o `objective` é passado no flow_context, aplicar `replaceVariables()`:

```
objective: replaceVariables(node.data?.objective || '', variablesContext) || null,
```

Linhas afetadas: ~2062, ~2289, ~2474, ~3602, ~4313, ~5204, ~5539

---

### PROBLEMA 2 — MODERADO: `enable_saque: true` no Financeiro sem edge de saída `saque`

O nó `node_ia_financeiro` tem `enable_saque: true`, o que faz o motor detectar intenção de saque e setar `path = 'saque'`. Porém **não existe edge com `sourceHandle: saque`** saindo desse nó — só existe `sourceHandle: default`.

**O que acontece**: Quando o motor tenta `findNextNode(flowDef, currentNode, 'saque')`, não encontra edge correspondente. O fallback hierárquico tenta `ai_exit` → `default` → any. Provavelmente cai no `default` → escape, mas o log vai mostrar warning de path não encontrado.

**Correção**: Duas opções:
- **Opção A**: Adicionar edge `saque` → `transfer_financeiro` (transfer direto para saque)
- **Opção B**: Remover `enable_saque: true` do nó financeiro (já está no contexto financeiro, não precisa de sub-roteamento)

---

### PROBLEMA 3 — MODERADO: `enable_suporte: true` em nós que não têm edge `suporte`

Os nós `node_ia_pedidos` e `node_ia_duvidas` têm `enable_suporte: true`, mas nenhum tem edge com `sourceHandle: suporte`. O motor vai detectar intenção de suporte, setar `path = 'suporte'`, e não encontrar saída dedicada — caindo no fallback `default` → escape.

**Impacto**: Funciona via fallback, mas não é intencional. Se o objetivo é redirecionar para suporte técnico quando detectado, precisa de um edge explícito. Se não é necessário, remover o switch.

**Correção**: Remover `enable_suporte: true` desses nós (o cliente já escolheu o assunto no menu, não precisa re-rotear por intenção de suporte).

---

## Itens OK (sem problemas)

- **Estrutura de nós e edges**: Todos os 27 nós referenciados por edges existem no JSON
- **Edges circulares (escape → menu)**: Corretamente apontam para `node_menu_assunto` (Menu 2), não para `node_menu_produto`
- **save_as: "produto"**: Corretamente configurado no `node_menu_produto`, e o motor salva em `collectedData['produto']`
- **collectedData propagado**: O `collectedData` é passado em todas as respostas do flow_context, permitindo que a IA acesse `produto` (mesmo que o objective não interpole)
- **Personas e departamentos**: Todos os IDs referenciados existem no mapeamento
- **Transfers com ai_mode: disabled**: Todos os 7 transfers corretamente configurados
- **forbid_options: false**: Correto em todos os nós de IA (permite perguntas)
- **Encerramento com close_conversation**: Configurado corretamente
- **Auto-advance**: start → welcome → menu_produto funciona via auto-traverse de message nodes

## Plano de Correção

1. Interpolar `{{produto}}` no objective em 7 pontos do `process-chat-flow/index.ts`
2. Remover `enable_saque: true` do `node_ia_financeiro` (ou adicionar edge saque → transfer)
3. Remover `enable_suporte: true` dos nós pedidos e dúvidas (sem edge correspondente)

