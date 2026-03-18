
# Corrigir de vez o caso do Luiz na atribuição de tickets

## O que eu confirmei
Do I know what the issue is? Sim.

O problema real não é só “a policy antiga”. São 2 causas juntas:

1. **A tela de ticket usa update direto na tabela**
   - Em `src/components/TicketDetails.tsx`, o campo **Atribuído** chama `handleAssignChange()`.
   - Esse handler usa `useUpdateTicket()`.
   - Em `src/hooks/useUpdateTicket.tsx`, a atribuição faz:
     ```ts
     supabase.from("tickets").update(...).eq("id", id)
     ```
   - Ou seja: a ação depende totalmente da RLS da tabela `tickets`.

2. **A correção anterior só liberou consultor para tickets da própria carteira**
   - A policy atual `canonical_update_tickets` só deixa `consultant` atualizar quando:
     ```sql
     customer_id IN (SELECT get_consultant_contact_ids(auth.uid()))
     ```
   - No ticket do print (`TK-2026-01004`), o contato `Vanessa Gonçalves` está com:
     - `consultant_id = null`
   - Então esse ticket **não entra** na carteira do Luiz.
   - Resultado: o update continua falhando com:
     `new row violates row-level security policy for table "tickets"`

## Diagnóstico final
A correção anterior atacou o caso errado.

- `luiz.silva@3cliques.net` tem só o role **`consultant`**
- O ticket mostrado não pertence à carteira dele
- A UI usa **update direto** em `tickets`
- Portanto, para esse ticket, o banco bloqueia a alteração corretamente

## Plano de implementação

### 1. Corrigir a regra de negócio, não só a RLS
Vou alinhar o sistema com o comportamento esperado para o Luiz.

**Se o Luiz precisa atuar na fila de suporte/equipe**, o ajuste correto é:
- manter `consultant`
- adicionar também um role operacional, como **`support_agent`** (ou outro papel operacional adequado)

Isso é consistente com o padrão já usado no projeto: consultor puro não é papel operacional de fila.

### 2. Parar de usar update direto para atribuição na tela do ticket
Hoje a atribuição simples passa por `useUpdateTicket`, que depende de RLS pura.

Vou planejar trocar a atribuição para um fluxo seguro:
- criar ou reutilizar uma **RPC SECURITY DEFINER** específica para atribuição de ticket
- validar no backend quem pode atribuir
- só depois atualizar `assigned_to` / `status`

Assim a lógica de permissão fica centralizada, igual já acontece em transferências com `transfer_ticket_secure`.

### 3. Ajustar a tela para usar o fluxo seguro
Em vez de:
- `handleAssignChange()` → `useUpdateTicket()`

ficará:
- `handleAssignChange()` → hook de atribuição segura (`assign_ticket_secure` ou equivalente)

Isso evita que a UI continue batendo na RLS bruta da tabela para uma ação operacional.

### 4. Manter rastreabilidade
Depois da atribuição segura:
- continuar registrando evento em `ticket_events`
- continuar invalidando queries
- manter toast de sucesso/erro

## Arquivos/recursos que vou ajustar
- `src/components/TicketDetails.tsx`
- `src/hooks/useUpdateTicket.tsx` ou novo hook dedicado para atribuição
- nova migration SQL para:
  - criar/atualizar RPC segura de atribuição
  - opcionalmente aplicar o role operacional ao Luiz, se essa for a regra desejada

## Resultado esperado
Depois disso:
- o Luiz conseguirá atribuir tickets **de acordo com a permissão operacional correta**
- a atribuição deixará de falhar por depender de update direto na tabela
- a permissão ficará consistente entre tela, backend e regras de negócio

## Detalhe técnico importante
O print mostra erro na ação de **atribuir** dentro de `TicketDetails`, não na transferência entre departamentos.

Então o ponto principal a corrigir é este:

```text
TicketDetails
  -> handleAssignChange
    -> useUpdateTicket
      -> update direto em public.tickets
        -> RLS bloqueia
```

E não apenas a policy de consultor.

## Implementação recomendada
Minha recomendação é seguir com este pacote:

1. adicionar um role operacional ao Luiz
2. mover a atribuição do dropdown para uma RPC segura
3. manter consultor puro limitado à carteira, sem abrir UPDATE geral para todos os consultores

Isso resolve o caso dele sem afrouxar a segurança da tabela `tickets`.
