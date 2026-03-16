

# V5 Master — Menu + Especialistas

## Resumo

Criar um novo chat flow "V5 Master — Menu + Especialistas" com estrutura baseada em menu fixo (ask_options) em vez de triagem NLP. Cada ramo tem uma IA especialista + menu de escape. O V4 permanece intacto para comparação.

## Estrutura do Fluxo (27 nós)

```text
START → Boas-vindas (message) → Menu Principal (ask_options)
                                    ├── pedidos    → IA Pedidos → Escape → menu/humano
                                    ├── sistema    → IA Sistema → Escape → menu/humano
                                    ├── comercial  → IA Comercial → Escape → menu/humano
                                    ├── duvidas    → IA Suporte Geral → Escape → menu/humano
                                    │                  ├── financeiro → IA Financeiro → Escape
                                    │                  └── cancelamento → IA Cancelamento → Escape
                                    └── consultor  → IA Customer Success → Escape → menu/humano
```

## Mapeamento de Personas e Departamentos

| Ramo | Persona | Transfer → Departamento |
|------|---------|------------------------|
| Pedidos | Helper Pedidos (`8b5a5acb`) | Suporte Pedidos (`2dd0ee5c`) |
| Sistema | Helper Sistema (`49810ef3`) | Suporte Sistema (`fd4fcc90`) |
| Comercial | Hunter (`31f82776`) | Comercial Nacional (`f446e202`) |
| Comercial Int. | Hunter Internacional (`338fdd11`) | Comercial Internacional (`68195a0f`) |
| Dúvidas | Helper (`0d2f4c7c`) | Suporte (`36ce66cd`) |
| Financeiro | Helper Financeiro (`2001b4a1`) | Financeiro (`af3c75a9`) |
| Saque (sub-fin) | — | Financeiro (`af3c75a9`) |
| Cancelamento | Helper Cancelamento (`f97f23e6`) | Suporte (`36ce66cd`) |
| Consultor | Customer Success Ana (`dcf5c52f`) | Customer Success (`b7149bf4`) |

## Implementação

Gerar o `flow_definition` JSON completo com ~27 nós e ~30 edges, e inserir como novo registro na tabela `chat_flows` via código. Os nós seguem exatamente a estrutura de dados do V4 (mesmos campos: `persona_id`, `persona_name`, `forbid_*`, `max_ai_interactions`, `kb_categories`, etc.).

### Nós detalhados

1. **start** — nó input padrão
2. **node_welcome** — message: "Olá! Seja bem-vindo ao atendimento 3Cliques..."
3. **node_menu** — ask_options com 5 opções (pedidos/sistema/comercial/duvidas/consultor)
4. **node_ia_pedidos** — ai_response, Helper Pedidos, switches: pedidos+devolução, max:3
5. **node_escape_pedidos** — ask_options (menu/humano)
6. **node_ia_sistema** — ai_response, Helper Sistema, max:3
7. **node_escape_sistema** — ask_options (menu/humano)
8. **node_ia_comercial** — ai_response, Hunter, switches: comercial+internacional, max:3
9. **node_escape_comercial** — ask_options (menu/humano)
10. **node_ia_duvidas** — ai_response, Helper, switches: financeiro+cancelamento+suporte, max:4
11. **node_escape_duvidas** — ask_options (menu/humano)
12. **node_ia_consultor** — ai_response, Customer Success Ana, max:3
13. **node_escape_consultor** — ask_options (menu/humano)
14. **node_ia_financeiro** — ai_response, Helper Financeiro, switches: financeiro+saque, max:3
15. **node_escape_financeiro** — ask_options (menu/humano)
16. **node_ia_cancelamento** — ai_response, Helper Cancelamento, switch: cancelamento, max:3
17. **node_escape_cancelamento** — ask_options (menu/humano)
18-27. **transfer nodes** — 1 por departamento destino (Suporte Pedidos, Suporte Sistema, Comercial Nacional, Comercial Internacional, Suporte, Financeiro, Customer Success)

### Edges
- Cada ask_options tem 2 saídas: `menu` → node_menu, `humano` → transfer correspondente
- Cada ai_response tem `default` → escape, e switches de intenção → sub-nós ou transfers
- Comercial: `comercial_internacional` → Transfer Comercial Internacional
- Dúvidas: `financeiro` → node_ia_financeiro, `cancelamento` → node_ia_cancelamento
- Financeiro: `saque` → Transfer Financeiro (saque direto)
- Pedidos: `devolucao` → node_ia_devolucoes (ou transfer direto)

### Ações pós-criação
- Marcar o novo fluxo como `is_active: true`
- Vincular ao canal WhatsApp principal (`support_channel_id`)
- **Não** marcar como master_flow ainda (manter V4 como referência para homologação)

## Arquivos modificados

Nenhum arquivo de código será alterado. O fluxo será criado via `useCreateChatFlow` ou inserção direta, gerando apenas um registro na tabela `chat_flows` com o JSON completo do `flow_definition`.

