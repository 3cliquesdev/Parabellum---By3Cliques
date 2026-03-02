

# Fix: Trava Financeira — Fallback sem Handoff

## Problema Raiz

Quando a IA detecta intenção financeira ("devolução") na conversa #67FC6573, três falhas em cascata deixam o cliente sem resposta:

1. **`ai-autopilot-chat`** (linha 1310): Como `hasFlowContext=true`, NÃO faz `waiting_human` — delega ao webhook
2. **`meta-whatsapp-webhook`** (linha 948): Re-invoca `process-chat-flow` com `forceFinancialExit=true`, mas o motor avança ao próximo nó que pode não existir ou não ter transfer
3. **Fallback do webhook** (linhas 1034-1073): Envia mensagem de handoff ao WhatsApp, mas **nunca atualiza `ai_mode` para `waiting_human`** nem define `department`

Resultado: conversa fica em `autopilot` sem agente, sem departamento, cliente recebe silêncio.

## Solução

### 1. `meta-whatsapp-webhook/index.ts` — Fallback financeiro com handoff real

No bloco fallback (após linha 1060), adicionar:
- Update da conversa: `ai_mode = 'waiting_human'`, `assigned_to = null`, `department = DEPT_FINANCEIRO_ID`
- Buscar o ID do departamento "Financeiro" via query (com fallback para `waiting_human` sem departamento se não encontrar)
- Completar o flow state como `transferred` para não ficar em loop

### 2. `ai-autopilot-chat/index.ts` — Autopilot global (sem flow) já funciona

A linha 1311-1316 já faz `waiting_human` quando `!hasFlowContext`. Porém, falta definir o departamento financeiro. Adicionar `department` ao update.

### 3. `ai-autopilot-chat/index.ts` — Com flow context, garantir mensagem é enviada

Quando `hasFlowContext=true`, o autopilot retorna `financialBlocked` mas NÃO envia mensagem ao cliente (delega ao webhook). Se o webhook falhar no re-invoke, o fallback precisa ser robusto — já coberto pela correção #1.

### 4. `process-chat-flow/index.ts` — Financial exit sem próximo nó

Quando `financialIntentMatch=true` e `findNextNode` retorna `null`, forçar:
- Mensagem de fallback ao cliente: "Vou te encaminhar para o setor financeiro"
- Update da conversa para `waiting_human` com departamento financeiro
- Completar flow state como `transferred`
- Retornar `{ transfer: true, departmentId: DEPT_FINANCEIRO }` para o webhook

## Departamento Financeiro

Buscar dinamicamente: `SELECT id FROM departments WHERE name ILIKE '%financ%' LIMIT 1`. Se não existir, fazer handoff genérico (sem departamento, `waiting_human`).

## Impacto
- Zero regressão: travas financeiras existentes (flow com próximo nó, sem flow) continuam funcionando
- Cobre o caso não tratado: financial exit + flow sem próximo nó + fallback do webhook
- Cliente SEMPRE recebe mensagem + conversa SEMPRE vai para humano

