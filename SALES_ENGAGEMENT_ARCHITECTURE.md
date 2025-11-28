# 🏗️ Arquitetura - Sales Engagement System

## 📊 Visão Geral

O **Sales Engagement System** (Sistema de Cadências) é uma plataforma completa de automação de vendas que permite aos vendedores criar sequências de touchpoints (emails, WhatsApp, calls, tasks) que são executadas automaticamente ao longo do tempo.

**Inspiração:** Outreach.io, SalesLoft, Apollo.io

---

## 🗄️ Estrutura do Banco de Dados

### **Tabela: `cadences`**
Armazena as cadências (sequências de engajamento).

```sql
- id: UUID (PK)
- name: TEXT (ex: "Cadência de Leads Frios")
- description: TEXT
- is_active: BOOLEAN (se está ativa ou não)
- created_by: UUID → profiles(id)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

**RLS Policies:**
- Sales Rep: pode ler todas, mas só criar/editar/deletar as suas próprias
- Admin/Manager: acesso completo

---

### **Tabela: `cadence_steps`**
Define os passos individuais de cada cadência.

```sql
- id: UUID (PK)
- cadence_id: UUID → cadences(id) (CASCADE DELETE)
- position: INTEGER (ordem do step: 1, 2, 3...)
- step_type: TEXT (email, whatsapp, call, task)
- day_offset: INTEGER (quantos dias após o enrollment executar)
- is_automated: BOOLEAN (se é automático ou manual)
- task_title: TEXT (título da task gerada)
- task_description: TEXT (descrição da task)
- message_template: TEXT (template do email/WhatsApp)
- template_id: UUID → email_templates(id) (opcional)
- created_at: TIMESTAMPTZ
```

**Exemplo:**
```
Step 1: Email (day_offset=0) - "Email de boas-vindas"
Step 2: WhatsApp (day_offset=2) - "Follow-up via WhatsApp"
Step 3: Call (day_offset=4) - "Ligação de qualificação"
```

**RLS Policies:**
- Herdam as permissões da cadência pai

---

### **Tabela: `cadence_enrollments`**
Registra a inscrição de um contato em uma cadência (execução ativa).

```sql
- id: UUID (PK)
- cadence_id: UUID → cadences(id)
- contact_id: UUID → contacts(id) (UNIQUE + cadence_id)
- enrolled_by: UUID → profiles(id) (quem inscreveu)
- status: TEXT (active, completed, paused, cancelled)
- current_step: INTEGER (qual step está executando agora)
- started_at: TIMESTAMPTZ (quando começou)
- completed_at: TIMESTAMPTZ (quando terminou)
- replied_at: TIMESTAMPTZ (quando cliente respondeu - trigger de pausa)
- next_step_at: DATE (quando executar próximo step)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

**Status:**
- `active`: Cadência em execução
- `completed`: Todos os steps foram executados
- `paused`: Cliente respondeu, cadência pausada
- `cancelled`: Vendedor cancelou manualmente

**RLS Policies:**
- Sales Rep: vê apenas seus próprios enrollments (`enrolled_by = auth.uid()`)
- Admin/Manager: vê todos

---

### **Tabela: `cadence_tasks`**
Tasks individuais geradas para cada step do enrollment.

```sql
- id: UUID (PK)
- enrollment_id: UUID → cadence_enrollments(id) (CASCADE DELETE)
- step_id: UUID → cadence_steps(id)
- contact_id: UUID → contacts(id)
- assigned_to: UUID → profiles(id) (vendedor responsável)
- task_type: TEXT (email, whatsapp, call, task)
- title: TEXT (título da task)
- description: TEXT (descrição)
- template_content: TEXT (conteúdo do template a ser usado)
- scheduled_for: DATE (para qual dia está agendada)
- status: TEXT (pending, completed, skipped)
- completed_at: TIMESTAMPTZ (quando foi completada)
- created_at: TIMESTAMPTZ
```

**Status:**
- `pending`: Aguardando execução
- `completed`: Vendedor executou
- `skipped`: Vendedor pulou ou cadência pausou

**RLS Policies:**
- Sales Rep: vê apenas tasks atribuídas a ele (`assigned_to = auth.uid()`)
- Admin/Manager: vê todas

---

## 🔄 Fluxo de Automação (Triggers)

### **1️⃣ Trigger: Criar Task Inicial**

**Quando:** Um enrollment é criado (`status = 'active'`)

