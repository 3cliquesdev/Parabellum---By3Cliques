
# Alinhar dialog de Ticket do Inbox com o padrao do menu de Tickets

## Problema

O dialog "Criar Ticket a partir da Conversa" (`CreateTicketFromInboxDialog.tsx`) esta incompleto comparado ao dialog principal (`CreateTicketDialog.tsx`). Faltam:

- Campo **Operacao** (obrigatorio conforme configuracao)
- Campo **Origem do Ticket** (obrigatorio conforme configuracao)
- Campo **Tags** (obrigatorio conforme configuracao)
- Validacao via `useTicketFieldSettings` (campos obrigatorios dinamicos)
- O botao de submit nao bloqueia quando campos obrigatorios estao vazios

## Solucao

Adicionar os 3 campos ausentes + validacao dinamica ao `CreateTicketFromInboxDialog`, seguindo exatamente o mesmo padrao visual e logico do `CreateTicketDialog` do menu.

## Mudancas

### 1. Frontend: `src/components/CreateTicketFromInboxDialog.tsx`

**Novos imports:**
- `useTicketOperations` - lista de operacoes
- `useTicketOrigins` - lista de origens
- `useTags` - lista de tags universais
- `useTicketFieldSettings` - config de campos obrigatorios

**Novos estados:**
- `operationId` (string)
- `originId` (string)
- `selectedTagIds` (string[])
- `tagSearch` (string)
- `tagPopoverOpen` (boolean)

**Novos campos no formulario** (inseridos entre "Assignee" e "Description"):
- **Operacao**: Select com label dinamico (obrigatorio/opcional conforme config)
- **Origem do Ticket**: Select com label dinamico
- **Tags**: Popover com busca + badges selecionadas, label dinamico com asterisco quando obrigatorio

**Validacao de submit:**
- Regra `canSubmit` igual ao dialog principal: bloqueia se campo obrigatorio estiver vazio
- Helper `fieldLabel` para exibir asterisco vermelho ou "(opcional)"

**Reset do form:** Limpar novos campos quando dialog fecha.

**Payload do submit:** Enviar `operation_id`, `origin_id`, `tag_ids` junto com os dados atuais.

### 2. Backend: `supabase/functions/generate-ticket-from-conversation/index.ts`

**Ampliar interface `CreateTicketRequest`:**
- Adicionar `operation_id?: string`
- Adicionar `origin_id?: string`
- Adicionar `tag_ids?: string[]`

**No insert do ticket:**
- Incluir `operation_id` e `origin_id` no payload de criacao

**Apos criar ticket:**
- Se `tag_ids` tiver itens, inserir em `ticket_tags` (mesmo padrao do `useCreateTicket`)

### 3. Hook: `src/hooks/useGenerateTicketFromConversation.tsx`

**Ampliar interface `GenerateTicketRequest`:**
- Adicionar `operation_id?: string`
- Adicionar `origin_id?: string`
- Adicionar `tag_ids?: string[]`

## Zero regressao

- Dialog principal de Tickets (`CreateTicketDialog`) nao e alterado
- Edge function so adiciona campos opcionais - requisicoes antigas continuam funcionando
- Kill Switch, CSAT, fluxos: sem impacto
- Validacao segue a mesma config `system_configurations` ja existente
