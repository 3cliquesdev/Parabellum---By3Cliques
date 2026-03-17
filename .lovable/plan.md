
# Plano: Inserir Chat Flow "Fluxo Inteligente Jarvis (Triage)"

## Estrutura do Fluxo

```text
                          ┌─► transfer_suporte_pedidos (Suporte Pedidos)
                          ├─► transfer_suporte_sistema (Suporte Sistema)
                          ├─► transfer_comercial_nacional (Comercial Nacional)
                          ├─► transfer_comercial_internacional (Comercial Internacional)
  start ──► ai_jarvis ────├─► transfer_financeiro (Financeiro)
                          ├─► transfer_saque (Customer Success)
                          ├─► transfer_devolucao (Suporte Pedidos)
                          ├─► transfer_cancelamento (Retenção — 5a0a8d1a)
                          ├─► transfer_consultor (Customer Success, type=consultant)
                          └─► transfer_humano (Suporte — fila geral)
```

## Execução

**Uma única operação SQL INSERT** na tabela `chat_flows` com o `flow_definition` JSONB contendo:

### Nodes (12 nós)
1. **`start`** — tipo `input`, label "Início"
2. **`ai_jarvis`** — tipo `ai_response`, label "Triageira Lais"
   - `use_knowledge_base: true`, todas as `enable_*` flags ativas para os 10 destinos
   - `persona_name: "Lais Triageira"` (persona_id vazio — você configura depois)
   - `max_ai_interactions: 10`, `forbid_options: true` (sem botões!)
   - `objective`: placeholder para você preencher com o prompt da Lais
3-12. **10 nós `transfer`** — cada um com `department_id`, `department_name`, `transfer_message` e `label` corretos

### Edges (11 arestas)
- `start` → `ai_jarvis` (conexão direta, sem menus)
- `ai_jarvis` → cada transfer via `sourceHandle` correspondente:
  - `suporte_pedidos`, `suporte_sistema`, `comercial_nacional`, `comercial_internacional`, `financeiro`, `saque`, `devolucao`, `cancelamento`, `consultor`, `humano`
- Aresta `default` → `transfer_humano` (fallback)

### Department IDs mapeados
| Transfer | Department | ID |
|---|---|---|
| Suporte Pedidos | Suporte Pedidos | `2dd0ee5c-...` |
| Suporte Sistema | Suporte Sistema | `fd4fcc90-...` |
| Comercial Nacional | Comercial - Nacional | `f446e202-...` |
| Comercial Internacional | Comercial - Internacional | `68195a0f-...` |
| Financeiro | Financeiro | `af3c75a9-...` |
| Saque | Customer Success | `b7149bf4-...` |
| Devoluções | Suporte Pedidos | `2dd0ee5c-...` |
| Cancelamentos | Retenção | `5a0a8d1a-...` |
| Consultor | Customer Success | `b7149bf4-...` (type=consultant) |
| Fila Geral | Suporte | `36ce66cd-...` |

### Configuração do flow
- `is_active: false` (inativo para testes)
- `is_master_flow: false`
- `priority: 0`
- `trigger_keywords: '{}'` (vazio — será ativado manualmente)

## Arquivos alterados
Nenhum arquivo de código alterado — apenas INSERT SQL via migration tool.

## Pós-execução
- O fluxo aparecerá no editor visual para revisão
- Você salva o System Prompt da "Lais Triageira" na persona correspondente
- Ativa quando pronto para testar
