

# Operacao obrigatoria em tickets internos + automatica em formularios

## Resumo

- Tickets criados internamente: dropdown "Operacao" continua **obrigatorio** (como ja esta hoje)
- Tickets vindos de formularios: recebem a Operacao automaticamente (definida na configuracao do formulario)

## Etapas

### 1. Adicionar `default_operation_id` ao TicketSettings

**Arquivo:** `src/hooks/useForms.tsx`

Adicionar `default_operation_id?: string` na interface `TicketSettings` (linha 193-198).

### 2. Adicionar dropdown "Operacao Padrao" no TicketFieldMapping

**Arquivo:** `src/components/forms/TicketFieldMapping.tsx`

- Importar `useTicketOperations`
- Adicionar um Select "Operacao Padrao" abaixo de "Categoria Padrao"
- Valor salvo em `ticket_settings.default_operation_id`
- Isso permite ao admin escolher qual Operacao sera atribuida aos tickets gerados por aquele formulario

### 3. Passar `operation_id` no form-submit-v3

**Arquivo:** `supabase/functions/form-submit-v3/index.ts`

Na secao de criacao de ticket (por volta da linha 740), adicionar `operation_id` ao insert:

```text
operation_id: ticketSettings.default_operation_id || null,
```

Tambem na secao de `create_ticket` action (por volta da linha 1365), adicionar o mesmo campo.

### 4. Manter CreateTicketDialog como esta

O `CreateTicketDialog` ja tem o campo obrigatorio com a validacao:

```text
const canSubmit = subject.trim() && operationId && !createTicket.isPending;
```

Nenhuma alteracao necessaria neste arquivo.

---

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useForms.tsx` | Adicionar `default_operation_id` ao tipo `TicketSettings` |
| `src/components/forms/TicketFieldMapping.tsx` | Dropdown "Operacao Padrao" usando `useTicketOperations` |
| `supabase/functions/form-submit-v3/index.ts` | Passar `operation_id` no insert do ticket (2 locais) |

## Impacto

- Zero regressao: tickets internos continuam com campo obrigatorio
- Formularios existentes sem `default_operation_id` simplesmente geram ticket com `operation_id = null`
- Novos formularios podem definir a operacao na configuracao

