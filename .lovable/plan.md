

# Fix: Transferências sem departamento — 18 conversas presas

## Problema

Há **18 conversas abertas** em `waiting_human` com `department: null` e `assigned_to: null`. Incluindo a #1EBE4793.

**Causa raiz**: Dois caminhos de transferência no webhook não garantem departamento:

1. **Linha 854**: `if (flowData.departmentId)` — quando o `process-chat-flow` retorna `transfer: true` mas `departmentId` é null/undefined, nenhum departamento é setado
2. **Sem router**: Após o update da conversa, o webhook não chama `route-conversation` para distribuir para um agente — só faz a busca de consultor pelo TRANSFER-PERSIST-LOCK

## Solução

### 1. Fallback de departamento no webhook (`meta-whatsapp-webhook/index.ts`)

Na linha 854, quando `flowData.departmentId` é falsy, aplicar fallback para departamento "Suporte" (`36ce66cd-7414-4fc8-bd4a-268fecc3f01a`):

```typescript
// Antes:
if (flowData.departmentId) {
  updateData.department = flowData.departmentId;
}

// Depois:
const DEPT_SUPORTE_FALLBACK = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
updateData.department = flowData.departmentId || DEPT_SUPORTE_FALLBACK;
```

### 2. Chamar `route-conversation` após transfer no webhook

Após o update da conversa e TRANSFER-PERSIST-LOCK, chamar `route-conversation` para distribuir automaticamente para um agente online (mesma lógica que `ai-autopilot-chat` já faz).

### 3. Corrigir as 18 conversas presas (migration SQL)

Update em batch para setar `department = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a'` (Suporte) em todas as conversas com `status='open'`, `ai_mode='waiting_human'`, `department IS NULL`.

### Arquivos editados
- `supabase/functions/meta-whatsapp-webhook/index.ts` — fallback de dept + chamar route-conversation
- Migration SQL — corrigir 18 conversas presas

### Sem risco de regressão
- Fallback só ativa quando departmentId já era null (nada muda para transfers com dept definido)
- Router já existe e é chamado pelo autopilot — apenas replicando no webhook
- Conversas já atribuídas a agentes/departamentos não são afetadas

