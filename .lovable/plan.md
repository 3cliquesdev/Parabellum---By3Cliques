

# Plano: Adicionar Todas as Bases de Dados ao Painel de Fontes RAG do Nó IA

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Problema

O painel "DE ONDE A IA BUSCA INFORMAÇÃO" do nó Resposta IA só mostra **2 fontes**: Artigos/FAQ e Rastreio de Envio. Faltam as demais bases que o sistema já possui:

| Base | Status no Painel |
|---|---|
| Artigos e FAQ | ✅ Presente |
| Rastreio de Envio | ✅ Presente |
| **Clientes / CRM** | ❌ Ausente |
| **Kiwify (Vendas/Financeiro)** | ❌ Ausente |
| **Treinamento Sandbox** | ❌ Ausente |

O widget `KnowledgeSourcesWidget` na página AI Trainer já lista 5 fontes. O painel do nó precisa espelhar isso.

## Solução

Adicionar 3 novas fontes toggleáveis ao `RAGSourcesSection.tsx`:

### 1. CRM / Clientes
- Ícone: `Users` (lucide)
- Badge: `CRM`
- Campo no nó: `use_crm_data` (boolean)
- Descrição: "A IA consulta dados do cliente (nome, email, status, consultor)"

### 2. Kiwify (Vendas/Financeiro)
- Ícone: `ShoppingCart` (lucide)
- Badge: `Kiwify`
- Campo no nó: `use_kiwify_data` (boolean)
- Descrição: "A IA consulta pedidos e status de pagamento"

### 3. Treinamento Sandbox
- Ícone: `GraduationCap` (lucide)
- Badge: `Sandbox`
- Campo no nó: `use_sandbox_data` (boolean)
- Descrição: "A IA consulta regras aprendidas por correção manual"

Cada fonte segue o mesmo padrão visual já existente (card com Switch + Badge de origem + descrição condicional).

## Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — fontes existentes não são alteradas |
| Kill Switch | Não afetado — só configura UI |
| Fluxo existente | Preservado — campos novos são opcionais (default false) |
| Auditoria | N/A — configuração de nó de fluxo |

## Arquivo

| Arquivo | Mudança |
|---|---|
| `src/components/chat-flows/panels/RAGSourcesSection.tsx` | Adicionar 3 blocos de fonte (CRM, Kiwify, Sandbox) com switches toggleáveis |

