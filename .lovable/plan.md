
# Configuração: Fechar ou Manter Aberta Fora do Horário — ✅ IMPLEMENTADO

## Alterações

### 1. Hook `useAfterHoursKeepOpen` — ✅ Criado
- Gerencia `system_configurations` key `after_hours_keep_open`
- Default: `true` (manter aberta)

### 2. Toggle na UI (SLASettings) — ✅ Adicionado
- Switch "Manter conversa aberta fora do horário" na seção BusinessMessagesSection
- Com descrição dinâmica conforme estado

### 3. `meta-whatsapp-webhook` — ✅ Condicional
- Busca `after_hours_keep_open` em paralelo com template
- `true`: mantém aberta + salva metadata pending
- `false`: fecha com `close_reason: "after_hours_handoff"`

### 4. `ai-autopilot-chat` — ✅ Condicional
- Busca `after_hours_keep_open` no bloco request_human_agent
- `false`: fecha conversa
- `true`: mantém aberta (comportamento anterior)

### 5. Deploy — ✅ Realizado

