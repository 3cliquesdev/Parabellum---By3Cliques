

# Buscar Consultor pelo Email do Cliente

## O que muda

Na página **Consultores** (`/consultants`), o campo de busca atual (que filtra por nome/cargo do consultor) será expandido para aceitar também **email de cliente**. Ao digitar um email de cliente:

1. O sistema consulta a tabela `contacts` pelo email
2. Se encontrar, mostra um **card de resultado** acima dos consultores com: nome do cliente, email, e o consultor responsável (com botão para abrir a lista de clientes dele)
3. Se não encontrar, mostra aviso simples: "Nenhum cliente encontrado com este email"

A busca por nome/cargo do consultor continua funcionando normalmente.

## Implementação

### Arquivo: `src/pages/Consultants.tsx`

1. Detectar quando o texto de busca parece um email (contém `@`)
2. Quando for email, fazer query em `contacts` buscando `email.ilike(search)` com join em `profiles` via `consultant_id`
3. Exibir resultado inline entre o campo de busca e o grid de consultores:
   - **Encontrado**: Card com nome do cliente, email, consultor responsável, botão "Ver clientes"
   - **Não encontrado**: Badge/aviso "Nenhum cliente com este email"
   - **Sem consultor**: "Cliente encontrado mas sem consultor atribuído"
4. A busca normal por nome do consultor continua ativa para textos sem `@`

### Lógica de detecção

```
const isEmailSearch = search.includes("@");
```

Quando `isEmailSearch = true`:
- Query: `supabase.from("contacts").select("id, first_name, last_name, email, consultant_id").ilike("email", `%${search}%`).limit(5)`
- Para cada resultado com `consultant_id`, buscar nome do consultor nos dados já carregados de `consultants`

### Zero regressão
- Busca por nome/cargo do consultor não é afetada (só ativa busca por email quando tem `@`)
- Nenhum hook/componente existente é alterado
- Tudo client-side com dados já disponíveis + 1 query adicional só quando tem `@`