**Ação:**
1. Busca o primeiro step da cadência (`position = 1`)
2. Calcula data agendada: `started_at + day_offset`
3. Cria a primeira task com status `pending`

**Trigger:** `trigger_create_initial_task` → `create_initial_cadence_task()`

**Tabela:** `cadence_enrollments` (AFTER INSERT)

---

### **2️⃣ Trigger: Avançar para Próximo Step**

**Quando:** Uma task é completada (`status = 'completed'`)

**Ação:**
1. Verifica se o enrollment ainda está `active`
2. Incrementa `current_step` do enrollment
3. Busca próximo step na cadência (`position = current_step + 1`)
4. Se houver próximo step:
   - Calcula data agendada: `CURRENT_DATE + day_offset`
   - Cria nova task com status `pending`
5. Se não houver mais steps:
   - Marca enrollment como `completed`

**Trigger:** `trigger_advance_step` → `advance_cadence_step()`

**Tabela:** `cadence_tasks` (AFTER UPDATE)

---

### **3️⃣ Trigger: Pausar Cadência ao Responder**

**Quando:** Cliente envia mensagem (`sender_type = 'customer'`)

**Ação:**
1. Busca enrollment `active` deste contato
2. Muda status do enrollment para `paused`
3. Registra `replied_at` com timestamp da mensagem
4. Marca todas as tasks `pending` como `skipped`

**Trigger:** `trigger_pause_on_reply` → `pause_cadence_on_reply()`

**Tabela:** `messages` (AFTER INSERT)

**Objetivo:** Evitar spam quando o cliente já demonstrou interesse.

---

## 🎯 Componentes Frontend

### **1. Página: `/cadences`** (`src/pages/Cadences.tsx`)
- Lista todas as cadências (com filtro por ativas/inativas)
- Botão "Nova Cadência"
- Cards exibindo: nome, descrição, status, número de steps
- Ações: Editar, Deletar, Ver Steps

---

### **2. Dialog: `CadenceDialog`** (`src/components/CadenceDialog.tsx`)
- Form para criar/editar cadência
- Campos: nome, descrição, is_active
- Validação com Zod + React Hook Form

---

### **3. Dialog: `CadenceStepDialog`** (`src/components/CadenceStepDialog.tsx`)
- Form para adicionar/editar steps da cadência
- Campos: position, step_type, day_offset, task_title, task_description, message_template
- Seletor de tipo de step (Email, WhatsApp, Call, Task)

---

### **4. Página: `/sales-tasks`** (`src/pages/SalesTasks.tsx`)
**WORKZONE DO VENDEDOR** - Centro de execução diária

**Features:**
- Lista de tasks agendadas para hoje (ou data selecionada)
- Filtros por tipo: All, Email, WhatsApp, Call, Task
- Para cada task exibe:
  - Avatar e nome do contato
  - Tipo de task (badge colorido)
  - Informações de contato (email, phone, empresa)
  - Cadência e step atual
  - Template de mensagem (se houver)
- Botões de ação rápida:
  - ✅ **Executar** (marca como completed)
  - ⏭️ **Pular** (marca como skipped)

---

## 🔗 Hooks Customizados

### **1. `useCadences()`**
Busca todas as cadências (com filtro opcional por ativa/inativa).

```typescript
const { data: cadences, isLoading } = useCadences({ isActive: true });
```

---

### **2. `useCreateCadence()`**
Cria nova cadência.

```typescript
const createMutation = useCreateCadence();
createMutation.mutate({ name: "...", description: "..." });
```

---

### **3. `useUpdateCadence()`**
Atualiza cadência existente.

```typescript
const updateMutation = useUpdateCadence();
updateMutation.mutate({ id: "...", name: "...", is_active: false });
```

---

### **4. `useDeleteCadence()`**
Deleta cadência (CASCADE DELETE nos steps e enrollments).

```typescript
const deleteMutation = useDeleteCadence();
deleteMutation.mutate("cadence_id");
```

---

### **5. `useCadenceSteps(cadenceId)`**
Busca todos os steps de uma cadência (ordenados por position).

```typescript
const { data: steps } = useCadenceSteps(cadenceId);
```

---

### **6. `useCadenceEnrollments(options)`**
Busca enrollments com filtros (status, contact_id, cadence_id).

```typescript
const { data: enrollments } = useCadenceEnrollments({ status: "active" });
```

---

### **7. `useEnrollContact()`**
Inscreve um contato em uma cadência.

