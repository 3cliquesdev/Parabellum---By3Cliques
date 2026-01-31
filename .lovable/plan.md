
# Plano: Corrigir Erro de ILIKE em Colunas UUID

## Problema Identificado

O erro `operator does not exist: uuid ~~* unknown` ocorre porque:

```typescript
// ❌ PROBLEMA: ILIKE não funciona em UUID
.or(
  `contact_name.ilike.%${searchLower}%,` +
  `contact_email.ilike.%${searchLower}%,` +
  `contact_phone.ilike.%${searchLower}%,` +
  `contact_id.ilike.%${searchLower}%,`      // ← UUID!
  `conversation_id.ilike.%${searchLower}%`  // ← UUID!
)
```

### Tipos de dados na `inbox_view`:
| Coluna | Tipo | ILIKE? |
|--------|------|--------|
| contact_name | text | OK |
| contact_email | text | OK |
| contact_phone | text | OK |
| contact_id | **uuid** | ERRO |
| conversation_id | **uuid** | ERRO |

---

## Solução

Remover as colunas UUID do filtro `ILIKE` (já que buscas por UUID parcial são raras) **OU** usar cast para text.

### Opção Recomendada: Remover UUIDs do ILIKE

Na prática, usuários não buscam por "parte de um UUID". A busca por nome, email e telefone cobre 99% dos casos.

**Arquivo:** `src/hooks/useInboxSearch.tsx`

```typescript
// ✅ CORRIGIDO: Apenas campos TEXT
const { data, error } = await supabase
  .from("inbox_view")
  .select("*")
  .or(
    `contact_name.ilike.%${searchLower}%,` +
    `contact_email.ilike.%${searchLower}%,` +
    `contact_phone.ilike.%${searchLower}%`
  )
  .order("status", { ascending: true })
  .order("last_message_at", { ascending: false })
  .limit(100);
```

### Opção Alternativa: Cast UUID para TEXT (se quiser manter busca por ID)

Se o usuário precisar buscar por ID da conversa, podemos fazer uma query separada com match exato:

```typescript
// Busca principal (nome, email, telefone)
const textQuery = supabase
  .from("inbox_view")
  .select("*")
  .or(
    `contact_name.ilike.%${searchLower}%,` +
    `contact_email.ilike.%${searchLower}%,` +
    `contact_phone.ilike.%${searchLower}%`
  );

// Se parece UUID, busca exata por ID
const isUuidLike = /^[0-9a-f-]{8,}$/i.test(searchLower);
if (isUuidLike) {
  // Busca adicional por ID exato ou parcial via RPC
}
```

---

## Arquivo Afetado

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useInboxSearch.tsx` | Remover `contact_id` e `conversation_id` do ILIKE |

---

## Resultado Esperado

1. Buscar por "fabiosou" → Encontra por email/nome
2. Buscar por "5511969656723" → Encontra por telefone
3. Buscar por "Ronildo" → Encontra por nome
4. Conversas abertas aparecem no topo
5. Sem erro de UUID no console

---

## Conformidade

| Regra | Status |
|-------|--------|
| Fix urgente | Query funcional imediatamente |
| Zero regressão | Busca por texto continua funcionando |
| Sem gambiarras | Solução limpa, tipos corretos |
