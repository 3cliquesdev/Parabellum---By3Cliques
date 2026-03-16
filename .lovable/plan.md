

# Filtro de KB por Produto — Plano de Implementação

## Problema

Os artigos da KB são categorizados por **tópico** (Logística, Financeiro, etc.), não por **produto** (Drop Nacional, Internacional, Híbrido). Quando o cliente escolhe "Drop Nacional" no menu, a IA busca artigos de todas as modalidades, podendo retornar informações irrelevantes sobre Drop Internacional, por exemplo.

## Abordagem Escolhida

Adicionar um campo `product_tags` nos artigos da KB para filtrar por produto, e propagar o produto escolhido no fluxo até o motor de busca semântica.

### Etapa 1 — Banco de Dados
- Adicionar coluna `product_tags text[]` na tabela `knowledge_articles` (default `'{}'`)
- Atualizar a função RPC `match_knowledge_articles` para aceitar parâmetro opcional `product_filter text[]` e filtrar artigos que tenham pelo menos uma tag em comum (ou que não tenham tags, tratando como "geral/todos")

### Etapa 2 — Taguear Artigos Existentes
- Executar UPDATE em lote nos ~40 artigos que mencionam drop, tagueando com `drop_nacional`, `drop_internacional`, `drop_hibrido` ou combinações
- Artigos genéricos (aplicáveis a todos) ficam com array vazio `{}` (sem filtro)

### Etapa 3 — Motor de Fluxo (`process-chat-flow`)
- Nos pontos onde `kbCategories` é passado ao autopilot, também passar `kbProductFilter` extraído de `collectedData.produto`
- Mapeamento: `"Drop Nacional"` → `["drop_nacional"]`, `"Drop Internacional"` → `["drop_internacional"]`, `"Drop Híbrido"` → `["drop_hibrido"]`

### Etapa 4 — Autopilot (`ai-autopilot-chat`)
- Receber `kbProductFilter` no `flow_context`
- Passar para a busca semântica (`match_knowledge_articles`) como filtro adicional
- Artigos sem tags continuam retornando (comportamento "geral")

### Etapa 5 — UI (Editor de Artigos)
- Adicionar campo multi-select de `product_tags` no formulário de criação/edição de artigos da KB
- Opções fixas: Drop Nacional, Drop Internacional, Drop Híbrido

## Resumo de Arquivos Afetados

| Componente | Tipo | Ação |
|-----------|------|------|
| `knowledge_articles` (tabela) | Migration | Adicionar coluna `product_tags` |
| `match_knowledge_articles` (RPC) | Migration | Adicionar parâmetro `product_filter` |
| `process-chat-flow/index.ts` | Edge Function | Propagar produto como `kbProductFilter` |
| `ai-autopilot-chat/index.ts` | Edge Function | Receber e usar `kbProductFilter` na busca |
| Editor de artigos KB (UI) | Componente React | Multi-select de tags de produto |

