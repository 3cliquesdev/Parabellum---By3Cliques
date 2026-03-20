

# Auditoria 100% — UUIDs Hardcoded em TODAS as Edge Functions

## Resumo da Situação

O `ai-autopilot-chat` já está **95% limpo**: persona dinâmica, templates via fluxo, SLAs genéricos, email subject dinâmico, TRANSFER_LABELS dinâmico. Os UUIDs de departamento nele são centralizados numa única query no início do handler.

**O problema restante é sistêmico**: 6 outras edge functions ainda têm UUIDs de departamento hardcoded (82 ocorrências em 8 arquivos). Isso quebra a soberania do ChatFlow — se alguém renomear/trocar departamentos no dashboard, o roteamento falha silenciosamente.

## Arquivos com UUIDs Hardcoded

| Arquivo | Ocorrências | Criticidade |
|---------|-------------|-------------|
| `process-chat-flow/index.ts` | `INTENT_DEPT_MAP` com 10 UUIDs (L3811-3823) | **ALTA** — roteamento de intenções |
| `meta-whatsapp-webhook/index.ts` | 5 locais com fallback UUIDs (L945, L1561, L1929, L2008, L2245) | **ALTA** — webhook principal |
| `handle-whatsapp-event/index.ts` | 2 locais (L959-960, L1434) | **ALTA** — webhook Evolution |
| `check-user-status/index.ts` | 2 constantes (L11-12) | MÉDIA — edge function auxiliar |
| `route-conversation/index.ts` | 1 fallback (L277) | MÉDIA — roteamento |
| `run-email-backfill/index.ts` | referências residuais | BAIXA |

## Plano de Correção

### Correção 1 — Módulo compartilhado `_shared/department-resolver.ts`

Criar um helper reutilizável que faz UMA query e cacheia os departamentos por nome:

```typescript
// supabase/functions/_shared/department-resolver.ts
export async function resolveDepartments(supabaseClient: any) {
  const { data } = await supabaseClient
    .from('departments')
    .select('id, name');
  
  const byName = new Map<string, string>();
  const bySlug = new Map<string, string>();
  for (const d of (data || [])) {
    byName.set(d.name, d.id);
    // slug: "Comercial - Nacional" → "comercial"
    const slug = d.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().split(/[\s\-\/]+/)[0];
    if (!bySlug.has(slug)) bySlug.set(slug, d.id);
  }
  return { byName, bySlug };
}
```

### Correção 2 — `process-chat-flow`: INTENT_DEPT_MAP dinâmico

Substituir o mapa fixo de 10 UUIDs por resolução via `bySlug` com fallback aos UUIDs atuais. A query é feita uma vez no início do handler.

### Correção 3 — `meta-whatsapp-webhook`: 5 fallbacks centralizados

Substituir os 5 `DEPT_SUPORTE_FALLBACK` / `DEPT_COMERCIAL_ID` locais por uma resolução centralizada no início do handler.

### Correção 4 — `handle-whatsapp-event`: mesmo padrão

Centralizar os 2 locais com UUIDs no início do handler.

### Correção 5 — `check-user-status`: resolver por nome

Substituir as constantes fixas por query dinâmica (função pequena, 1 query).

### Correção 6 — `route-conversation`: fallback dinâmico

Substituir o UUID fixo de fallback por resolução do departamento "Suporte" por nome.

## Estimativa

- 1 novo arquivo: `_shared/department-resolver.ts` (~25 linhas)
- 6 edge functions editadas: ~20 linhas cada (substituir UUIDs por variáveis resolvidas)
- 0 funcionalidade removida — todos os UUIDs atuais permanecem como fallback
- Deploy de 6 functions

## O que NÃO alterar
- `kiwify_events`, `kiwify_validated` — schema real do banco
- `allowed_sources: 'kiwify'` — tipo de interface
- Frontend (`src/`) — já está limpo (0 UUIDs hardcoded)

