

# Fix: RPC `get_inbox_time_report` — type mismatch

## Causa Raiz

A RPC retorna erro 400: `"Returned type numeric does not match expected type double precision in column 14"`.

`EXTRACT(EPOCH FROM ...)` e `PERCENTILE_CONT(...)` retornam `numeric` no Postgres, mas o `RETURNS TABLE` declara essas colunas como `double precision`.

## Solução

Uma migration para recriar a RPC com casts explícitos `::double precision` em todas as colunas numéricas calculadas:

- Linhas 136-141 (metrics): `m.ai_fr_sec::double precision`, etc.
- Linhas 145-153 (aggregates): `a.avg_ai_fr::double precision`, `a.p50_ai_fr::double precision`, etc.

Nenhuma mudança no frontend necessária — apenas o cast de tipo no SQL.

