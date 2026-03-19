

# Editar Template do Ticket — Visibilidade + Obrigatoriedade

## O que muda

Hoje a aba **Campos** só permite marcar campos como obrigatório/opcional. O usuário quer poder também **ativar/desativar (mostrar/esconder)** cada seção do formulário de criação de ticket, além de controlar se é obrigatório.

## Como vai funcionar

Cada campo do ticket terá **dois controles**:
- **Visível**: liga/desliga — se desligado, o campo some completamente do formulário
- **Obrigatório**: só aparece se o campo estiver visível — define se é obrigatório para criar o ticket

```text
┌──────────────────────────────────────────────────┐
│ Departamento Responsável                         │
│ Departamento ao qual o ticket será vinculado     │
│                                                  │
│   [Visível: ON]    [Obrigatório: OFF]            │
├──────────────────────────────────────────────────┤
│ Operação                                         │
│ Tipo de operação do ticket                       │
│                                                  │
│   [Visível: ON]    [Obrigatório: ON]             │
├──────────────────────────────────────────────────┤
│ Origem do Ticket                                 │
│ Momento da jornada do cliente          DESATIVADO│
│                                                  │
│   [Visível: OFF]   [Obrigatório: ---]            │
└──────────────────────────────────────────────────┘
```

Campos que são sempre visíveis e não podem ser desativados: **Assunto** e **Prioridade** (são campos core do ticket).

## Alterações

### 1. `src/hooks/useTicketFieldSettings.tsx`
- Adicionar interface `TicketFieldVisibility` com as mesmas keys (department, operation, origin, category, customer, assigned_to, tags, description, attachments)
- Novas chaves `ticket_field_X_visible` na `system_configurations`
- Defaults: todos visíveis
- Expor `visibility` e `updateVisibility` no retorno do hook

### 2. `src/pages/Departments.tsx` — aba "Campos"
- Redesenhar cada card para mostrar dois switches lado a lado:
  - Switch "Visível" (ativo/inativo)
  - Switch "Obrigatório" (só habilitado se visível estiver ON)
- Adicionar campos extras: **Descrição** e **Evidências** (que hoje não tinham toggle)
- Visual: campo desativado fica com opacidade reduzida

### 3. `src/components/support/CreateTicketDialog.tsx`
- Ler `visibility` do hook
- Envolver cada seção com `{visibility.X && (...)}` para esconder campos desativados
- Manter a lógica de `required` apenas para campos visíveis

### 4. `src/components/support/CreateTicketFromInboxDialog.tsx`
- Aplicar a mesma lógica de visibilidade (se existir um dialog separado para criação via inbox)

## Campos configuráveis

| Campo | Pode desativar | Pode ser obrigatório |
|-------|---------------|---------------------|
| Assunto | Não (sempre visível) | Sempre obrigatório |
| Descrição | Sim | Sim |
| Evidências | Sim | Sim |
| Categoria | Sim | Sim |
| Prioridade | Não (sempre visível) | Sempre obrigatório |
| Operação | Sim | Sim |
| Origem | Sim | Sim |
| Tags | Sim | Sim |
| Departamento | Sim | Sim |
| Atribuir a | Sim | Sim |
| Cliente | Sim | Sim |

## Detalhes técnicos

- Armazenamento via `system_configurations` com chaves `ticket_field_X_visible` (mesmo padrão das `_required`)
- Nenhuma migração necessária — a tabela `system_configurations` já suporta chaves dinâmicas
- O hook faz upsert com `onConflict: "key"`

