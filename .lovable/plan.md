

# Auditoria Completa: Bugs de IA e Chat Flow

## Resumo Executivo (AGORA)

| Métrica | Valor |
|---------|-------|
| Conversas abertas TOTAL | 48 |
| Sem departamento (orphans) | 5 (4 autopilot + 1 copilot) |
| Sem agente (waiting_human/copilot) | 5 |
| Dispatch jobs escalados (no_agents) | 17+ |
| Flow states presos (>30min) | 3 |
| Contract violations (24h) | 52 |
| Flow exit clean (24h) | 15 |

---

## BUG CRÍTICO 1: Trigger `ensure_dispatch_job` NÃO FUNCIONA

**O fix anterior não resolveu.** O trigger é tipo `AFTER INSERT/UPDATE`, mas o código faz `NEW.department := ...` que **só funciona em triggers BEFORE**. Em triggers AFTER, modificar NEW não tem efeito.

**Prova:** 4 conversas criadas HOJE após o deploy (14:37, 14:41, 14:45, 14:49) ainda estão com `department = NULL`.

**Conversas afetadas agora:**
- `9f4027ea` - Tiago Camatta (14:49) - autopilot, sem dept
- `83e38c1f` - Lucas Mugnol (14:45) - autopilot, sem dept
- `5098c07f` - Casaiq (14:41) - autopilot, sem dept
- `1a57232b` - (14:37) - autopilot, sem dept
- `56e47f5c` - Ana (02:17) - copilot, sem dept

**Fix necessário:** Mudar triggers de `AFTER` para `BEFORE` para que a atribuição de NEW.department funcione. TAMBÉM o fallback só cobre `waiting_human`, mas conversas novas entram como `autopilot` — precisa cobrir TODOS os ai_modes.

---

## BUG CRÍTICO 2: IA presa em loop no nó `ia_entrada` com contract_violation

**20 contract violations nas últimas 24h**, todas no nó `ia_entrada`. A IA gera respostas com markdown (`**Baseado nas informações disponíveis:**`) que são bloqueadas como violação de contrato, mas o fluxo **não avança para o próximo nó**.

**Exemplo real:** Conversa `1a57232b` — cliente perguntou sobre pós-venda/frete. A IA gerou 2 respostas bloqueadas por `contract_violation` mas o cliente nunca foi transferido. O cliente mandou 5 mensagens sem receber resposta.

**Flow states presos no nó `1769459318164`:**
- `85904262` - copilot, Suporte, sem agente (11:10)
- `0a6acf51` - copilot, Suporte, sem agente (02:53)
- `56e47f5c` - copilot, sem dept, com agente (02:17)

**Causa:** Quando `contract_violation_blocked` acontece, o sistema bloqueia a mensagem mas NÃO avança o fluxo. O `forceAIExit` deveria ser acionado pelo webhook, mas aparentemente não está funcionando para todos os casos.

---

## BUG 3: Departamento Customer Success sem agentes (crônico)

**3 conversas esperando com 5-7 tentativas de dispatch, todas escaladas:**
- `df841e8a` - CS, 5 tentativas, escalated
- `1a919536` - CS, 7 tentativas, escalated
- `292f2267` - CS, 6 tentativas, escalated

E há **14+ dispatch jobs históricos** escalados em CS e Financeiro, todos com `last_error: no_agents_available`. Não é bug de código — é que não há agentes online nesses departamentos.

---

## BUG 4: Conversas em copilot sem agente atribuído

**2 conversas** em `copilot` mode com departamento Suporte mas `assigned_to = NULL`:
- `85904262` - copilot, Suporte, dispatch_attempts: 0
- `0a6acf51` - copilot, Suporte, dispatch_attempts: 0

O trigger de dispatch só cria jobs para `waiting_human`, não para `copilot`. Essas conversas mudaram para copilot (provavelmente via auto-handoff) mas nenhum dispatch job foi criado.

---

## Estatísticas de IA (Hoje)

| Evento | Quantidade |
|--------|-----------|
| ai_response (respostas normais) | 175 |
| ai_transfer (transferências) | 74 |
| ai_blocked_commercial | 26 |
| ai_blocked_financial | 25 |
| contract_violation_blocked | 20 |
| flow_exit_clean | 4 |

**Taxa de bloqueio:** 41% das interações resultaram em bloqueio ou transferência (71/175). A IA está tendo dificuldade em resolver muitas perguntas.

---

## Plano de Correção

### Fix 1: Trigger BEFORE (não AFTER)
Recriar triggers como `BEFORE INSERT` e `BEFORE UPDATE` para que `NEW.department := ...` funcione. Expandir o fallback para cobrir qualquer `ai_mode` quando `department IS NULL` e `status = 'open'`.

### Fix 2: Dispatch para copilot também
Adicionar condição no trigger: se `ai_mode IN ('waiting_human', 'copilot') AND assigned_to IS NULL`, criar dispatch job.

### Fix 3: Forçar flow advance após contract_violation
No `ai-autopilot-chat`, quando `contract_violation_blocked` ocorrer e o nó for `ia_entrada`, retornar `flow_advance_needed` em vez de simplesmente bloquear. Isso garante que o webhook avance o fluxo ao próximo nó.

### Fix 4: Corrigir conversas orphans agora (SQL)
- Atribuir dept Suporte às 5 conversas sem departamento
- Cancelar flow states presos e criar dispatch jobs
- Reprocessar as 2 conversas copilot sem agente

### Fix 5: Fallback de dept na CRIAÇÃO da conversa
No webhook (`meta-whatsapp-webhook` e `handle-whatsapp-event`), ao criar uma conversa, se não houver departamento no flow, atribuir Suporte como default.

