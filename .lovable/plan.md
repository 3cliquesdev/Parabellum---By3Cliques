

# Hardening Final: 5 ocorrencias restantes de select("*")

## Status atual

O trabalho principal ja foi concluido em mensagens anteriores:
- Helper `src/lib/supabase-count.ts` -- criado
- ESLint guardrail em `eslint.config.js` -- configurado
- 28 substituicoes nos hooks originais -- aplicadas

Restam apenas **5 ocorrencias** em 3 arquivos que nao estavam no inventario original.

## Mudancas

### 1. `src/hooks/useConsultantDistributionReport.tsx` (2 substituicoes)

Linhas 48 e 55: trocar `select("*", { count: "exact", head: true })` por `select("id", { count: "exact", head: true })`.

### 2. `src/hooks/useCopilotSuggestions.tsx` (1 substituicao)

Linha 149: mesma troca.

### 3. `supabase/functions/test-whatsapp-webhook/index.ts` (2 substituicoes)

Linhas 142 e 147: mesma troca. Nota: edge functions usam o Supabase client da mesma forma, a mudanca e identica e segura.

## Seguranca

Todas as 5 ocorrencias usam `{ head: true, count: "exact" }` -- zero body retornado, apenas header Content-Range. Trocar `"*"` por `"id"` nao altera o resultado.

## Arquivos modificados

| Arquivo | Tipo | Mudanca |
|---|---|---|
| `src/hooks/useConsultantDistributionReport.tsx` | EDIT | 2x `"*"` para `"id"` |
| `src/hooks/useCopilotSuggestions.tsx` | EDIT | 1x `"*"` para `"id"` |
| `supabase/functions/test-whatsapp-webhook/index.ts` | EDIT | 2x `"*"` para `"id"` |

## Resultado final

Apos esta mudanca: **zero ocorrencias** de `select("*")` em todo o projeto (frontend + edge functions).

