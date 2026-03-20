
# Atualizar registros de branding no banco

Preciso executar 3 UPDATEs via migration (o banco é read-only para queries diretas):

## Registros identificados

| Tabela | ID | Campo | Valor Atual | Novo Valor |
|--------|----|-------|-------------|------------|
| `organizations` | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` | `name` | `Kiwify` | `3Cliques \| CRM` |
| `email_branding` | `67dc8e89-...` (default customer) | `name` | `Seu Armazém Drop` | `3Cliques \| CRM` |
| `email_branding` | `42111d31-...` (default employee) | `name` | `3Cliques \| CRM` | Já está correto ✅ |
| `email_senders` | `36a8b607-...` (default) | `from_name` | `Seu Armazém Drop` | `3Cliques \| CRM` |

## SQL a executar (1 migration)

```sql
UPDATE organizations SET name = '3Cliques | CRM' WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
UPDATE email_branding SET name = '3Cliques | CRM' WHERE id = '67dc8e89-326e-4e71-b71f-2d83084ebf5c';
UPDATE email_senders SET from_name = '3Cliques | CRM' WHERE id = '36a8b607-1075-459b-8b84-b5c5e9468d73';
```

Nenhuma alteração de código necessária — todas as edge functions já usam `resolveBranding()` que busca esses valores dinamicamente.
