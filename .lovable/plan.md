

# Fix: Handles clicáveis + Saídas no painel lateral

## Problema 1: Handles não clicáveis
As labels de texto estão bloqueando os cliques nos handles. Solução: adicionar `pointer-events-none` em todas as 5 divs de label (linhas 104-118 do AIResponseNode.tsx).

## Problema 2: Painel lateral desalinhado com os handles

O painel lateral (`BehaviorControlsSection.tsx`) já tem toggles para "Não resolver financeiro" e "Transferir intenção de compra", mas faltam os toggles correspondentes a **cancelamento** e **suporte**. Além disso, a seção precisa ser reorganizada para refletir as 4 saídas dedicadas.

### Alterações

**Arquivo 1: `src/components/chat-flows/nodes/AIResponseNode.tsx`** (linhas 104-118)
- Adicionar `pointer-events-none` a cada div de label dos handles

**Arquivo 2: `src/components/chat-flows/panels/BehaviorControlsSection.tsx`**
- Reorganizar a seção "O que a IA NÃO pode fazer" em uma nova seção visual: **"Saídas automáticas por intenção"**
- Manter os toggles existentes (`forbid_financial`, `forbid_commercial`) com ícones de cor correspondentes aos handles (amarelo para financeiro, verde para comercial)
- Adicionar toggle `forbid_cancellation` (vermelho) — "Detectar cancelamento" — descrição: "Detecta intenção de cancelar e direciona pela saída ❌ Cancelamento"
- Adicionar toggle `forbid_support` (azul) — "Detectar pedido de atendente" — descrição: "Detecta pedido de atendente humano e direciona pela saída 🧑 Suporte"
- Cada toggle terá um indicador visual de cor correspondente ao handle no nó
- Badges de status atualizados para incluir cancelamento e suporte

**Arquivo 3: `src/components/chat-flows/nodes/AIResponseNode.tsx`** (interface + badges)
- Adicionar `forbid_cancellation` e `forbid_support` na interface `AIResponseNodeData`
- Adicionar badges correspondentes no corpo do nó

**Arquivo 4: `src/components/chat-flows/ChatFlowEditor.tsx`**
- Adicionar defaults para os novos campos: `forbid_cancellation: false`, `forbid_support: false`

**Arquivo 5: `supabase/functions/process-chat-flow/index.ts`**
- Respeitar os novos flags: só direcionar para `path='cancelamento'` se `forbid_cancellation === true` no nodeData, idem para `suporte`
- Se o flag estiver `false`, a IA não faz a detecção daquela intenção (comportamento atual para financeiro/comercial)

### Resultado visual no painel

```text
┌─────────────────────────────────────┐
│ 🚀 SAÍDAS AUTOMÁTICAS POR INTENÇÃO │
├─────────────────────────────────────┤
│ 💰 Financeiro          [toggle] ON  │
│   Saque, reembolso → saída amarela  │
│                                     │
│ ❌ Cancelamento        [toggle] OFF │
│   Cancelar plano → saída vermelha   │
│                                     │
│ 🛒 Comercial           [toggle] OFF │
│   Intenção compra → saída verde     │
│                                     │
│ 🧑 Suporte             [toggle] OFF │
│   Pedir atendente → saída azul      │
└─────────────────────────────────────┘
```

