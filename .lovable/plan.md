

# Auditoria Completa — Verificação de Integridade dos Fixes

## Status: 5 de 6 Fixes ✅ | 1 Bug Remanescente 🔴

---

## ✅ Fix 1: Counter Anti-Loop Unificado — CORRETO

- **Linha 9427-9429**: Antigo local do counter agora tem comentário explicando que foi movido
- **Linhas 9951-9985**: Counter update unificado roda APÓS todo o pipeline (strip, contract violation, restriction violation)
- **`isFallbackResponse`** é corretamente marcado `true` na linha 9532 quando strip esvazia a mensagem
- **Linha 9556-9560**: Só reseta `isFallbackResponse=false` se a mensagem NÃO ficou vazia — lógica correta
- **Anti-loop per-node**: threshold 2 (linha 9346) + global threshold 4 (linha 9988) — ambos operacionais

## ✅ Fix 2: Auto-Ticket Financeiro no Anti-Loop — CORRETO

- **Linhas 9384-9412**: Detecta nó financeiro via `node_id.includes('financ')` ou `collectedData.assunto`
- Cria ticket com `priority: 'high'`, `category: 'financeiro'`
- Executa ANTES do `return flowExit` (linha 9414) — ordem correta

## ✅ Fix 3: Persistência Antes de Envio — CORRETO

- **Linhas 10037-10047**: Se INSERT no banco falha → return HTTP 500 → WhatsApp NÃO recebe
- Consistência garantida

## ✅ Fix 4: Soberania Humana (process-chat-flow) — CORRETO

- **Linhas 865-882**: Se `convState?.assigned_to` existe → cancela flow state residual → retorna `skipAutoResponse: true`
- **Sem agente** (linha 884): mantém soberania do fluxo — comportamento original preservado
- Sem lógica conflitante em outro lugar do arquivo

## ✅ Fix 5: Auto-Takeover Cancela Flow States (useSendMessageInstant) — CORRETO

- **Linhas 335-348**: Após `auto_assign_on_send` bem-sucedido, cancela flow states residuais
- Dupla proteção: RPC SQL + frontend hook

## ✅ Fix 6: LLM Call Restaurada — CORRETO

- **Linhas 7680-7688**: `callAIWithFallback(aiPayload)` chamada ANTES do processamento de `rawAIContent`
- **Retry** (linhas 7690-7715): Se LLM retorna vazio, retry com prompt reduzido
- **Auto-exit por intent** (linhas 7718-7743): Se ainda vazio + intent financeiro/cancelamento/comercial → `FLOW_EXIT`
- Sem ReferenceError possível — `aiData`, `rawAIContent` e `toolCalls` definidos em sequência

---

## 🔴 Bug Remanescente: route-conversation PostgREST `.in()` sem `!inner`

**Arquivo:** `supabase/functions/route-conversation/index.ts`

**Problema:** Na linha 592, o SELECT usa `agent_departments(department_id)` SEM `!inner`. Na linha 616, aplica `.in('agent_departments.department_id', deptIds)` para filtrar por departamento.

Sem `!inner`, o PostgREST retorna TODOS os profiles e filtra apenas o array embutido `agent_departments`. Isso significa que **agentes de OUTROS departamentos são retornados com arrays vazios** e passam pelo filtro — eles NÃO são excluídos do resultado.

O path skill-based (linhas 472-478) faz filtragem client-side via JS, então funciona corretamente. Mas o path genérico (linha 616) depende do PostgREST e está furado.

**Fix:** Alterar a linha 592 para usar `agent_departments!inner(department_id)` quando o filtro de departamento será aplicado. Alternativa: aplicar filtragem client-side como no path skill-based.

**Impacto:** Agentes de departamentos errados podem receber conversas no round-robin quando o routing cai no path genérico (seção 5, linhas 514+). Isso explica parcialmente o erro `operator does not exist: uuid && unknown` — o `.in()` sem `!inner` pode ter comportamento inconsistente.

### Plano de correção

Substituir a filtragem PostgREST (linha 616) por filtragem client-side, seguindo o mesmo padrão do path skill-based:

```typescript
// Remover: agentsQuery = agentsQuery.in('agent_departments.department_id', deptIds);
// Após a query, filtrar client-side:
allGenericAgents = allGenericAgents.filter(a => {
  const agentDepts = Array.isArray(a.agent_departments)
    ? a.agent_departments.map(d => d.department_id)
    : [a.agent_departments?.department_id].filter(Boolean);
  return deptIds.some(d => agentDepts.includes(d));
});
```

### Arquivo a alterar
- `supabase/functions/route-conversation/index.ts` — Fix do filtro de departamento

