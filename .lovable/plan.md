

# Diagnóstico Conversa #0889710A (pós-deploy) — 2 Problemas Restantes

## Linha do Tempo Reconstruída

```text
21:53  "Boa noite" → Menus OK ✅
21:54  "1" (Pedidos) → node_ia_pedidos ativa ✅
21:55  Acolhida + pediu código → correto ✅
21:57  4 códigos → MySQL consultou, 3 encontrados, 1 não → correto ✅
21:59  "Como fazer devolução?" → IA respondeu (0.56) mas resposta continha fallback phrase
       → Stripada → Caiu no fallback financeiro "Entendi sua solicitação financeira" ❌
22:00  Cliente deu email → "Não consegui resolver" ❌
22:01  Loop de fallback → Timeout para menu
22:04  Voltou ao menu → Pedidos → Rastreio → IA respondeu RAG correto ✅
22:14  "Devolução que cadastrei há dias" → IA respondeu (0.69) mas continha "não consigo resolver"
       → fallback_phrase_detected → "Não consegui resolver por aqui" ❌
```

## Problema 1: `'não consigo resolver por aqui'` na FALLBACK_PHRASES (CRITICO)

A frase que acabamos de adicionar (`'não consigo resolver por aqui'`) está causando falsos positivos. A IA gera respostas legítimas como "Não consigo resolver por aqui diretamente, mas posso explicar o processo de devolução..." e o detector (linha 8783, `.includes()`) marca como fallback.

**Correção:** Remover `'não consigo resolver por aqui'` e `'não consigo resolver'` completamente da lista. Manter apenas `'não consigo te ajudar com isso'` e `'não posso ajudar'` que são frases terminais inequívocas.

**Arquivo:** `ai-autopilot-chat/index.ts` — Linha 727

```typescript
// REMOVER linha 727: 'não consigo resolver por aqui',
```

## Problema 2: Encoding UTF-8 nas mensagens de rastreio

Ainda aparece `informaÃ§Ãµes`, `ðŸ"¦`, `âœ…`, etc. Se o fix anterior não resolveu (o arquivo pode ter sido salvo com encoding errado novamente), precisamos reescrever as strings de template de rastreio com caracteres ASCII escapados ou garantir UTF-8 correto.

**Verificação:** Confirmar se as linhas ~5150-5195 estão com UTF-8 real após o último deploy. Se não, reescrever usando escape sequences Unicode (`\u{1F4E6}` para 📦, etc.).

## Problema 3: Fluxo de Devolução — Onde está o gap?

O cliente pergunta sobre devolução e está no nó `node_ia_pedidos`. A IA TEM artigos na KB sobre devoluções (5 artigos encontrados, score 0.56). O problema NÃO é falta de conteúdo — é que a resposta da IA é descartada pelo detector de fallback.

**Sobre o fluxo financeiro:** A devolução NÃO deveria ir para o fluxo financeiro. "Como fazer uma devolução" é uma pergunta informacional que o nó de Pedidos deve responder. A barreira financeira foi removida para 'devolução' no fix anterior, mas o FALLBACK_PHRASES ainda está sabotando a resposta.

**Após corrigir o Problema 1, a IA vai conseguir entregar a resposta de devolução normalmente no nó de Pedidos, sem precisar de ajuste no fluxo.**

## Resumo de Alterações

| # | Arquivo | Linha | O quê |
|---|---------|-------|-------|
| 1 | `ai-autopilot-chat/index.ts` | 727 | Remover `'não consigo resolver por aqui'` de FALLBACK_PHRASES |
| 2 | `ai-autopilot-chat/index.ts` | ~5150-5195 | Verificar/corrigir encoding UTF-8 dos templates de rastreio |

Após as correções, redeploy de `ai-autopilot-chat`.

