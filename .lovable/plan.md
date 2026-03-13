

# Plano: Criar "FLUXO MASTER V4 — Nexxo AI"

## Operação 100% via banco de dados

1. **Deletar** o MASTER V3 (`61a84e60-3067-4f5a-8e74-43ffbc0c846f`)
2. **Inserir** novo fluxo "FLUXO MASTER V4 — Nexxo AI" com `is_active=false`

## IDs Mapeados

### Departamentos
| Nome | ID |
|------|-----|
| Financeiro | `af3c75a9-2e3f-49f1-8e0b-7fb3f4b5ee45` |
| Suporte | `36ce66cd-7414-4fc8-bd4a-268fecc3f01a` |
| Suporte Pedidos | `2dd0ee5c-fd20-44be-94ad-f83f1be1c4e9` |
| Suporte Sistema | `fd4fcc90-22e4-4127-ae23-9c9ecb6654b4` |
| Comercial - Nacional | `f446e202-bdc3-4bb3-aeda-8c0aa04ee53c` |
| Comercial - Internacional | `68195a0f-1f9e-406b-b714-c889b4145f60` |
| Customer Success | `b7149bf4-1356-4ca5-bc9a-8caacf7b6e80` |

### Personas
| Nó | Persona | ID |
|----|---------|-----|
| 4, 13, 14 | Helper (Triagem) | `0d2f4c7c-a07e-48f3-bf1e-540d70f35a7a` |
| 5 | Helper Saque | `95d1776d-294c-4ce5-a42f-dd864483f9dc` |
| 6 | Helper Financeiro | `2001b4a1-7bc9-422b-8d5f-f5caddf31e8a` |
| 7 | Helper Cancelamento | `f97f23e6-99d3-4635-bb9e-ba145263e41e` |
| 8 | Helper Devoluções | `a7cf211c-399e-4017-9db5-c185ca5e93f4` |
| 9 | Helper Pedidos | `8b5a5acb-49a0-4acd-81c0-b6249529ed1d` |
| 10 | Helper Sistema | `49810ef3-e824-4cf4-8996-15362521e6b3` |
| 11 | Hunter (Comercial Nacional) | `31f82776-31bc-46e0-9c7e-77150edde601` |
| 12 | Hunter Internacional | `338fdd11-4e2a-435c-a247-a63147c6e9d4` |

## Estrutura: 30 nós + start, ~40 edges

### Coluna 1 (x=100) — Entrada
- start (x=100, y=500)
- Nó 1: Boas-vindas (message, y=700)
- Nó 2: Condição cliente conhecido (condition_v2, y=900)
- Nó 3: Coleta email (ask_email, y=1100)

### Coluna 2 (x=500) — IA Triagem
- Nó 4: IA Triagem (ai_response, y=700) — 11 handles de saída

### Coluna 3 (x=950) — 10 IAs Especialistas
- Nó 5: IA Saque (y=100) → Transfer Financeiro
- Nó 6: IA Financeiro (y=320) → Transfer Financeiro (com cross-link saque→5)
- Nó 7: IA Cancelamento (y=540) → Transfer Suporte (com cross-links financeiro→6, sistema→10)
- Nó 8: IA Devoluções (y=760) → Transfer Pedidos (com cross-link financeiro→6)
- Nó 9: IA Pedidos (y=980) → Transfer Pedidos (com cross-link devolucao→8)
- Nó 10: IA Sistema (y=1200) → Transfer Sistema
- Nó 11: IA Comercial (y=1420) → Transfer Comercial (com cross-link consultor→13)
- Nó 12: IA Internacional (y=1640) → Transfer Internacional
- Nó 13: IA Consultor (y=1860) → Transfer Consultor
- Nó 14: IA Suporte (y=2080) → Transfer Suporte (com cross-links financeiro→6, cancelamento→7, pedidos→9, sistema→10)

### Coluna 4 (x=1450) — 8 Transfers
- Nó 20: Transfer Financeiro (y=200)
- Nó 21: Transfer Suporte pós-cancel (y=540)
- Nó 22: Transfer Suporte Pedidos (y=870)
- Nó 23: Transfer Suporte Sistema (y=1200)
- Nó 24: Transfer Comercial Nacional (y=1420)
- Nó 25: Transfer Comercial Internacional (y=1640)
- Nó 26: Transfer Consultor (y=1860)
- Nó 27: Transfer Suporte Geral (y=2080)

### Coluna 5 (x=1900) — Encerramento
- Nó 30: Mensagem de encerramento (y=1000)

### Edges (~42 conexões)
Todos os transfers (20-27) → Nó 30, mais os cross-links entre IAs especialistas conforme especificado.

## Nenhum arquivo de código alterado
Operação 100% via inserção/deleção no banco de dados.

