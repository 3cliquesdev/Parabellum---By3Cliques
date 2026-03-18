

# Como a IA encontra artigos e o que está falhando

## Pipeline de busca atual (RAG)

A IA encontra artigos através de **3 filtros em cascata**:

```text
Mensagem do cliente
       │
       ▼
┌─────────────────────────┐
│ 1. EMBEDDING SEMÂNTICO  │  ← Busca por similaridade vetorial (threshold 0.55)
│    match_knowledge_      │    Filtra por: product_tags (se configurado no fluxo)
│    articles RPC          │    NÃO filtra por category nem tags[]
└──────────┬──────────────┘
           │ 0 resultados?
           ▼
┌─────────────────────────┐
│ 2. FALLBACK KEYWORDS    │  ← Busca por ilike no título/conteúdo
│    Filtra por:           │    - category (se persona tem kb_categories)
│                          │    - product_tags (se fluxo tem kbProductFilter)
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ 3. FILTRO PÓS-BUSCA     │  ← Remove artigos fora das categorias da persona
│    personaCategories     │    (category do artigo precisa estar na lista)
└─────────────────────────┘
```

## O problema raiz: 3 causas de "0 artigos"

1. **`product_tags` não tem UI** — O campo existe no banco mas o editor de artigos NÃO permite editar `product_tags`. Quando o fluxo envia `kbProductFilter: ["Drop Nacional"]`, a RPC só retorna artigos com `product_tags` contendo "Drop Nacional" OU artigos com `product_tags = {}` (vazios). Se alguém preencheu product_tags erradas, o artigo some.

2. **`category` desalinhada** — O filtro pós-busca (L4712-4718) remove artigos cuja `category` não está na lista `personaCategories` (configurada na persona ou no nó do fluxo). Se o artigo tem `category: "Geral"` mas a persona só aceita `["Financeiro", "Pedidos"]`, é descartado.

3. **`tags[]` NÃO é usado na busca** — O campo `tags` dos artigos (ex: "api, erro, integração") é apenas informativo. A IA **não filtra por tags**. Então trocar tags não resolve nada hoje.

## Plano de solução

### Parte 1: Ferramenta de Auditoria de KB (nova página)

Criar página `/knowledge/audit` com:

- **Tabela de todos os artigos** mostrando: título, category, product_tags, tags, status do embedding, is_published
- **Indicadores visuais** de problemas:
  - 🔴 Artigo sem embedding
  - 🟡 Artigo sem category
  - 🟡 Artigo com product_tags vazio (genérico — pode ser intencional)
  - 🔴 Artigo com category que não existe em nenhuma persona/fluxo
- **Edição inline** de `category` e `product_tags` (os dois campos que realmente afetam a busca)
- **Filtros** por: status de problemas, category, product_tags
- **Ação em lote**: Atribuir category/product_tags a múltiplos artigos de uma vez

### Parte 2: Adicionar `product_tags` ao editor de artigos

No `KnowledgeArticleDialog`, adicionar campo para editar `product_tags` com chips selecionáveis (ex: "Drop Nacional", "Drop Internacional", "Seller Center", etc.), puxando valores distintos do banco.

### Parte 3: Melhorar busca semântica

- Na RPC `match_knowledge_articles`, incluir o campo `tags` no retorno para que o fallback por keywords também busque em `tags` (hoje só busca título e conteúdo)
- No fallback por keywords (L4674), adicionar: `title.ilike.%${term}%,content.ilike.%${term}%,tags.cs.{${term}}`

### Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| `src/pages/KnowledgeAudit.tsx` | CRIAR — página de auditoria |
| `src/hooks/useKnowledgeAudit.tsx` | CRIAR — hook com query de artigos + diagnóstico |
| `src/components/KnowledgeArticleDialog.tsx` | EDITAR — adicionar campo product_tags |
| `src/hooks/useCreateKnowledgeArticle.tsx` | Já suporta product_tags |
| `src/hooks/useUpdateKnowledgeArticle.tsx` | Já suporta product_tags |
| `supabase/functions/ai-autopilot-chat/index.ts` | EDITAR — adicionar busca em tags no fallback |
| `src/App.tsx` | EDITAR — adicionar rota /knowledge/audit |
| Migration SQL | Criar RPC para listar product_tags distintos |

