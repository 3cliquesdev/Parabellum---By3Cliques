

# Frontend — 5 Novos Intents no Nó AI

O backend (`process-chat-flow`) já suporta os 11 paths. Agora o frontend precisa expor os novos handles, switches e badges.

## Arquivos a editar (3)

### 1. `src/components/chat-flows/nodes/AIResponseNode.tsx`

**Interface** — Adicionar 5 campos:
```
forbid_pedidos?: boolean;
forbid_devolucao?: boolean;
forbid_saque?: boolean;
forbid_sistema?: boolean;
forbid_internacional?: boolean;
```

**Handles** — Expandir de 6 para 11 source handles (redistribuir `top` %):
| Handle ID | Cor | Label | top % |
|---|---|---|---|
| default | primary | padrão | 5% |
| financeiro | amber-500 | financeiro | 14% |
| cancelamento | red-500 | cancelamento | 23% |
| comercial | emerald-500 | comercial | 32% |
| suporte | blue-500 | suporte | 41% |
| consultor | violet-500 | consultor | 50% |
| pedidos | teal-500 | pedidos | 59% |
| devolucao | orange-500 | devolução | 68% |
| saque | yellow-500 | saque | 77% |
| suporte_sistema | slate-500 | sistema | 86% |
| comercial_internacional | cyan-500 | internacional | 95% |

**Badges** — Adicionar 5 badges condicionais para os novos `forbid_*`.

### 2. `src/components/chat-flows/panels/BehaviorControlsSection.tsx`

**Variáveis** — Ler os 5 novos `forbid_*` do `selectedNode.data`.

**Switches** — Adicionar 5 switches na seção "Saídas automáticas por intenção":
- 📦 Pedidos — "Rastreio, status de entrega → saída teal"
- 🔄 Devolução — "Produto com defeito, troca → saída laranja"
- 💰 Saque — "Sacar saldo da carteira → saída amarela"
- 🖥️ Sistema — "Bug, erro técnico, acesso → saída cinza"
- 🌍 Internacional — "Operação fora do Brasil → saída ciano"

**Status badges** — Adicionar 5 badges no bloco de status das saídas ativas. Atualizar a condição "Nenhuma saída ativa" para incluir os novos flags.

### 3. `src/components/chat-flows/ChatFlowEditor.tsx`

**Default data** — Adicionar os 5 novos `forbid_*: false` ao objeto default do tipo `ai_response` (linha ~249).

## Não editar
- `process-chat-flow/index.ts` — já 100% implementado
- `ChatFlowNodeWrapper.tsx` — não precisa de mudança
- Nenhuma migração de banco necessária

