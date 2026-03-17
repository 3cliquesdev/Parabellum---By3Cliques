

# Fix: Senha inicial de 5 caracteres vs validação mínima de 6

## O Problema
A senha temporária do cliente é `cpf.substring(0, 5)` = **5 caracteres**, mas o formulário de login (`ClientLogin.tsx`) exige `.min(6)`. Resultado: **nenhum cliente com CPF consegue fazer login** com a senha temporária.

## Correção (2 pontos, ambos precisam mudar)

### 1. `supabase/functions/sync-kiwify-sales/index.ts` (linha 310)
Mudar de `substring(0, 5)` para `substring(0, 6)` — usar os primeiros **6 dígitos** do CPF como senha temporária.

```typescript
// Antes
const tempPassword = sale.customer.cpf?.substring(0, 5) || 'temp12345';

// Depois  
const tempPassword = sale.customer.cpf?.substring(0, 6) || 'temp12345';
```

### 2. Clientes já criados com senha de 5 dígitos
Clientes que **já foram sincronizados** terão senha de 5 caracteres. Não há como alterar retroativamente sem resetar as senhas. Duas opções:
- **Opção A**: Aceitar que clientes antigos precisarão usar "Esqueci minha senha" (que acabamos de corrigir)
- **Opção B**: Reduzir a validação do login para `.min(5)` temporariamente

**Recomendação**: Aplicar as duas mudanças — `substring(0, 6)` para novos clientes e `.min(5)` no login para compatibilidade com os existentes.

### Arquivo: `src/pages/ClientLogin.tsx` (linha 17)
```typescript
// Antes
password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),

// Depois
password: z.string().min(5, { message: "Senha deve ter no mínimo 5 caracteres" }),
```

### Total: 2 linhas em 2 arquivos

