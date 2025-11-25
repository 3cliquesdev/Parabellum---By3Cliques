# 🧪 Onboarding Playbooks Enterprise - Plano de Testes End-to-End

## Objetivo
Validar o sistema completo de Playbooks Enterprise incluindo branching condicional, approval gates, smart retries, exit goals, e execução automática via CRON.

---

## ✅ FASE 9: Checklist de Testes

### 1️⃣ Teste de Execução Básica Linear

**Cenário:** Criar e executar playbook simples sem branching

**Passos:**
1. Ir para `/onboarding-builder`
2. Criar novo playbook "Onboarding Básico"
3. Adicionar sequência linear:
   - Email Node → "Boas-vindas" (subject: "Bem-vindo!")
   - Delay Node → 1 dia
   - Task Node → "Configurar Conta"
   - Call Node → "Ligação de Boas-vindas"
4. Salvar playbook e vincular a um produto
5. Criar deal com esse produto e marcar como WON
6. Verificar em `/playbook-executions`:
   - ✅ Execution criada com status "running"
   - ✅ Primeiro email enviado imediatamente
   - ✅ Delay node agendado para +1 dia
   - ✅ Nodes executados aparecem na timeline

**Resultado Esperado:** Playbook inicia automaticamente, primeiro email enviado, próximos nodes agendados corretamente.

---

### 2️⃣ Teste de Branching Condicional (If/Else)

**Cenário:** Playbook que adapta fluxo baseado em comportamento do cliente

**Passos:**
1. Criar playbook "Onboarding Inteligente"
2. Adicionar estrutura condicional:
   - Email Node → "Email de Ativação" (com link)
   - Condition Node → Tipo: "email_clicked"
   - **Path TRUE** (verde) → Email "Obrigado por clicar!"
   - **Path FALSE** (vermelho) → Email "Lembrete: Complete seu cadastro"
3. Salvar e executar em cliente de teste
4. **Teste A:** Simular click no email (criar interaction tipo `email_click`)
5. **Teste B:** Não simular click (deixar passar tempo)
6. Verificar em `/playbook-executions`:
   - ✅ Condition node avalia corretamente
   - ✅ True path executado quando há click
   - ✅ False path executado quando não há click

**Resultado Esperado:** Sistema roteia para path correto baseado em condição.

---

### 3️⃣ Teste de Approval Node (Human Gate)

**Cenário:** Playbook que pausa aguardando aprovação do consultor

**Passos:**
1. Criar playbook "Onboarding com Aprovação"
2. Adicionar estrutura:
   - Email Node → "Boas-vindas"
   - Approval Node → Approver: "consultant", Mensagem: "Aprovar continuação do onboarding?"
   - Email Node → "Próximos Passos" (só executa após aprovação)
3. Executar playbook
4. Verificar em `/playbook-executions`:
   - ✅ Execution para no approval node (status "running")
   - ✅ Approval node mostra badge "⏸️ Aguarda Aprovação"
   - ✅ Nodes após approval NÃO executam até aprovação
5. **Simular aprovação manual** (atualizar queue item para completed)
6. Verificar que próximo node executa após aprovação

**Resultado Esperado:** Playbook pausa no gate, só continua após aprovação.

---

### 4️⃣ Teste de Smart Retry com Exponential Backoff

**Cenário:** Node falha e sistema tenta automaticamente com delays crescentes

**Passos:**
1. Criar playbook com Email Node configurado com email INVÁLIDO
2. Executar playbook
3. Verificar em `/playbook-executions` → Detalhes da Execução:
   - ✅ Primeira tentativa falha imediatamente
   - ✅ Queue item mostra `retry_count: 1`, `next_retry_at: +5 minutos`
   - ✅ Segunda tentativa falha → `retry_count: 2`, `next_retry_at: +1 hora`
   - ✅ Terceira tentativa falha → `retry_count: 3`, `next_retry_at: +6 horas`
   - ✅ Após 3 falhas → status muda para "failed"
   - ✅ Erro exibido na seção "Erros" com detalhes
4. Verificar console logs da Edge Function `process-playbook-queue`

**Resultado Esperado:** Sistema tenta 3x com delays exponenciais (5min, 1h, 6h) antes de falhar permanentemente.

---

### 5️⃣ Teste de Exit Goals (Goal-Based Termination)

**Cenário:** Playbook termina automaticamente quando cliente atinge objetivo

**Passos:**
1. Criar playbook "Onboarding com Meta"
2. Criar `playbook_goals` record:
   - `playbook_id`: ID do playbook criado
   - `contact_id`: ID do cliente de teste
   - `goal_type`: "interaction_detected"
   - `goal_conditions`: `{"interaction_type": "meeting_booked"}`
