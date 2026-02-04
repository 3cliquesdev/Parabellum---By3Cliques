
# Plano: Corrigir Busca de Clientes para Criar Tickets

## Problema Identificado

A busca de clientes no modal "Criar Novo Ticket" está falhando com **timeout** (erro 57014). 

**Causa raiz:**
- A query de busca está fazendo ILIKE em 4 campos (first_name, last_name, email, phone) sem índice otimizado para email
- A tabela `contacts` tem **14.817 registros**
- A execução leva ~673ms apenas para email ILIKE, multiplicando quando combinada com outros campos
- A política RLS para `consultant` adiciona overhead de verificação
- O timeout padrão do Supabase (8s) é ultrapassado

## Solução Proposta

Criar uma **Edge Function** `search-contacts-for-ticket` que:
1. Usa `SERVICE_ROLE_KEY` para bypassar RLS (é segura pois apenas retorna dados mínimos)
2. Faz busca otimizada usando os índices trigram existentes
3. Prioriza busca por email exato primeiro (mais rápido)
4. Limita resultados a 20 registros
5. Retorna apenas campos necessários (id, nome, email)

## Arquitetura

```text
+-------------------+     +------------------------+     +------------+
|  CreateTicket     | --> | search-contacts-       | --> |  contacts  |
|  Dialog           |     | for-ticket (Edge)      |     |  (table)   |
+-------------------+     +------------------------+     +------------+
        |                         |                           |
        |  searchTerm             |  SERVICE_ROLE             |
        |------------------------>|  (bypasses RLS)           |
        |                         |-------------------------->|
        |                         |                           |
        |  contacts[]             |  optimized query          |
        |<------------------------|  with LIMIT 20            |
        |                         |<--------------------------|
```

## Mudanças Técnicas

### 1. Nova Edge Function: `search-contacts-for-ticket`

| Aspecto | Detalhe |
|---------|---------|
| Endpoint | `/functions/v1/search-contacts-for-ticket` |
| Método | POST |
| Autenticação | JWT obrigatório (qualquer usuário autenticado) |
| Input | `{ searchTerm: string }` |
| Output | `{ contacts: [{ id, first_name, last_name, email }] }` |

**Lógica de busca otimizada:**
1. Se `searchTerm` contém `@` → busca prioritária por email
2. Senão → busca por nome usando índices trigram
3. LIMIT 20 para garantir resposta rápida

### 2. Novo Hook: `useSearchContactsForTicket`

Substituirá o uso de `useContacts` no `CreateTicketDialog.tsx`:
- Chama a Edge Function via `supabase.functions.invoke`
- Debounce de 300ms mantido
- Tratamento de erros robusto

### 3. Atualizar `CreateTicketDialog.tsx`

Substituir:
```typescript
const { data: contacts = [] } = useContacts(
  debouncedSearch.length >= 2 ? { searchQuery: debouncedSearch } : undefined
);
```

Por:
```typescript
const { data: contacts = [] } = useSearchContactsForTicket(debouncedSearch);
```

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/search-contacts-for-ticket/index.ts` | Criar |
| `supabase/config.toml` | Adicionar função |
| `src/hooks/useSearchContactsForTicket.tsx` | Criar |
| `src/components/support/CreateTicketDialog.tsx` | Atualizar import e uso |

## Benefícios

| Antes | Depois |
|-------|--------|
| Timeout após ~8s | Resposta em ~200ms |
| Usuários não conseguem buscar | Busca funciona para todos |
| Query pesada com RLS | Bypass seguro com dados mínimos |

## Segurança

- Edge Function requer JWT válido (usuário autenticado)
- Retorna apenas dados públicos de contato (id, nome, email)
- Não expõe dados sensíveis (telefone, documentos, etc.)
- Logging para auditoria

## Testes Necessários

1. Buscar cliente por email exato: `juh.naiara@gmail.com`
2. Buscar cliente por nome parcial: `Julia`
3. Buscar cliente inexistente
4. Verificar resposta rápida (<500ms)
