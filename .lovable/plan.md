

# Adicionar botão "Aprovar Auditado" na tabela de Auditoria

## Problema atual
Depois de corrigir categoria/product_tags inline, não há ação clara para "finalizar" a auditoria — gerar embedding e publicar o artigo. O usuário fica sem saber o que fazer depois.

## Solução

### Coluna "Ações" na tabela com botão contextual por artigo

Cada linha ganha uma coluna **Ações** com um botão que muda conforme o estado:

| Estado do artigo | Botão | O que faz |
|---|---|---|
| Sem embedding (🔴) | **"Gerar Embedding"** | Chama `generate-article-embedding`, atualiza `embedding_generated=true` |
| Com embedding mas Rascunho | **"Publicar"** | Atualiza `is_published=true` |
| Tem problemas (sem categoria, etc) | Botão desabilitado com tooltip "Corrija os problemas primeiro" | — |
| Tudo OK + Publicado | **✓ Auditado** (badge verde, sem ação) | — |

### Ação em lote: "Aprovar selecionados"
Na barra de bulk actions (quando tem artigos selecionados), adicionar botão **"✅ Aprovar auditados"** que para cada artigo selecionado sem problemas:
1. Gera embedding (se não tem)
2. Publica (se é rascunho)

### Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/components/KnowledgeAuditTab.tsx` | Adicionar coluna "Ações" com botões contextuais + ação bulk "Aprovar auditados" |

O hook `useGenerateEmbedding` já existe e será reutilizado. A lógica de publicar é um simples `update` no Supabase.

