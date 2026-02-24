
# Unificar visual dos tickets no Inbox com o menu de Tickets

## Problema

Os tickets exibidos na aba "Tickets" do painel lateral do Inbox (`ContactDetailsSidebar.tsx`) usam um layout simplificado (apenas assunto, badge de status basico, SLA e data). Ja no menu de Tickets (`support/TicketCard.tsx`), o card e muito mais completo, com:

- Numero do ticket (#00001)
- Status com cores dinamicas e icones (carregados da tabela `ticket_statuses`)
- Alerta de SLA vencido (icone pulsante + borda vermelha)
- Badge de prioridade (Baixa, Media, Alta, Urgente)
- Tempo relativo ("ha 2 horas")
- Seta de navegacao

## Solucao

Substituir o bloco de renderizacao inline dos tickets no `ContactDetailsSidebar.tsx` (linhas 251-276) por uma versao compacta que reutilize os mesmos padroes visuais do `TicketCard` do menu.

Como o `TicketCard` do menu e projetado para uma lista vertical com mais espaco, criaremos uma versao **compacta** dentro do sidebar que inclua:

1. **Numero do ticket** (ex.: #00001)
2. **Status com cor dinamica** usando `useActiveTicketStatuses` + `getStatusIcon` (mesmo sistema do menu)
3. **Indicador de SLA vencido** (borda vermelha + icone)
4. **Badge de prioridade** com cores consistentes
5. **Tempo relativo** (formatDistanceToNow)
6. **Click para navegar** ao detalhe do ticket (`/support/ticket/:id`)

## Detalhes tecnicos

### Arquivo: `src/components/ContactDetailsSidebar.tsx`

1. Adicionar imports necessarios:
   - `useActiveTicketStatuses` de `@/hooks/useTicketStatuses`
   - `getStatusIcon` de `@/lib/ticketStatusIcons`
   - `formatDistanceToNow` de `date-fns`
   - `AlertTriangle` de `lucide-react`
   - `useNavigate` de `react-router-dom`

2. Dentro do componente, adicionar:
   - `const { data: ticketStatuses } = useActiveTicketStatuses()`
   - `const navigate = useNavigate()`
   - Config de prioridade igual ao `TicketCard` do menu
   - Fallback de status com cores igual ao `TicketCard` do menu

3. Substituir o bloco de renderizacao (linhas 251-276) por cards compactos com:
   - Linha 1: `#ticket_number` + Badge de status (cor dinamica + icone)
   - Linha 2: Assunto (line-clamp-1)
   - Linha 3: SLA Badge + prioridade + tempo relativo
   - Borda vermelha lateral se SLA vencido
   - `onClick` navegando para `/support/ticket/${ticket.id}`

4. Remover a funcao local `getStatusBadge` (linhas 138-147) que sera substituida pelo sistema dinamico.

### Dados

O hook `useContactTickets` ja retorna `*` (todos os campos), entao `ticket_number`, `priority`, `due_date`, `status` ja estao disponiveis. Nenhuma mudanca no hook necessaria.

## Zero regressao

- Apenas mudanca visual no sidebar do Inbox
- Dados ja existem, nenhuma query nova
- `TicketCard` do menu nao e alterado
- Kill Switch, CSAT, fluxos: sem impacto
