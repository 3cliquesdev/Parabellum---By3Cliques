

# Auditoria Completa V5 Enterprise — Problemas Críticos

## PROBLEMA CRÍTICO 1: 6 de 7 persona_ids ERRADOS

Os IDs no flow_definition foram fabricados (primeiros 8 chars corretos, resto inventado). **Nenhuma dessas personas será encontrada** no banco, então o autopilot vai rodar sem persona/tools/prompt.

| Nó | persona_id no fluxo (ERRADO) | persona_id real | Persona |
|----|-----|------|---------|
| `node_ia_pedidos` + `node_ticket_devolucao` | `8b5a5acb-6c37-...6a7b` | `8b5a5acb-49a0-4acd-81c0-b6249529ed1d` | Helper Pedidos |
| `node_ia_financeiro` | `2001b4a1-3c5d-...3a4b` | `2001b4a1-7bc9-422b-8d5f-f5caddf31e8a` | Helper Financeiro |
| `node_ia_sistema` | `49810ef3-a1b2-...0e1f` | `49810ef3-e824-4cf4-8996-15362521e6b3` | Helper Sistema |
| `node_ia_comercial` | `31f82776-a1b2-...0e1f` | `31f82776-31bc-46e0-9c7e-77150edde601` | Hunter |
| `node_ia_duvidas` | `0d2f4c7c-a1b2-...0e1f` | `0d2f4c7c-a07e-48f3-bf1e-540d70f35a7a` | Helper |
| `node_ia_cancelamento` | `f97f23e6-a1b2-...0e1f` | `f97f23e6-99d3-4635-bb9e-ba145263e41e` | Helper Cancelamento |
| `node_ia_consultor` | `dcf5c52f-b7f9-...1097` | `dcf5c52f-b7f9-4a57-9e80-49adf2f61097` | Ana Júlia ✅ (único correto) |

**Impacto**: Sem persona, a IA não recebe system_prompt, não tem tools, não tem temperatura. Basicamente roda "crua".

---

## PROBLEMA CRÍTICO 2: Apenas 1 persona tem ferramentas vinculadas

Somente a persona **Helper** (`0d2f4c7c`) tem ferramentas na tabela `ai_persona_tools`. As demais 6 personas **não têm nenhuma ferramenta vinculada** — incluindo `create_ticket`, `check_tracking`, `check_order_status`.

| Persona | Tools vinculadas |
|---------|-----------------|
| Helper | check_order_status, check_tracking, create_ticket, route_to_department, schedule_meeting, search_knowledge_base |
| Helper Pedidos | **NENHUMA** — precisa de: check_tracking, check_order_status, create_ticket |
| Helper Financeiro | **NENHUMA** — precisa de: create_ticket |
| Helper Sistema | **NENHUMA** — precisa de: create_ticket, search_knowledge_base |
| Hunter | **NENHUMA** — precisa de: search_knowledge_base |
| Helper Cancelamento | **NENHUMA** — precisa de: create_ticket |
| Ana Júlia (CS) | **NENHUMA** — precisa de: search_knowledge_base |

**Isso responde à pergunta sobre tickets**: O plano diz que Financeiro e Cancelamento devem criar ticket **via IA** (tool `create_ticket`), mas como essas personas não têm a ferramenta vinculada, **a IA nunca vai conseguir criar o ticket**.

---

## PROBLEMA MODERADO 3: Nenhum nó tem `kb_categories` definido

Todos os nós de IA têm `use_knowledge_base: true` mas **nenhum** tem `kb_categories` para filtrar. A IA vai buscar em TODAS as 15 categorias da KB, diluindo a relevância.

Mapeamento recomendado:

| Nó | Categorias recomendadas |
|----|------------------------|
| IA Pedidos | Logística e Pedidos, Atendimento e Suporte |
| IA Ticket Devolução | Logística e Pedidos, Cancelamento e Políticas |
| IA Financeiro | Financeiro e Pagamentos, FAQ e Dúvidas Frequentes |
| IA Sistema | Manual e Treinamento, Atendimento e Suporte, Marketplaces e Integrações |
| IA Comercial | Planos e Ofertas, Produtos e Serviços, Vendas, Benefícios e Qualidade |
| IA Dúvidas | FAQ e Dúvidas Frequentes, Sobre a Empresa e Serviços, Atendimento e Suporte |
| IA Cancelamento | Cancelamento e Políticas, Benefícios e Qualidade |
| IA Consultor | Operação e Processos, Manual e Treinamento |

---

## PROBLEMA MODERADO 4: department_ids nos transfers — verificação

Os departamentos reais existem mas os IDs nos transfers usam sufixos fabricados. Verificação:

| Transfer | dept_id no fluxo | dept_id real | Match? |
|----------|-----------------|-------------|--------|
| Suporte Pedidos | `2dd0ee5c-a1b2-...0e1f` | `2dd0ee5c-fd20-44be-94ad-f83f1be1c4e9` | ❌ |
| Financeiro | `af3c75a9-a1b2-...0e1f` | `af3c75a9-2e3f-49f1-8e0b-7fb3f4b5ee45` | ❌ |
| Suporte Sistema | `fd4fcc90-a1b2-...0e1f` | `fd4fcc90-22e4-4127-ae23-9c9ecb6654b4` | ❌ |
| Comercial Nacional | `f446e202-a1b2-...0e1f` | `f446e202-bdc3-4bb3-aeda-8c0aa04ee53c` | ❌ |
| Comercial Internacional | `68195a0f-a1b2-...0e1f` | `68195a0f-1f9e-406b-b714-c889b4145f60` | ❌ |
| Suporte | `36ce66cd-a1b2-...0e1f` | `36ce66cd-7414-4fc8-bd4a-268fecc3f01a` | ❌ |
| Customer Success | `b7149bf4-a1b2-...0e1f` | `b7149bf4-1356-4ca5-bc9a-8caacf7b6e80` | ❌ |

**Todos os 7 department_ids estão ERRADOS**. Transfers vão falhar silenciosamente.

---

## Plano de Correção (3 etapas)

### Etapa 1 — SQL: Corrigir persona_ids + department_ids + adicionar kb_categories
Um único UPDATE no `flow_definition` JSON corrigindo:
- 6 persona_ids errados → IDs reais
- 7 department_ids errados → IDs reais
- Adicionar `kb_categories` em cada nó de IA

### Etapa 2 — SQL: Vincular ferramentas às personas
INSERT na tabela `ai_persona_tools` para cada persona que precisa de tools:
- Helper Pedidos: check_tracking, check_order_status, create_ticket
- Helper Financeiro: create_ticket
- Helper Sistema: create_ticket, search_knowledge_base
- Hunter: search_knowledge_base
- Helper Cancelamento: create_ticket
- Ana Júlia: search_knowledge_base

### Etapa 3 — Decisão: Ticket por IA ou por Nó?
- **Estado atual**: O objective instrui a IA a usar `create_ticket` (ferramenta). Ou seja, a **IA cria o ticket**.
- **Alternativa**: Adicionar nós dedicados `create_ticket` após os nós de IA (como existe no V5 Master para devolução).
- **Recomendação**: Manter via IA (tool) para Financeiro e Cancelamento, pois a IA precisa coletar dados conversacionalmente antes de criar. Adicionar nós `create_ticket` só faz sentido para fluxos lineares sem coleta dinâmica.

