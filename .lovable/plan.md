

# Plano: Interceptar transferências fora do horário + enviar mensagem ao cliente

## Problema confirmado

No `meta-whatsapp-webhook` (linha 945), quando o fluxo retorna `transfer: true`, a transferência é executada **sem verificar horário comercial**:
- Seta `ai_mode: 'waiting_human'` imediatamente
- Chama `route-conversation` (que não encontra agentes)
- O Stage 6 do `auto-close-conversations` (linha 1051) deveria enviar a mensagem after-hours e aplicar a tag "9.05", mas só roda a cada X minutos e com 10 min de threshold — **resultando em mensagem que nunca chega ao cliente**

## Solução

Interceptar no `meta-whatsapp-webhook` **antes** de executar a transferência. Se fora do horário:

1. **Enviar mensagem de fora do horário ao cliente via WhatsApp** (template de `business_messages_config` key `after_hours_handoff`)
2. **Aplicar tag configurada** (`after_hours_tag_id`) na conversa + proteger
3. **NÃO** setar `waiting_human` — manter `ai_mode` atual (autopilot)
4. **NÃO** chamar `route-conversation`
5. Logar `after_hours_transfer_blocked` para auditoria

## Arquivo alterado

**`supabase/functions/meta-whatsapp-webhook/index.ts`**

- Importar `getBusinessHoursInfo` de `../_shared/business-hours.ts`
- No bloco `if (flowData.transfer)` (linha 945), antes de qualquer update:

```text
if (flowData.transfer) {
  const bhInfo = await getBusinessHoursInfo(supabase);

  if (!bhInfo.within_hours) {
    // 1. Buscar template + tag de after_hours
    // 2. Enviar mensagem via send-meta-whatsapp
    // 3. Aplicar tag + protected_tag
    // 4. Log de auditoria
    // 5. NÃO setar waiting_human, NÃO chamar route-conversation
    continue;
  }

  // ... código existente de transferência (inalterado)
}
```

## Deploy

Apenas `meta-whatsapp-webhook` precisa ser redeployado.

