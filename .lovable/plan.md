

# Auto-close IA por departamento — campo separado

## Situação atual

A Etapa 2 do `auto-close-conversations` já fecha conversas `autopilot` usando `auto_close_minutes` do departamento. Porém, esse campo mistura o conceito de timeout de IA com timeout geral (humano). Para dar controle independente, adicionaremos um campo específico para IA.

## Alterações

### 1. Nova coluna no banco: `ai_auto_close_minutes`
```sql
ALTER TABLE departments 
  ADD COLUMN ai_auto_close_minutes integer DEFAULT NULL;

COMMENT ON COLUMN departments.ai_auto_close_minutes IS 
  'Minutos de inatividade do cliente para encerrar conversa com IA automaticamente. NULL = não encerrar.';
```

### 2. Edge Function `auto-close-conversations/index.ts` — Etapa 3: AI inactivity

Adicionar nova etapa após a Etapa 2:
- Buscar departamentos com `ai_auto_close_minutes IS NOT NULL`
- Buscar conversas `status = open`, `ai_mode = autopilot`, `last_message_at < threshold`
- Excluir conversas já fechadas nas etapas anteriores
- Verificar última mensagem não é do contato (IA respondeu, cliente não)
- Enviar mensagem de encerramento por inatividade
- Fechar com `closed_reason: 'ai_inactivity'`, tag "Desistência"
- Respeitar `send_rating_on_close` do departamento para CSAT

### 3. UI — `DepartmentDialog.tsx`

Adicionar novo campo no bloco de "Encerramento Automático":
- Switch: "Encerrar conversas com IA por inatividade"
- Input: "Tempo de inatividade da IA (minutos)" — mínimo 1, placeholder "Ex: 5"
- Descrição: "Fecha conversas no modo autopilot quando o cliente não responde à IA"

### 4. Hooks e tipos

- `useDepartments.tsx`: Adicionar `ai_auto_close_minutes: number | null` na interface
- `useCreateDepartment.tsx`: Incluir `ai_auto_close_minutes` nos params
- `useUpdateDepartment.tsx`: Incluir `ai_auto_close_minutes` nos params
- `Departments.tsx`: Mostrar o tempo de IA no card quando configurado

### 5. Página Departments — card info

Exibir "IA auto-fecha em X min" ao lado do auto-close existente quando `ai_auto_close_minutes` estiver configurado.

## Impacto
- Zero regressão: Etapas 1 e 2 intocadas
- `auto_close_minutes` continua disponível para uso futuro (timeout humano)
- Cada departamento controla independentemente o timeout da IA

