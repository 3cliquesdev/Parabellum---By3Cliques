# 🎯 Guia de Teste - Sales Engagement System

## ✅ SUB-FASE 2.6: Teste End-to-End

Este documento descreve como testar o sistema completo de Sales Engagement (Cadências) desde a criação até a execução automática.

---

## 📋 Pré-requisitos

Antes de iniciar os testes, certifique-se de que:

1. ✅ Você está logado com um usuário `sales_rep` ou `admin`
2. ✅ Existe pelo menos 1 contato na base (ou crie um novo)
3. ✅ O sistema está rodando e acessível

---

## 🧪 Roteiro de Teste Completo

### **PASSO 1: Criar uma Cadência de Teste**

**Local:** `/cadences`

1. Clique no botão **"+ Nova Cadência"**
2. Preencha os campos:
   - **Nome:** `Cadência de Follow-up Leads`
   - **Descrição:** `Sequência de 5 dias para nutrir leads frios`
   - **Status:** ✅ Ativa
3. Clique em **"Criar Cadência"**

**Resultado esperado:**
- Cadência criada com sucesso
- Toast de confirmação exibido
- Nova cadência aparece na lista

---

### **PASSO 2: Adicionar Steps à Cadência**

**Local:** `/cadences` → Clique na cadência criada

Adicione os seguintes steps (clique em **"+ Adicionar Step"** para cada):

#### **Step 1: Email Inicial (Dia 0)**
- **Tipo:** Email
- **Posição:** 1
- **Day Offset:** 0
- **Título da Task:** `Enviar email de boas-vindas`
- **Descrição:** `Apresentar a empresa e qualificar interesse`
- **Template de Mensagem:**
  ```
  Olá {{first_name}},

  Percebi que você demonstrou interesse em nossos serviços.
  Gostaria de agendar 15 minutos para entender suas necessidades?

  Att,
  Equipe de Vendas
  ```

#### **Step 2: WhatsApp Follow-up (Dia 2)**
- **Tipo:** WhatsApp
- **Posição:** 2
- **Day Offset:** 2
- **Título da Task:** `Follow-up via WhatsApp`
- **Descrição:** `Verificar se recebeu o email anterior`
- **Template de Mensagem:**
  ```
  Oi {{first_name}}! 👋

  Enviei um email há 2 dias. Conseguiu dar uma olhada?
  Podemos conversar rapidamente hoje?
  ```

#### **Step 3: Ligação de Qualificação (Dia 4)**
- **Tipo:** Call
- **Posição:** 3
- **Day Offset:** 4
- **Título da Task:** `Ligação de qualificação`
- **Descrição:** `Entender fit do produto e agendar demonstração`

**Resultado esperado:**
- 3 steps criados com sucesso
- Steps ordenados por posição (1, 2, 3)
- Cada step mostra tipo, offset e título

---

### **PASSO 3: Inscrever um Contato na Cadência**

**Local:** `/contacts` → Selecione um contato → Abra sheet lateral

1. No sheet lateral do contato, localize a seção **"Cadências"**
2. Clique em **"Inscrever em Cadência"**
3. Selecione **"Cadência de Follow-up Leads"**
4. Clique em **"Inscrever"**

**Resultado esperado:**
- Toast de confirmação: "Contato inscrito na cadência com sucesso"
- Registro criado em `cadence_enrollments` (verificar no backend)
- Status do enrollment: `active`
- `current_step`: 1

**✨ MÁGICA AUTOMÁTICA:** O trigger `create_initial_cadence_task()` deve criar automaticamente a primeira task!

---

### **PASSO 4: Verificar Task Criada Automaticamente**

**Local:** `/sales-tasks` (Workzone)

1. Acesse a Workzone do vendedor
2. Verifique que apareceu uma task pendente:
   - **Contato:** O contato inscrito
   - **Tipo:** Email (📧)
   - **Título:** "Enviar email de boas-vindas"
   - **Data agendada:** Hoje (day_offset = 0)
   - **Status:** Pending

**Resultado esperado:**
- Task visível na Workzone
- Informações do contato exibidas (nome, email, avatar)
- Template de mensagem visível
- Botões "Executar" e "Pular" disponíveis

---

### **PASSO 5: Executar a Task (Completar Step 1)**

**Local:** `/sales-tasks`

1. Localize a task criada
2. Clique no botão **"Executar"**
3. Confirme a ação

**Resultado esperado:**
- Toast de confirmação: "Tarefa concluída"
- Task desaparece da lista de pendentes
- Status da task mudou para `completed`

**✨ MÁGICA AUTOMÁTICA:** O trigger `advance_cadence_step()` deve:
1. Atualizar `current_step` do enrollment para 2
2. Criar automaticamente a próxima task (WhatsApp Follow-up)
3. Agendar task para daqui a 2 dias (day_offset = 2)

