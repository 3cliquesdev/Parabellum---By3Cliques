
# Corrigir edição rápida na Auditoria

## Diagnóstico
Pelo código atual, há dois problemas diferentes:

1. **O popup pode até abrir, mas a ação de editar está pouco evidente**
   - Hoje existe só um botão pequeno com ícone de lápis na coluna **Ações**.
   - No replay, o clique capturado foi no botão **Embedding**, não no botão de editar.
   - Ou seja: o problema parece ser mais de **usabilidade/descoberta** do que de estado do dialog.

2. **O campo “Problema” realmente não salva**
   - O dialog carrega `problem` e `solution`, mas o `handleSave()` não envia esses campos.
   - O hook `useUpdateKnowledgeArticle` também não aceita `problem`/`solution`.
   - Então mesmo editando no popup, essa mudança é descartada.

## O que vou implementar

### 1. Tornar a abertura do artigo óbvia
Em `src/components/KnowledgeAuditTab.tsx`:
- trocar o ícone solto por um botão mais claro, tipo **“Editar”** ou ícone + tooltip reforçado;
- permitir abrir o popup também clicando no **título** do artigo, para não depender só do lápis pequeno;
- manter o dialog montado no nível da página, como já está.

### 2. Fazer “Problema” e “Solução” salvarem de verdade
Em `src/hooks/useUpdateKnowledgeArticle.tsx`:
- adicionar `problem?: string` e `solution?: string` ao payload de update.

Em `src/components/knowledge/AuditArticleEditDialog.tsx`:
- incluir `problem` e `solution` no `updateArticle.mutate(...)`;
- ajustar o envio para aceitar string vazia/null de forma consistente.

### 3. Melhorar a robustez do popup
Em `src/components/knowledge/AuditArticleEditDialog.tsx`:
- limpar estado ao fechar ou trocar de artigo, para evitar conteúdo “preso” do artigo anterior;
- tratar erro ao buscar o artigo e mostrar feedback se a carga falhar;
- manter loading claro enquanto os dados são carregados.

## Arquivos a editar
- `src/components/KnowledgeAuditTab.tsx`
- `src/components/knowledge/AuditArticleEditDialog.tsx`
- `src/hooks/useUpdateKnowledgeArticle.tsx`

## Resultado esperado
Depois disso:
- ficará fácil abrir o artigo pela Auditoria;
- o popup vai funcionar como edição rápida real;
- alterações em **Problema** e **Solução** serão persistidas corretamente.