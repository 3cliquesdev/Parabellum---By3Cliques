

# Auditoria: Bulk Re-engage — Problemas Encontrados

## Status Geral: 3 problemas a corrigir

### Problema 1: Auto-distribuir não cria dispatch job
Quando o destino é "Auto-distribuir (Round Robin)", o código apenas limpa o `assigned_to` mas **não cria um `conversation_dispatch_job`**. Isso significa que a conversa reabre sem agente e fica órfã — ninguém será notificado.

**Correção:** Após reabrir a conversa com `auto_distribute`, inserir um registro em `conversation_dispatch_jobs` com `status: 'pending'` e o `department` da conversa, para que o sistema de round-robin a distribua automaticamente.

### Problema 2: Throttle de 50ms é insuficiente para Meta
50ms = ~20 msgs/segundo. A Meta permite até 80/s para contas verificadas, mas contas menores podem ser throttled. Com 118 conversas, é seguro, mas o ideal é aumentar para **200ms** (~5/s) para evitar bloqueios temporários.

**Correção:** Aumentar o delay de 50ms para 200ms.

### Problema 3: Falta invalidação de cache do filtro archived
Após reengajar, as conversas saem de `archived` para `open`, mas o `queryClient.invalidateQueries` não invalida especificamente o cache de `inbox-view` com scope `archived`, podendo deixar a lista desatualizada.

**Correção:** Já invalida `["conversations"]` e `["inbox-view"]` genericamente, o que deveria funcionar. Verificar se o `queryKey` do `useInboxView` começa com `["inbox-view"]` — se sim, está OK.

---

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/inbox/BulkReengageDialog.tsx` | Criar dispatch job para auto_distribute; aumentar throttle para 200ms |

## Resumo das mudanças

1. Após `supabase.from("conversations").update(updateData)`, se `destinationType === "auto_distribute"`, inserir em `conversation_dispatch_jobs`
2. Mudar `setTimeout(r, 50)` → `setTimeout(r, 200)`

