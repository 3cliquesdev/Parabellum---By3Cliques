

# Plano: Permitir Seleção de Fluxo no Dropdown de Teste

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Diagnóstico

O problema está na linha 119 e 141 do `TestModeDropdown.tsx`:

```tsx
disabled={!!activeFlow || isStarting}
```

Quando existe um fluxo ativo na conversa (status `in_progress`, `active` ou `waiting_input`), **todos os itens de fluxo ficam desabilitados**. O usuário vê os fluxos listados mas não consegue clicar em nenhum.

Na screenshot, o badge "Ativo" com X confirma que há um fluxo em execução, o que desativa todos os itens do dropdown.

Além disso, o `handleStartFlow` faz uma verificação redundante na linha 39:
```tsx
if (activeFlow) {
  toast.error("Já existe um fluxo em execução...");
  return;
}
```

## Solução

Alterar o comportamento para **cancelar automaticamente o fluxo ativo** antes de iniciar o novo, em vez de bloquear a seleção. Isso é seguro porque:

- O contexto é de teste manual (ação intencional do agente/admin)
- O cancelamento já existe via `cancelFlow` no hook `useActiveFlowState`
- É uma operação atômica (update status para `cancelled`)

### Alterações no arquivo `src/components/inbox/TestModeDropdown.tsx`

1. **Importar `cancelFlow`** do hook `useActiveFlowState`
2. **Remover `disabled={!!activeFlow}`** dos DropdownMenuItems de fluxo
3. **Substituir o bloqueio** no `handleStartFlow` por cancelamento automático:

```tsx
// Antes (bloqueia):
if (activeFlow) {
  toast.error("Já existe um fluxo em execução...");
  return;
}

// Depois (cancela e continua):
if (activeFlow) {
  await cancelFlow(activeFlow.stateId);
  await new Promise((r) => setTimeout(r, 500)); // aguarda propagação
}
```

4. **Manter `disabled={isStarting}`** para evitar cliques duplos durante execução

### Resumo de mudanças

| Local | Mudança |
|---|---|
| `TestModeDropdown.tsx` linha 32 | Extrair `cancelFlow` do hook |
| `TestModeDropdown.tsx` linhas 38-42 | Substituir bloqueio por auto-cancel |
| `TestModeDropdown.tsx` linhas 119, 141 | Remover `!!activeFlow` do `disabled` |

### Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim -- apenas altera comportamento de teste manual |
| Kill Switch | Não afetado |
| Proteção de simultaneidade | Preservada -- cancela antes de iniciar |
| Governança de rascunhos | Preservada -- mesmas regras de permissão |

