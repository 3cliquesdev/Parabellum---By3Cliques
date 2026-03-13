

## Plano: Inserir 4 nós de ticket no FLUXO MASTER V4

O update anterior não persistiu os nós de ticket. O fluxo atual tem 24 nós e 54 edges, sem nenhum nó de ticket.

### O que será feito

Um SQL update no `flow_definition` (JSONB) do fluxo `9926200d-5f15-429a-ae98-9adedb2e4f65` para:

**1. Adicionar 4 nós `create_ticket`** (x=1200, alinhados com suas IAs):

| Nó | y | Subject Template | Category | Priority |
|----|---|-----------------|----------|----------|
| `node_ticket_saque` | 100 | Solicitação de Saque — {{contact_name}} | saque | high |
| `node_ticket_financeiro` | 320 | Solicitação Financeira — {{contact_name}} | financeiro | high |
| `node_ticket_cancelamento` | 540 | Cancelamento — {{contact_name}} | cancelamento | high |
| `node_ticket_devolucao` | 760 | Devolução — {{contact_name}} | devolucao | high |

Todos com `use_collected_data: true`.

**2. Redirecionar 8 edges existentes** para apontar ao nó ticket em vez do transfer:

- `e_5_default_20` e `e_5_suporte_20`: target → `node_ticket_saque`
- `e_6_default_20` e `e_6_suporte_20`: target → `node_ticket_financeiro`
- `e_7_default_21` e `e_7_suporte_21`: target → `node_ticket_cancelamento`
- `e_8_default_22` e `e_8_suporte_22`: target → `node_ticket_devolucao`

**3. Criar 4 novas edges** (ticket → transfer):

- `node_ticket_saque` → `node_20_transfer_financeiro`
- `node_ticket_financeiro` → `node_20_transfer_financeiro`
- `node_ticket_cancelamento` → `node_21_transfer_suporte_cancel`
- `node_ticket_devolucao` → `node_22_transfer_pedidos`

**4. Cross-links permanecem intactos** (`e_6_saque_5`, `e_7_financeiro_6`, `e_7_sistema_10`, `e_8_financeiro_6`).

### Implementação

Um único SQL update usando `jsonb_set` e array concatenation para adicionar os nós e edges ao JSONB existente, seguido de updates pontuais nos targets das edges redirecionadas.

### Resultado esperado

O fluxo passará de 24→28 nós e 54→58 edges, com os 4 caminhos críticos agora criando ticket antes de transferir para humano.

