

# Implementar aba "Tickets" no Client Portal

## Contexto
A aba "Tickets" no `/client-portal` mostra "Em breve disponível", mas já existe toda a infraestrutura:
- Edge function `get-customer-tickets` que busca tickets por `contact_id`
- Componentes `MyTicketCard` e `MyTicketDetail` prontos (usados em `/my-tickets`)
- O portal usa `useAuth()` (usuário autenticado com email)

## Desafio
O `get-customer-tickets` precisa de um `contact_id`, mas o portal tem apenas o `user.email`. Precisamos buscar o contato pelo email do usuário autenticado.

## Plano

### 1. Criar componente `src/components/client-portal/ClientTicketsList.tsx`
- Usar `useAuth()` para obter `user.email`
- Buscar `contact_id` na tabela `contacts` filtrando por email
- Chamar `get-customer-tickets` com o `contact_id` encontrado
- Renderizar lista usando layout similar ao `MyTicketCard` mas com classes explícitas (sem semânticas do tema dark)
- Estado vazio: "Nenhum ticket encontrado"
- Ao clicar em ticket, mostrar detalhe inline (reutilizar `MyTicketDetail` ou criar versão simplificada)

### 2. Atualizar `src/pages/ClientPortal.tsx`
- Substituir o placeholder "Em breve disponível" na aba `tickets` pelo novo `ClientTicketsList`

### 3. Garantir cores claras
- Todos os elementos do novo componente usarão classes explícitas (`text-gray-500`, `bg-white`, `border-gray-200`) em vez de semânticas, seguindo o padrão já estabelecido no portal.