```typescript
const enrollMutation = useEnrollContact();
enrollMutation.mutate({ contact_id: "...", cadence_id: "..." });
```

**Trigger automático:** Cria a primeira task ao inscrever.

---

### **8. `useCadenceTasks(options)`**
Busca tasks com filtros (date, status, taskType).

```typescript
const { data: tasks } = useCadenceTasks({
  date: "2025-01-15",
  status: "pending",
  taskType: "email"
});
```

---

### **9. `useCompleteCadenceTask()`**
Marca task como completada ou pulada.

```typescript
const completeMutation = useCompleteCadenceTask();
completeMutation.mutate({ task_id: "...", skip: false });
```

**Trigger automático:** Cria próximo step ao completar.

---

## 📈 Índices de Performance

Para garantir performance em queries complexas, foram criados índices:

```sql
-- Buscar tasks por vendedor e data
idx_cadence_tasks_assigned_scheduled

-- Buscar enrollments por contato
idx_cadence_enrollments_contact

-- Buscar enrollments por status
idx_cadence_enrollments_status

-- Buscar steps por cadência (ordenação)
idx_cadence_steps_cadence_position

-- Buscar tasks por enrollment (histórico)
idx_cadence_tasks_enrollment

-- Buscar tasks por contato (todas do contato)
idx_cadence_tasks_contact

-- Evitar duplicatas de enrollment
idx_cadence_enrollments_unique_active
```

---

## 🎨 Design Patterns Utilizados

### **1. Trigger-Based Automation**
Toda a lógica de execução acontece no banco via triggers, garantindo consistência mesmo em operações concorrentes.

---

### **2. Event Sourcing Simplificado**
Cada task é um evento imutável. O histórico completo de um enrollment pode ser reconstruído pela sequência de tasks.

---

### **3. RBAC (Role-Based Access Control)**
Sales Rep vê apenas suas próprias cadências e tasks. Admin/Manager tem visão global.

---

### **4. Optimistic UI Updates**
Mutations com React Query invalidam cache automaticamente, atualizando UI sem reload.

---

## 🚀 Casos de Uso

### **Caso 1: Lead Frio - Reativação**
**Cadência:** 7 dias, 5 touchpoints
- Dia 0: Email de reapresentação
- Dia 2: WhatsApp follow-up
- Dia 4: Ligação de qualificação
- Dia 5: Email com case de sucesso
- Dia 7: Última tentativa (call final)

---

### **Caso 2: Demo Agendada - Pré-aquecimento**
**Cadência:** 3 dias, 3 touchpoints
- Dia -2: Email com materiais preparatórios
- Dia -1: WhatsApp de confirmação
- Dia 0: Call de demo

---

### **Caso 3: Pós-Proposta - Follow-up Comercial**
**Cadência:** 10 dias, 4 touchpoints
- Dia 2: Email checando recebimento da proposta
- Dia 5: Call para esclarecer dúvidas
- Dia 8: WhatsApp com urgência (oferta limitada)
- Dia 10: Email final (última chance)

---

## 🔒 Segurança e RLS

Todas as tabelas têm RLS (Row-Level Security) habilitado:

- **Sales Rep:** Acesso apenas aos seus próprios recursos
- **Admin/Manager:** Acesso global sem restrições
- **Triggers:** Executam com `SECURITY DEFINER` e `search_path = public` para evitar injection

---

## 📊 Métricas Rastreáveis

O sistema permite análises de:

1. **Taxa de Resposta por Step:** Quantos clientes respondem em cada etapa?
2. **Tempo Médio até Resposta:** Quanto tempo leva para cliente engajar?
3. **Taxa de Conclusão:** Quantos enrollments chegam ao final?
4. **Taxa de Pausa:** Quantos são pausados por resposta do cliente?
5. **Performance por Tipo de Touchpoint:** Email vs WhatsApp vs Call - qual converte mais?

---

## ✅ Status de Implementação

- ✅ SUB-FASE 2.1: Schema completo do banco de dados
- ✅ SUB-FASE 2.2: 9 hooks CRUD para gerenciamento
- ✅ SUB-FASE 2.3: Interface de gestão de cadências (`/cadences`)
- ✅ SUB-FASE 2.4: Workzone de execução (`/sales-tasks`)
- ✅ SUB-FASE 2.5: Lógica de automação com triggers
- ✅ SUB-FASE 2.6: Documentação e guia de testes

**🎯 Sistema 100% funcional e pronto para produção!**
