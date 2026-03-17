
# Bug Fix: IA responde mesmo após agente assumir controle — ✅ IMPLEMENTADO

## O que mudou

### 1. RPC `take_control_secure` — Limpeza de flow states ✅
- Adicionado `UPDATE chat_flow_states SET status = 'transferred'` após o takeover
- Garante que **nenhum flow state ativo** sobreviva ao "Assumir Controle"

### 2. Guard de defesa no `process-chat-flow` ✅
- Na seção "Soberania do Fluxo" (linha 925), adicionada verificação:
  - Se `assigned_to` está preenchido **E** `ai_mode = copilot` → **humano tem prioridade**
  - Flow state residual é cancelado automaticamente
  - Retorna `skipAutoResponse = true` (IA não responde)

### 3. Limpeza de dados existentes ✅
- Estados residuais em conversas com agente atribuído foram marcados como `cancelled`
- (Usado `cancelled` em vez de `transferred` para evitar conflito de unique constraint)

## Impacto
- ✅ Resolve o bug para todas as conversas futuras (RPC fix)
- ✅ Corrige conversas afetadas existentes (data cleanup)
- ✅ Defesa em profundidade no motor de fluxos (guard fix)
- ✅ Zero impacto em conversas em autopilot legítimo
