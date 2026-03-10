
# Auditoria IA e Chat Flow — Correções Aplicadas (10/03/2026)

## Correções Implementadas

### ✅ Fix 1: Prefixo cautious sem markdown
- `generateResponsePrefix('cautious')` agora retorna texto plano sem `**`
- Elimina contract violations auto-infligidas pelo próprio sistema

### ✅ Fix 2: Dispatch-conversations aceita copilot
- Separou check de `assigned_to` do check de `ai_mode`
- Agora aceita `waiting_human` E `copilot` para dispatch
- Causa raiz: condição `ai_mode !== 'waiting_human'` rejeitava copilot

### ✅ Fix 3: Conversas stuck corrigidas via SQL
- Flow states presos em `ia_entrada` cancelados
- Dispatch jobs `already_assigned` reabertos como `pending`
- Novos dispatch jobs criados para conversas sem fila

### ⚠️ BUG 3 (operacional): Customer Success sem agentes
- Não é bug de código — departamento sem agentes online
- Requer ação administrativa
