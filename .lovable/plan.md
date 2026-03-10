

# Transformar primeiro toggle em "Alerta de Demora na Resposta"

## Entendimento

O primeiro toggle ("Encerrar por inatividade") será substituído por um **sistema de alerta**, não de encerramento:

1. Cliente manda mensagem → equipe demora X minutos configuráveis → a conversa recebe automaticamente uma TAG configurável
2. A conversa **NÃO é fechada** — o agente humano deve encerrar manualmente
3. Se o cliente responder depois, o agente pode trocar a tag por outra
4. A tag de alerta NÃO pode ser removida pelo atendente (protegida)

## Alterações

### 1. Migração SQL
- Adicionar colunas à `departments`:
  - `slow_response_alert_enabled BOOLEAN DEFAULT false`
  - `slow_response_alert_minutes INTEGER NULL`
  - `slow_response_alert_tag_id UUID NULL REFERENCES tags(id)`
- Criar tabela `protected_conversation_tags` (conversation_id + tag_id, unique) para marcar tags que agentes não podem remover

### 2. UI — DepartmentDialog.tsx
Substituir o primeiro toggle por:
- Switch: **"Alerta de demora na resposta"**
- Descrição: "Aplica uma tag automática quando a equipe demora para responder o cliente. A conversa NÃO será encerrada."
- Input: **"Tempo máximo de resposta (minutos)"**
- Select: **"Tag de alerta"**
- Remover campo CSAT deste toggle (não aplica a alerta)

### 3. Hooks e tipo Department
Adicionar `slow_response_alert_enabled`, `slow_response_alert_minutes`, `slow_response_alert_tag_id` em `useDepartments`, `useCreateDepartment`, `useUpdateDepartment`.

### 4. Edge function — novo Stage de Alerta (sem encerrar)
No `auto-close-conversations/index.ts`, adicionar Stage de alerta SLA **antes** dos auto-closes:
- Buscar departamentos com `slow_response_alert_enabled = true`
- Buscar conversas abertas onde última mensagem é do `contact` (cliente) e `last_message_at < threshold`
- Aplicar tag configurada + inserir em `protected_conversation_tags`
- **NÃO fechar a conversa**

### 5. Proteger remoção de tag
No hook `useRemoveConversationTag` (em `useTags.tsx`): antes de deletar, verificar se existe em `protected_conversation_tags`. Se sim, bloquear com toast de erro.

### 6. Cards em Departments.tsx
Mostrar badge "Alerta demora Xmin" no card do departamento.

### Arquivos a alterar
- **Migração SQL** — novas colunas + tabela
- `src/components/DepartmentDialog.tsx` — substituir toggle 1
- `src/hooks/useCreateDepartment.tsx`
- `src/hooks/useUpdateDepartment.tsx`
- `src/hooks/useDepartments.tsx`
- `src/hooks/useTags.tsx` — proteger remoção em `useRemoveConversationTag`
- `src/pages/Departments.tsx` — badge
- `supabase/functions/auto-close-conversations/index.ts` — novo Stage de alerta