3. Executar playbook normalmente
4. **Durante execução**, criar interaction do tipo `meeting_booked` para o cliente
5. Verificar em `/playbook-executions`:
   - ✅ Execution muda status para "completed_via_goal" (badge azul)
   - ✅ Todos queue items pendentes cancelados
   - ✅ Interaction criada documentando auto-terminação
   - ✅ Nodes restantes NÃO executam

**Resultado Esperado:** Playbook para imediatamente quando goal é atingido, prevenindo automações desnecessárias.

---

### 6️⃣ Teste de CRON Job Automático

**Cenário:** Fila processa automaticamente a cada minuto sem intervenção manual

**Passos:**
1. Criar playbook simples com Email → Delay 1 min → Email
2. Executar playbook
3. **NÃO clicar** no botão "Processar Fila Agora"
4. Aguardar 2 minutos observando `/playbook-executions`
5. Verificar:
   - ✅ Primeiro email envia imediatamente
   - ✅ Delay node processa automaticamente após 1 minuto
   - ✅ Segundo email envia automaticamente após delay
   - ✅ Nenhuma ação manual necessária
6. Verificar logs da Edge Function `process-playbook-queue` (deve ter logs a cada minuto)

**Resultado Esperado:** Sistema processa fila automaticamente sem intervenção manual.

---

### 7️⃣ Teste de Dashboard de Execuções

**Cenário:** Interface mostra todas execuções com filtros e detalhes

**Passos:**
1. Criar e executar 5+ playbooks diferentes (com sucesso, falha, running)
2. Ir para `/playbook-executions`
3. Verificar:
   - ✅ Cards de métricas mostram totais corretos
   - ✅ Tabela exibe todas execuções com cores corretas:
     - Verde para "completed"
     - Azul para "completed_via_goal"
     - Vermelho para "failed"
     - Pulsando azul para "running"
   - ✅ Click em "Detalhes" abre modal com:
     - Informações gerais (status, datas)
     - Timeline de nodes executados
     - Fila de execução com retry counts
     - Erros (se houver)
4. Testar botão "Processar Fila Agora" → deve mostrar toast de sucesso

**Resultado Esperado:** Dashboard completo e funcional com todas informações de execução.

---

### 8️⃣ Teste de Integração Completa (Cenário Real)

**Cenário:** Fluxo empresarial completo com todos recursos

**Playbook:** "Onboarding Premium Enterprise"
```
1. Email "Boas-vindas Premium" 
2. Delay 2 dias
3. Condition: email_opened?
   → TRUE: Email "Obrigado! Veja os próximos passos"
   → FALSE: Email "Não perca: Configuração Premium"
4. Task "Agendar Call de Implementação"
5. Approval Node (Consultant) "Aprovar continuação?"
6. Email "Parabéns! Implementação Iniciada"
7. Call "Follow-up Premium"

Exit Goal: interaction_type = "meeting_booked"
```

**Passos:**
1. Criar playbook conforme estrutura acima
2. Criar playbook_goal para terminação antecipada
3. Executar em cliente real
4. Simular comportamento:
   - Cliente abre primeiro email
   - Cliente agenda meeting (atinge goal)
5. Verificar:
   - ✅ Path TRUE executado após email_opened
   - ✅ Playbook termina automaticamente no goal
   - ✅ Approval node e nodes posteriores NÃO executam
   - ✅ Status final: "completed_via_goal"

**Resultado Esperado:** Sistema orquestra fluxo complexo com branching, delays, approvals e goal-based termination perfeitamente.

---

## 🎯 Critérios de Aceitação FASE 9

- [ ] Todos 8 cenários testados e validados
- [ ] CRON job processando automaticamente
- [ ] Smart retry funcionando com exponential backoff
- [ ] Branching condicional roteando corretamente
- [ ] Approval nodes pausando execução
- [ ] Exit goals terminando playbooks automaticamente
- [ ] Dashboard exibindo todas execuções com detalhes
- [ ] Zero erros no console do navegador
- [ ] Zero erros nos logs das Edge Functions

---

## 🚀 Comando para Verificar CRON Job Ativo

```sql
-- Ver CRON jobs ativos
SELECT * FROM cron.job;

-- Ver histórico de execuções do CRON
SELECT * FROM cron.job_run_details 
WHERE jobname = 'process-playbook-queue-every-minute'
ORDER BY start_time DESC 
LIMIT 10;
```

---

## 📊 Queries Úteis para Debug

```sql
-- Ver todas execuções
SELECT id, status, started_at, completed_at, current_node_id 
FROM playbook_executions 
ORDER BY created_at DESC;

-- Ver fila de execução
SELECT id, execution_id, node_type, status, retry_count, scheduled_for, last_error
FROM playbook_execution_queue
WHERE status = 'pending'
ORDER BY scheduled_for ASC;

-- Ver goals ativos
SELECT * FROM playbook_goals WHERE is_active = true;
```

---

## ✅ Status: PRONTO PARA TESTES

Todas as 9 fases implementadas. Sistema enterprise completo aguardando validação end-to-end.
