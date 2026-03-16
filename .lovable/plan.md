

# Auditoria V5 Enterprise — Resultado

## Status: 7 switches órfãos (moderado), 0 problemas críticos

O fluxo tem 27 nós e 37 edges. Estrutura e conexões estão corretas. O problema anterior de interpolação do `{{produto}}` já foi corrigido na última atualização.

---

### Switches órfãos (enable_X sem edge correspondente)

Estes switches ativam detecção de intenção, mas como não existe edge de saída dedicado, o motor tenta o path, não encontra, e cai no fallback `default`. **Funciona**, mas gera warnings no log e ciclos de processamento desnecessários.

| Nó | Switch órfão | Edge existe? | Impacto |
|----|-------------|-------------|---------|
| `node_ia_pedidos` | `enable_pedidos: true` | Não (só tem `devolucao` e `default`) | Auto-referencial — já é o nó de pedidos |
| `node_ia_financeiro` | `enable_financeiro: true` | Não (só tem `default`) | Auto-referencial — já é o nó financeiro |
| `node_ia_sistema` | `enable_suporte: true` + `enable_suporte_sistema: true` | Não (só tem `default`) | Auto-referencial — já é o nó de sistema |
| `node_ia_comercial` | `enable_comercial: true` | Não (só tem `comercial_internacional` e `default`) | Auto-referencial — já é o nó comercial |
| `node_ia_cancelamento` | `enable_cancelamento: true` | Não (só tem `default`) | Auto-referencial — já é o nó de cancelamento |
| `node_ia_consultor` | `enable_consultor: true` | Não (só tem `default`) | Auto-referencial — já é o nó de consultor |
| `node_ticket_devolucao` | `enable_devolucao: true` | Não (só tem `default`) | Auto-referencial — já é o nó de devolução |

**Total: 8 switches a remover** (em 7 nós)

---

### Itens OK (sem problemas)

- Todos os 37 edges referenciam nós existentes
- `save_as: "produto"` correto no Menu Produto
- `{{produto}}` será interpolado via `replaceVariables()` (fix anterior aplicado)
- Escapes voltam corretamente ao Menu Assunto (não ao Menu Produto)
- 7 transfers com `ai_mode: disabled` e department_id configurados
- `node_encerramento` com `end_action: close_conversation`
- Dúvidas → Financeiro e Dúvidas → Cancelamento com edges de intenção corretos
- Comercial → Internacional com edge de intenção correto
- Pedidos → Devolução com edge de intenção correto

---

### Correção proposta

Executar um SQL UPDATE para remover os 8 switches auto-referenciais do `flow_definition` JSON. Sem alterar edges nem nós — apenas limpar os `enable_*: true` que não têm saída dedicada.

Nós afetados:
- `node_ia_pedidos`: remover `enable_pedidos`
- `node_ia_financeiro`: remover `enable_financeiro`
- `node_ia_sistema`: remover `enable_suporte` e `enable_suporte_sistema`
- `node_ia_comercial`: remover `enable_comercial`
- `node_ia_cancelamento`: remover `enable_cancelamento`
- `node_ia_consultor`: remover `enable_consultor`
- `node_ticket_devolucao`: remover `enable_devolucao`

