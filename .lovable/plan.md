

# V5 Enterprise — Menu + Especialistas (2 Níveis)

## Resumo

Criar novo chat flow "V5 Enterprise — Menu + Especialistas" com **2 níveis de menu** (Produto → Assunto), 7 IAs especialistas com contexto do produto propagado via `collectedData.produto`, tickets automáticos com carimbo, e escape elegante em cada ramo. V4 e V5 anterior permanecem intactos.

## Estrutura (30 nós, ~40 edges)

```text
START → Boas-vindas → MENU PRODUTO (3 opções) → MENU ASSUNTO (6 opções)
                                                    ├── pedidos    → IA Pedidos → [devolução → IA Ticket Devolução → Encerramento]
                                                    │                           → Escape → menu/humano
                                                    ├── financeiro → IA Financeiro → Escape → menu/humano
                                                    ├── sistema    → IA Sistema → Escape → menu/humano
                                                    ├── comercial  → IA Comercial → [internacional → Transfer] → Escape → menu/humano
                                                    ├── duvidas    → IA Geral → [financeiro → IA Fin] [cancelamento → IA Cancel] → Escape
                                                    └── consultor  → IA CS Ana → Escape → menu/humano
```

## Nós Detalhados

| ID | Tipo | Descrição |
|----|------|-----------|
| `start` | input | Nó inicial padrão |
| `node_welcome` | message | Boas-vindas |
| `node_menu_produto` | ask_options | Menu 1: Drop Nacional / Internacional / Híbrido → salva em `collectedData.produto` via `save_as: "produto"` |
| `node_menu_assunto` | ask_options | Menu 2: 6 opções (pedidos/financeiro/sistema/comercial/duvidas/consultor) |
| `node_ia_pedidos` | ai_response | Helper Pedidos, max:4, switches: pedidos+devolução+suporte, objective com `${produto}` |
| `node_ticket_devolucao` | ai_response | Helper Pedidos, max:10, objective de coleta de dados + create_ticket |
| `node_escape_pedidos` | ask_options | menu → node_menu_assunto / humano → transfer |
| `node_ia_financeiro` | ai_response | Helper Financeiro, max:15, switches: financeiro+saque, OTP, objective com `${produto}` |
| `node_escape_financeiro` | ask_options | menu / humano |
| `node_ia_sistema` | ai_response | Helper Sistema, max:5, switches: sistema+suporte, objective com `${produto}` |
| `node_escape_sistema` | ask_options | menu / humano |
| `node_ia_comercial` | ai_response | Hunter, max:5, switches: comercial+internacional, objective com `${produto}` |
| `node_escape_comercial` | ask_options | menu / humano |
| `node_ia_duvidas` | ai_response | Helper, max:4, switches: financeiro+cancelamento+suporte |
| `node_escape_duvidas` | ask_options | menu / humano |
| `node_ia_cancelamento` | ai_response | Helper Cancelamento, max:8, switch: cancelamento |
| `node_escape_cancelamento` | ask_options | menu / humano |
| `node_ia_consultor` | ai_response | CS Ana, max:5, switch: consultor |
| `node_escape_consultor` | ask_options | menu / humano |
| `node_encerramento` | message + close_conversation | Despedida |
| 7x transfer nodes | transfer | Um por departamento, ai_mode: disabled |

## Diferenças do V5 anterior

1. **Menu Produto** (novo nó ask_options antes do menu de assunto) — salva `produto` no `collectedData`
2. **Nó Ticket Devolução** (ai_response dedicado) — coleta dados e cria ticket com `issue_type=devolucao`
3. **Nó Encerramento** — com `close_conversation` para protocolo
4. **Objectives** em todos os nós de IA incluem `${produto}` para contexto
5. **Escapes voltam ao Menu Assunto** (nó 4), não ao Menu Produto
6. **Financeiro com max:15** e OTP inline
7. **Cancelamento com max:8** e objetivo de retenção

## Implementação

Inserir um novo registro na tabela `chat_flows` com o `flow_definition` JSON completo contendo os ~30 nós e ~40 edges. Usar a mesma estrutura de dados do V5 existente. `is_active: false` até homologação. Nenhum arquivo de código será alterado.

### Personas e Departamentos (mesmo mapeamento)

| Ramo | persona_id | Transfer → dept_id |
|------|-----------|-------------------|
| Pedidos | `8b5a5acb` | `2dd0ee5c` |
| Ticket Devolução | `8b5a5acb` | — (encerra) |
| Financeiro | `2001b4a1` | `af3c75a9` |
| Sistema | `49810ef3` | `fd4fcc90` |
| Comercial | `31f82776` | Nacional: `f446e202` / Int: `68195a0f` |
| Dúvidas | `0d2f4c7c` | `36ce66cd` |
| Cancelamento | `f97f23e6` | `36ce66cd` |
| Consultor | `dcf5c52f` | `b7149bf4` |

