

# Auditoria: Conversas na Fila da IA não estão sendo encerradas

## Resultado da Auditoria

**9 conversas** na fila da IA. **6 deveriam ter sido encerradas** (>5 min inativas com última msg da IA):

| Contato | Dept | Idle (min) | Último sender | Deveria fechar? |
|---------|------|-----------|---------------|----------------|
| Marciel Fersan | Suporte | 48 | IA | **SIM** (>5min) |
| Andréa Rossi | Suporte | 48 | IA | **SIM** (>5min) |
| Mm Variedades | Suporte | 22 | IA | **SIM** (>5min) |
| Júnio Célio | Suporte | 20 | IA | **SIM** (>5min) |
| Diego Teixeira | Suporte Sistema | 13 | cliente | NÃO (aguarda resposta) |
| Rafael | Suporte | 11 | IA | **SIM** (>5min) |
| PRX Soluções | Suporte | 6 | IA | **SIM** (>5min) |
| LOIDE | Suporte | 1 | IA | NÃO (<5min) |
| Gisiele | Suporte | 0 | cliente | NÃO (ativa) |

## Bug Encontrado

**Arquivo:** `supabase/functions/auto-close-conversations/index.ts`

**Linhas 247-264** — A Etapa 2 busca departamentos com `auto_close_enabled = true AND auto_close_minutes IS NOT NULL`. Quase NENHUM departamento tem isso ativado (só "Comercial - Internacional"). Quando retorna 0, a função **faz `return` na linha 260**, impedindo que Etapas 3, 3b, 4 e 5 executem.

```text
Fluxo atual:
  Etapa 1   (24h window)     → OK
  Etapa 1.5 (SLA alert)      → OK  
  Etapa 2   (auto_close_enabled) → 0 depts → RETURN ❌ ← AQUI
  Etapa 3   (ai_auto_close)  → NUNCA EXECUTA
  Etapa 3b  (no-dept AI)     → NUNCA EXECUTA
  Etapa 4   (human auto-close) → NUNCA EXECUTA
  Etapa 5   (waiting_human)  → NUNCA EXECUTA
```

Os departamentos têm `ai_auto_close_minutes: 5` e `human_auto_close_minutes: 5` configurados, mas `auto_close_enabled: false` e `auto_close_minutes: null`. A Etapa 2 é para o antigo sistema genérico. As Etapas 3-5 são o sistema novo por tipo (IA/humano) e nunca rodam por causa do `return`.

## Correção

**Remover o `return` prematuro** nas linhas 258-264 de `auto-close-conversations/index.ts`. Substituir por um simples log e continuar para as próximas etapas:

```typescript
// ANTES (linhas 258-264):
if (!departments || departments.length === 0) {
  console.log('[Auto-Close] No departments with auto_close_enabled found');
  return new Response(...)  // ← IMPEDE ETAPAS 3-5
}

// DEPOIS:
if (!departments || departments.length === 0) {
  console.log('[Auto-Close] No departments with legacy auto_close_enabled — skipping Stage 2');
}
```

E envolver o loop da Etapa 2 em `if (departments && departments.length > 0) { ... }` para que só execute quando houver departamentos, mas **não bloqueie** as etapas seguintes.

**1 arquivo alterado:** `supabase/functions/auto-close-conversations/index.ts`

