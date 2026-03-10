
# Bypass de Greeting no Strict RAG ✅

## Status: IMPLEMENTADO

## Problema
Mensagens como "Olá, vim pelo site e gostaria de atendimento" eram rejeitadas pelo Strict RAG (0% confiança) → `flow_advance_needed` → fallback → auto-close.

## Correção
Adicionado bypass de greeting/contato genérico **antes** do check do Strict RAG no `ai-autopilot-chat/index.ts`.

- `isSimpleGreetingEarly`: detecta saudações puras (oi, olá, bom dia, etc.)
- `isGenericContactEarly`: detecta contatos genéricos ("vim pelo site", "gostaria de atendimento", etc.)
- Se qualquer um for true → `isGreetingBypass = true` → Strict RAG é pulado
- A execução continua até a lógica de boas-vindas existente (que já trata esses casos)

## Travas mantidas
- Strict RAG continua ativo para perguntas reais
- Bypass operacional (pedidos/tracking) preservado
- Kill Switch, Shadow Mode, CSAT guard inalterados