---

### **PASSO 6: Verificar Criação Automática do Próximo Step**

**Local:** Backend (Lovable Cloud → Database → Tables → `cadence_tasks`)

1. Acesse o backend
2. Vá para a tabela `cadence_tasks`
3. Filtre por `enrollment_id` do enrollment criado

**Resultado esperado:**
- 2 tasks existem:
  - Task 1: Status `completed` (email já executado)
  - Task 2: Status `pending` (WhatsApp agendado para +2 dias)
- Task 2 tem:
  - `task_type`: `whatsapp`
  - `scheduled_for`: Data atual + 2 dias
  - `title`: "Follow-up via WhatsApp"

---

### **PASSO 7: Simular Resposta do Cliente (Pausar Cadência)**

**Local:** Backend → `messages` table

Insira uma mensagem simulando resposta do cliente:

```sql
INSERT INTO messages (
  conversation_id,
  content,
  sender_type,
  created_at
)
VALUES (
  'ID_DA_CONVERSA_DO_CONTATO',  -- Substituir pelo ID real
  'Olá! Recebi seu email e tenho interesse!',
  'customer',
  NOW()
);
```

**✨ MÁGICA AUTOMÁTICA:** O trigger `pause_cadence_on_reply()` deve:
1. Detectar que é uma mensagem de `customer`
2. Buscar enrollment ativo deste contato
3. Mudar status do enrollment para `paused`
4. Marcar tasks pendentes como `skipped`

**Resultado esperado:**
- Enrollment mudou para status `paused`
- `replied_at` preenchido com timestamp da mensagem
- Tasks pendentes (WhatsApp e Call) marcadas como `skipped`
- Task 2 (WhatsApp) não aparece mais na Workzone

---

## 🎉 Checklist de Validação Final

Marque ✅ cada item validado:

- [ ] Cadência criada com sucesso
- [ ] 3 steps adicionados corretamente
- [ ] Contato inscrito na cadência
- [ ] Task inicial criada automaticamente (trigger)
- [ ] Task aparece na Workzone corretamente
- [ ] Ao completar task, próximo step é criado automaticamente (trigger)
- [ ] Tasks futuras agendadas com day_offset correto
- [ ] Resposta do cliente pausa a cadência automaticamente (trigger)
- [ ] Tasks pendentes são canceladas ao pausar

---

## 🐛 Troubleshooting

### **Problema:** Task não foi criada automaticamente

**Solução:**
1. Verifique se o trigger `trigger_create_initial_task` está ativo:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trigger_create_initial_task';
   ```
2. Verifique se a cadência tem um step com `position = 1`
3. Verifique logs do Supabase para erros de trigger

---

### **Problema:** Próximo step não avança automaticamente

**Solução:**
1. Verifique se o trigger `trigger_advance_step` está ativo
2. Verifique se a task foi realmente marcada como `completed` (não `skipped`)
3. Verifique se o enrollment está com status `active`

---

### **Problema:** Cadência não pausa quando cliente responde

**Solução:**
1. Verifique se o trigger `trigger_pause_on_reply` está ativo na tabela `messages`
2. Verifique se `sender_type` é realmente `'customer'` (não `'user'` ou `'ai'`)
3. Verifique se existe um enrollment `active` para o contato

---

## 📊 Queries Úteis para Debug

### Ver todos os enrollments ativos
```sql
SELECT 
  ce.*,
  c.first_name || ' ' || c.last_name as contact_name,
  cad.name as cadence_name
FROM cadence_enrollments ce
JOIN contacts c ON c.id = ce.contact_id
JOIN cadences cad ON cad.id = ce.cadence_id
WHERE ce.status = 'active';
```

### Ver tasks pendentes de hoje
```sql
SELECT 
  ct.*,
  c.first_name || ' ' || c.last_name as contact_name
FROM cadence_tasks ct
JOIN contacts c ON c.id = ct.contact_id
WHERE ct.status = 'pending'
  AND ct.scheduled_for = CURRENT_DATE
ORDER BY ct.created_at;
```

### Ver histórico completo de um enrollment
```sql
SELECT 
  ct.*,
  cs.position as step_position,
  cs.step_type
FROM cadence_tasks ct
JOIN cadence_steps cs ON cs.id = ct.step_id
WHERE ct.enrollment_id = 'SEU_ENROLLMENT_ID'
ORDER BY cs.position;
```

---

## ✅ Conclusão

Se todos os testes passaram, o **Sales Engagement System está 100% funcional** com:

- ✅ Criação de cadências e steps via UI
- ✅ Inscrição de contatos
- ✅ Criação automática de tasks (triggers)
- ✅ Workzone funcional com filtros
- ✅ Avanço automático de steps (triggers)
- ✅ Pausa automática por resposta (triggers)

**🎯 Sistema pronto para uso em produção!**
