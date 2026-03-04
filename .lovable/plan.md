

# Criar tabela ai_decision_logs

Analisei o projeto atual e sigo as regras da base de conhecimento.

## O que será feito

Criar a tabela `ai_decision_logs` com índices e RLS via migração, exatamente como especificado pelo usuário.

### Migração SQL

- Tabela `ai_decision_logs` com campos: id, created_at, conversation_id, message_id, channel, department, rule_id, persona_id, decision (enum check), decision_reason, correlation_id, error
- 4 índices (created_at, conversation+created_at, decision+created_at, correlation_id)
- RLS habilitado com policy `service_role` only (leitura/escrita apenas por service_role)

### Pós-migração

Nenhuma alteração de código necessária neste momento — a tabela será consumida pelas edge functions (ai-autopilot-chat, handle-whatsapp-event, etc.) que já devem estar preparadas para inserir nela.

## Impacto
- Zero regressão — tabela nova, sem alteração em tabelas existentes
- RLS restrito a service_role — seguro por design

