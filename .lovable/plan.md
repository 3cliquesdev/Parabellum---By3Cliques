

# Diagnóstico: Teste do "Onboarding v3 (escuro)" travado em 0/1 nós 0%

## Causa Raiz

O playbook **"Cancelamento (teste)"** (onde o template "Onboarding v3 (escuro)" está configurado) tem `is_active = false`.

Quando o `process-playbook-queue` pega o item da fila, ele verifica `playbook.is_active` na **linha 225** e, como está `false`, **cancela o item** com `last_error: "Playbook desativado"` — mesmo sendo um **teste**.

Os 3 testes recentes (25/fev e 26/fev) todos foram cancelados pelo mesmo motivo. O teste anterior de "Cancelamento de assinatura" funcionou porque na época o playbook estava ativo.

## Correção

### Arquivo: `supabase/functions/process-playbook-queue/index.ts` (linha ~224-237)

Adicionar exceção para itens em **modo teste** (`_test_mode: true` no `node_data`):

```typescript
// Verificar se playbook está ativo (exceto em modo teste)
const isTestMode = item.node_data?._test_mode === true;
if (!playbook.is_active && !isTestMode) {
  // cancela normalmente...
}
```

Isso permite que o "Testar para Mim" funcione mesmo com o playbook desativado, mantendo a proteção para execuções reais.

### Atualizar execuções travadas

Marcar os 3 test runs com `status: running` como `failed` (já que foram cancelados na fila mas o test_run ficou em `running` eternamente — bug secundário):

```sql
UPDATE playbook_test_runs 
SET status = 'failed', error_message = 'Playbook estava desativado durante o teste'
WHERE execution_id IN ('37547c94-...', '39f87ab1-...', 'e52bc293-...');
```

## Impacto
- Zero regressão: execuções reais continuam bloqueadas quando playbook está inativo
- Apenas modo teste (`_test_mode: true`) ganha bypass
- Bug secundário corrigido: quando a fila cancela, o test_run deve ser atualizado para `failed` em vez de ficar eternamente `running`

