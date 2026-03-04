

# Auditoria: Mensagens do fluxo enviadas só internamente (não chegam no WhatsApp)

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Diagnóstico

O problema está no handler `forceAIExit` do `meta-whatsapp-webhook` (linhas 1550-1593). Quando a IA detecta exit_keyword e re-invoca o `process-chat-flow` com `forceAIExit: true`, o resultado é tratado de forma **diferente** do fluxo principal (CASO 2). Há **3 bugs** neste handler:

### Bug 1 — Opções não formatadas
O CASO 2 (linha 876) faz:
```
formattedMessage = flowData.response + formatOptionsAsText(flowData.options)
```
O handler `forceAIExit` (linha 1559-1565) faz:
```
const flowMessage = flowResult.response || flowResult.message;
// ❌ NÃO chama formatOptionsAsText(flowResult.options)
```
Resultado: A mensagem "Você já é nosso cliente?" chega sem as opções "1️⃣ Sim / 2️⃣ Não".

### Bug 2 — Mensagem salva como `sender_type: "system"` 
Linha 1574: `sender_type: "system"` em vez de seguir o padrão do CASO 2 que usa `is_bot_message: true` e `skip_db_save: false`. Mensagens do tipo "system" aparecem no inbox mas de forma diferente — e o `send-meta-whatsapp` recebe `skip_db_save: true` o que pode causar inconsistência.

### Bug 3 — Transfer no forceAIExit ignora lógica de consultor
Linhas 1581-1591: Se o flow retorna `transfer: true` com `transferType: consultant`, o handler simplesmente faz `assigned_to: null` sem buscar o `consultant_id` do contato. A lógica completa de consultor (linhas 920-1041 do CASO 2) não é replicada.

## Correção

### meta-whatsapp-webhook/index.ts — Handler forceAIExit (linhas 1550-1593)

Alinhar o handler `forceAIExit` com o CASO 2:

1. **Formatar opções**: Adicionar `formatOptionsAsText(flowResult.options)` ao `flowMessage`
2. **Envio consistente**: Usar `skip_db_save: false` e `is_bot_message: true` (como CASO 2), remover o insert manual de mensagem "system"
3. **Transfer com consultor**: Quando `flowResult.transfer === true`, reusar a mesma lógica de consultor do CASO 2 (buscar `consultant_id`, respeitar `consultant_manually_removed` vs `transferType === 'consultant'`, chamar `route-conversation`)

### Resumo das mudanças

```text
ANTES (forceAIExit):
  flowMessage = flowResult.response
  send-meta-whatsapp(skip_db_save: true)
  messages.insert(sender_type: "system")  
  transfer → assigned_to: null (sem consultor)

DEPOIS (forceAIExit):  
  flowMessage = flowResult.response + formatOptionsAsText(flowResult.options)
  send-meta-whatsapp(skip_db_save: false, is_bot_message: true)
  // Remove insert manual
  transfer → mesma lógica CASO 2 (consultor + route-conversation)
```

## Impacto
- Corrige mensagens que apareciam no inbox mas não no WhatsApp do cliente
- Corrige opções (Sim/Não) que não apareciam formatadas
- Corrige transferência para consultor quando disparada via forceAIExit
- Zero regressão — CASO 2 não é alterado, apenas o handler forceAIExit é alinhado

