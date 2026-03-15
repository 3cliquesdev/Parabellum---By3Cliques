

# Fix: Hardening das Edge Functions de Devoluções

## Dois problemas identificados

### 1. Validação de email na `register-return`
A function usa `verify_jwt = false` (nem está no config.toml ainda, aliás) e não valida o formato do email. Qualquer pessoa pode enviar requests com emails arbitrários. Precisamos adicionar:
- Validação de formato de email (regex básico)
- Sanitização de inputs (trim, limitar tamanho)
- Adicionar as entries no `config.toml` com `verify_jwt = false`

### 2. Duplicata incompleta — falta checar `tracking_code_return`
Atualmente a verificação de duplicata só checa `external_order_id`. Se o admin cadastrou pelo rastreio e o cliente pelo pedido, escapa. Precisamos expandir para:

```text
Buscar returns onde:
  (external_order_id = valor_informado OR tracking_code_return = valor_informado)
  AND created_by = 'admin'
```

## Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/register-return/index.ts` | Adicionar validação de email + expandir query de duplicata para incluir `tracking_code_return` |
| `supabase/config.toml` | Adicionar entries para `register-return` e `link-return` com `verify_jwt = false` |

## Detalhes

**register-return — validação de email:**
```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  return new Response(JSON.stringify({ error: 'Email inválido' }), { status: 400 });
}
```

**register-return — duplicata expandida:**
Substituir a query simples por uma que use `.or()` para checar `external_order_id` OU `tracking_code_return`:
```typescript
let duplicateQuery = supabase
  .from('returns')
  .select('id')
  .eq('created_by', 'admin');

// Montar filtro OR: mesmo pedido OU mesmo rastreio
const orFilters = [`external_order_id.eq.${external_order_id}`];
if (tracking_code_return) {
  orFilters.push(`tracking_code_return.eq.${tracking_code_return}`);
}
duplicateQuery = duplicateQuery.or(orFilters.join(','));
```

Nenhuma mudança nos componentes frontend — a API permanece idêntica.

