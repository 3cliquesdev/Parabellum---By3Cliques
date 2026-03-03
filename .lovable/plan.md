

# Remediação em massa + Redeploy ai-autopilot-chat

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Estado atual

Verificação no banco mostra que restam **3 conversas** (não 97 — muitas já foram corrigidas ou expiraram) com fluxo ativo e `ai_mode` corrompido (`copilot` ou `disabled`).

## Ações a executar

### 1. Script de correção em massa
Executar UPDATE via insert tool para restaurar `ai_mode = 'autopilot'` nas 3 conversas travadas:

```sql
UPDATE conversations 
SET ai_mode = 'autopilot'
WHERE id IN (
  SELECT c.id FROM conversations c
  JOIN chat_flow_states cfs ON cfs.conversation_id = c.id
  WHERE cfs.status IN ('waiting_input', 'active', 'in_progress')
  AND c.ai_mode IN ('copilot', 'disabled')
)
```

### 2. Redeploy `ai-autopilot-chat`
Deploy da edge function com o fix preventivo (não setar `ai_mode=copilot` quando `flow_context` existe).

Nenhuma alteração de código necessária — o fix já está no código. Apenas deploy.

