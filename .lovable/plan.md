

# Teste E2E do Fluxo V5 Enterprise — Diagnóstico e Correções

## Resultado da Auditoria

### ✅ Componentes Funcionando
1. **Master Flow V5** — ativo e processando conversas em produção
2. **Personas** — corretamente selecionadas por nó (Ana Júlia, Helper Consultor, etc.)
3. **Ferramentas** — vinculadas às personas (check_tracking, search_knowledge_base, create_ticket, etc.)
4. **Transfers** — mecanismo de transferência entre departamentos operacional
5. **collectedData** — produto salvo corretamente como texto ("Drop Nacional", "Drop Híbrido")
6. **mapProductToKbFilter** — presente em 9 pontos de retorno no process-chat-flow
7. **ai-autopilot-chat** — código recebe e usa `kbProductFilter` na chamada RPC
8. **knowledge_articles.product_tags** — coluna existe, 24 artigos tagueados de 230

### 🔴 Bug Crítico Encontrado
**A função RPC `match_knowledge_articles` no banco de dados NÃO tem o parâmetro `product_filter`.**

A versão atual no banco:
```sql
-- SEM product_filter
match_knowledge_articles(query_embedding, match_threshold, match_count)
```

A versão esperada (da migration):
```sql
-- COM product_filter
match_knowledge_articles(query_embedding, match_threshold, match_count, product_filter text[] DEFAULT '{}')
```

**Causa provável**: A migration criou a função corretamente, mas outra migration ou operação posterior sobrescreveu a função de volta para a versão antiga (sem o parâmetro).

**Impacto**: O filtro de produto é passado pelo código mas **ignorado pelo banco** — a busca retorna artigos de todos os produtos, anulando todo o pipeline de filtragem.

## Plano de Correção

### Etapa 1 — Re-aplicar a função RPC
Executar migration para recriar `match_knowledge_articles` com o parâmetro `product_filter` (mesmo SQL da migration original).

### Etapa 2 — Validar via query direta
Testar a RPC chamando com `product_filter = '{drop_nacional}'` e verificar que retorna apenas artigos tagueados como `drop_nacional` + artigos genéricos (`{}`).

### Etapa 3 — Deploy das Edge Functions
Garantir que `ai-autopilot-chat` e `process-chat-flow` estejam deployados com o código atual (que já inclui `kbProductFilter`).

## Arquivos Afetados
| Componente | Ação |
|-----------|------|
| Nova migration SQL | Recriar `match_knowledge_articles` com `product_filter` |
| Edge Functions | Redeploy (código já está correto) |

