
## Trava Anti-Duplicacao de Playbooks

### Problema
Quando um cliente tem recorrencias (assinaturas), cada cobranca dispara o webhook Kiwify novamente, que chama `initiatePlaybook()` sem nenhuma verificacao se ja existe uma execucao ativa. Resultado: multiplas execucoes simultaneas do mesmo playbook para o mesmo contato (como aconteceu com edevaldo.horizonn@gmail.com - 3 execucoes ao mesmo tempo).

### Onde falta a trava

| Ponto de disparo | Tem anti-duplicacao? |
|---|---|
| `public-start-playbook` | Sim (linhas 200-220) |
| `kiwify-webhook` → `initiatePlaybook()` | **Nao** |
| `execute-playbook` (manual) | **Nao** |
| `bulk-trigger-playbook` | Parcial (so checa `skipExisting` por qualquer status) |

### Solucao

Adicionar verificacao anti-duplicacao nos 3 pontos que estao sem:

**1. `kiwify-webhook/index.ts` - funcao `initiatePlaybook()`**

Antes de criar a execucao (linha 324), adicionar:

```typescript
// ANTI-DUPLICACAO: verificar se ja existe execucao running/pending
const { data: existing } = await supabase
  .from('playbook_executions')
  .select('id, status')
  .eq('playbook_id', playbook_id)
  .eq('contact_id', contact_id)
  .in('status', ['pending', 'running'])
  .maybeSingle();

if (existing) {
  console.log(`[initiatePlaybook] ⚠️ Execucao ja ativa: ${existing.id} (${existing.status}). Pulando.`);
  return null;
}
```

**2. `execute-playbook/index.ts` (disparo manual)**

Antes de criar a execucao (linha 117), adicionar a mesma verificacao, retornando a execucao existente em vez de criar uma nova.

**3. `bulk-trigger-playbook/index.ts` - funcao `processContact()`**

Antes de criar execucao (linha 117), adicionar verificacao por `running`/`pending` (atualmente so checa `skipExisting` para qualquer status historico).

### Arquivos alterados

1. `supabase/functions/kiwify-webhook/index.ts` - adicionar check na funcao `initiatePlaybook`
2. `supabase/functions/execute-playbook/index.ts` - adicionar check antes do insert
3. `supabase/functions/bulk-trigger-playbook/index.ts` - adicionar check na funcao `processContact`

### Impacto

- Zero regressao: apenas adiciona verificacao antes de criar, nao altera fluxo existente
- Segue o mesmo padrao ja implementado em `public-start-playbook` (linhas 200-220)
- Previne emails duplicados e desperdicio de recursos
- Execucoes com status `completed`, `failed` ou `cancelled` continuam permitindo re-disparo
