
# Adicionar Coluna "Tags" ao Relatorio de Tickets Excel

## O que sera feito

Adicionar uma coluna "Tags" ao relatorio de tickets que mostra todas as tags associadas a cada ticket, separadas por virgula.

## Abordagem Tecnica

Como a relacao `tickets` -> `ticket_tags` -> `tags` e many-to-many (um ticket pode ter varias tags), a melhor abordagem e usar `STRING_AGG` no SQL para concatenar os nomes das tags em uma unica string.

### 1. Atualizar a RPC `get_tickets_export_report` (nova migration)

Adicionar um subselect com `STRING_AGG` para trazer todas as tags do ticket concatenadas:

```sql
(SELECT STRING_AGG(tg.name, ', ' ORDER BY tg.name)
 FROM ticket_tags tt
 JOIN tags tg ON tg.id = tt.tag_id
 WHERE tt.ticket_id = t.id
) AS tags_list
```

Novo campo no `RETURNS TABLE`: `tags_list TEXT`

### 2. Atualizar o hook `useTicketsExportReport.tsx`

Adicionar `tags_list: string | null` na interface `TicketExportRow`.

### 3. Atualizar o hook `useExportTicketsExcel.tsx`

Adicionar a coluna `"Tags": r.tags_list || ""` no mapeamento do Excel.

### 4. Atualizar a pagina `TicketsExportReport.tsx`

Adicionar a coluna "Tags" na tabela de preview.

### Impacto
- Zero regressao: apenas adicao de um campo novo na RPC e nos componentes existentes
- Tags separadas por virgula quando o ticket tem mais de uma
