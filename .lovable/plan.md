

# Fix: Tabela de auditoria com colunas cortadas / não clicável

## Problema
A tabela de auditoria tem 8 colunas (checkbox, título, categoria, product_tags, tags, status, problemas, ações) — muitas para a tela. A coluna "Ações" (com botões de Embedding/Publicar/Auditado) fica cortada fora da viewport. As colunas "vazio" de category e product_tags podem não estar recebendo cliques.

## Solução

### 1. Tornar a tabela scrollável horizontalmente
Envolver a `<Table>` em um `<div className="overflow-x-auto">` para permitir scroll horizontal quando necessário.

### 2. Reduzir colunas — remover "Tags" da tabela
A coluna "Tags" é informativa e não afeta a busca (conforme diagnóstico anterior). Removê-la da tabela libera espaço para as colunas que importam.

### 3. Mover coluna "Ações" para antes de "Problemas"
Colocar o botão de ação mais visível, logo após "Status".

### 4. Fixar larguras mínimas nas colunas críticas
- Título: `min-w-[200px]`
- Categoria: `min-w-[140px]`  
- Product Tags: `min-w-[150px]`
- Ações: `min-w-[120px]`

### Arquivo a editar
| Arquivo | Mudança |
|---|---|
| `src/components/KnowledgeAuditTab.tsx` | Wrap table em overflow-x-auto, remover coluna Tags, reordenar colunas, ajustar larguras |

