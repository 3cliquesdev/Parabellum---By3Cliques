

# Botão de edição rápida do artigo na Auditoria

## O que será feito

Adicionar um botão de **edição (ícone lápis)** em cada linha da tabela de auditoria. Ao clicar, abre um **Dialog/Sheet** com formulário para editar os campos principais do artigo:

- **Título**
- **Conteúdo** (textarea)
- **Categoria** (select)
- **Product Tags** (input com vírgulas)
- **Tags** (input com vírgulas)
- **Problema / Solução** (textareas, se preenchidos)

O dialog usa o componente `ResponsiveDialogSheet` já existente (drawer no mobile, sheet no desktop).

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/knowledge/AuditArticleEditDialog.tsx` | **Novo** — componente de edição rápida com form, usa `useUpdateKnowledgeArticle` |
| `src/components/KnowledgeAuditTab.tsx` | Adicionar botão ✏️ na coluna "Ações" ao lado do botão contextual existente, abrindo o dialog |

## Detalhes

- O dialog busca o artigo completo (`title, content, category, product_tags, tags, problem, solution`) ao abrir
- Usa o hook `useUpdateKnowledgeArticle` já existente para salvar
- Invalida `knowledge-audit-articles` no sucesso para atualizar a tabela
- Botão ✏️ aparece sempre (independente do estado do artigo), ao lado do botão de ação contextual

