

# Correção: Mensagem Fora do Horário no Webhook WhatsApp

## Problema

Quando o fluxo pede transferência para humano (`skipAutoResponse` + `ai_mode_waiting_human`) e nenhum agente está online, o webhook envia uma mensagem genérica hardcoded:

> "⏳ Nosso time de atendimento não está disponível no momento..."

Ele **nunca verifica o horário comercial** e **nunca usa o template configurado** em `business_messages_config`. A lógica de after-hours com template configurável só existe no `ai-autopilot-chat` (tool `request_human_agent`), mas o webhook tem seu próprio caminho que ignora isso.

## Correção

**Arquivo:** `supabase/functions/meta-whatsapp-webhook/index.ts`

### 1. Importar o helper de business hours (topo do arquivo)
```typescript
import { getBusinessHoursInfo } from "../_shared/business-hours.ts";
```

### 2. No bloco `!hasOnlineAgents` (linha ~872), adicionar verificação de horário comercial

Antes de enviar a mensagem genérica, verificar se estamos fora do horário. Se sim:
- Buscar o template configurado em `business_messages_config` (`after_hours_handoff`)
- Substituir variáveis `{schedule}` e `{next_open}`
- Fechar a conversa com motivo `after_hours_handoff` e aplicar a tag configurada
- Enviar a mensagem configurada em vez da genérica

Lógica:
```
if (!hasOnlineAgents) {
  // NOVO: Verificar horário comercial
  const bhInfo = await getBusinessHoursInfo(supabase);
  
  if (!bhInfo.within_hours) {
    // Fora do horário → usar template configurado
    // 1. Buscar template de business_messages_config
    // 2. Buscar tag de after_hours_tag_id  
    // 3. Aplicar tag na conversa
    // 4. Fechar conversa com motivo after_hours_handoff
    // 5. Enviar mensagem configurada
  } else {
    // Dentro do horário mas sem agentes → manter msg atual
    queueMessage = "⏳ Nosso time de atendimento não está disponível...";
  }
}
```

### 3. Redeploy de `meta-whatsapp-webhook`

## Impacto

- Fora do horário: cliente recebe a mensagem que você configurou na tela de SLA, com o template correto e variáveis substituídas
- Dentro do horário sem agentes: mantém comportamento atual (mensagem de indisponibilidade momentânea)
- Nenhuma quebra em outros fluxos

