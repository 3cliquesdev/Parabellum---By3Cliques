

# Plano: Auditoria IA — Correções Prioritárias (Semana 1)

Baseado na auditoria completa, foco nos quick wins de maior impacto.

---

## 1. Fix auto-handoff UUID hardcoded (Bug A)

**Arquivo:** `supabase/functions/auto-handoff/index.ts` linha 141

Substituir UUID fixo por busca dinâmica:
```typescript
// ANTES: const FALLBACK_DEPT_SUPORTE = '36ce66cd-...';
// DEPOIS:
const { data: deptSuporte } = await supabaseClient
  .from('departments')
  .select('id')
  .ilike('name', '%suporte%')
  .eq('is_active', true)
  .limit(1)
  .maybeSingle();
const FALLBACK_DEPT_SUPORTE = deptSuporte?.id || null;
```

Se `null`, loga warning e apenas seta `ai_mode: waiting_human` sem forçar departamento.

---

## 2. Fix markdown nas notas internas (Bug B)

**Arquivo:** `supabase/functions/auto-handoff/index.ts` linhas 78, 97, 174-181

Remover `**bold**` e formatação markdown das notas internas — usar texto plano com emojis para legibilidade cross-canal.

---

## 3. Memória cross-session no ai-autopilot-chat

**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts`

Ao montar o contexto, buscar últimas 3 conversas fechadas do mesmo `contact_id`:
```sql
SELECT id, closed_at, customer_metadata->>'ai_summary' as summary
FROM conversations
WHERE contact_id = $1 AND status = 'closed'
ORDER BY closed_at DESC LIMIT 3
```

Incluir no system prompt: "Histórico do cliente: [resumos das conversas anteriores]"

---

## 4. Persona contextual baseada em status do contato

**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts` (na geração do prompt)

Adicionar variação de tom no prompt baseado em:
- Status do contato (VIP, novo, churn risk)
- Contexto financeiro (se `forbid_financial` ativo → tom empático)
- Sentimento detectado em mensagens anteriores

---

## Arquivos afetados

| Arquivo | Mudanças |
|---|---|
| `auto-handoff/index.ts` | UUID dinâmico + notas sem markdown |
| `ai-autopilot-chat/index.ts` | Memória cross-session + persona contextual |

## Itens para Semana 2+ (não incluídos neste plano)

- Auto-KB Gap Detection (nova edge function)
- Proactive Messaging
- Agent Orchestration
- `transition-conversation-state` (refactor arquitetural)

