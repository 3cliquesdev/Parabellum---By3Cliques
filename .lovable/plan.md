

# Bug 37: Fernanda (sales_rep) Não Consegue Assumir Conversa #DE176490

## Diagnóstico

**Dados da conversa:**
- `ai_mode: waiting_human` | `status: open` | `assigned_to: Fernanda`
- `department: Suporte` (36ce66cd...)
- Fernanda enviou template de 24h, mas o botão "Assumir" está **desabilitado**

**Causa raiz:** O hook `useCanTakeControl` bloqueia Fernanda porque:

1. `isAvailableAIConversation = false` (porque `assigned_to` JÁ é ela mesma)
2. Role = `sales_rep` → permitido apenas `["Comercial", "Vendas", "Sales"]`
3. Departamento da conversa = `Suporte` → **NÃO está na lista**
4. Resultado: `canTake: false`, botão fica disabled

**O problema lógico:** A conversa já está **atribuída a Fernanda**, então ela deveria poder assumi-la independente do departamento. A restrição de departamento faz sentido para conversas de outros agentes, mas não quando a conversa já é dela.

## Fix

**Arquivo:** `src/hooks/useCanTakeControl.tsx`

Adicionar um bypass logo após o check de `isAvailableAIConversation` (L49-54): se `conversation.assignedTo === user.id`, retornar `canTake: true`. Se a conversa já está atribuída ao próprio usuário, ele sempre pode assumir — independente do departamento.

```typescript
// Nova regra após L54:
// Se a conversa já está atribuída ao próprio usuário, sempre pode assumir
if (conversation.assignedTo === user.id) {
  return { canTake: true };
}
```

Isso resolve o cenário sem afetar a segurança: a restrição de departamento continua valendo para conversas de outros agentes/departamentos.

### Resumo: 1 arquivo, 1 edição de 3 linhas

