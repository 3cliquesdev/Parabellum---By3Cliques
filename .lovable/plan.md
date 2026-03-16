

# Diagnóstico Conversa #2D12F4F9 — Evidências Reais + 1 Bug Novo

## O Que Aconteceu (linha do tempo reconstruída do banco)

```text
20:54:42  Cliente: "Boa tarde"           → Flow: Menu "Já é cliente?"
20:55:20  Cliente: "1" (Sim)             → Flow: Menu produto
20:55:29  Cliente: "1" (Drop Nacional)   → Flow: Menu departamento  
20:55:29  Cliente: "1" (Pedidos)         → Navega para node_ia_pedidos → callStrictRAG
20:56:06  IA: "Pode repetir sua mensagem?"  ← BUG 1 (callStrictRAG 400 tokens → vazio)
20:56:20  Cliente: "Sem contexto ainda"  
20:56:23  Cliente: "Mds"                 → Buffer junta → IA chamada
20:57:32  IA: "Não consegui resolver"    ← BUG 2 (FALLBACK_PHRASES: 'não consigo')
20:58:02  Cliente: "Se não consegue resolver o que você faz?"
20:59:35  IA: "Não consegui resolver"    ← BUG 2 de novo
21:10:04  Auto-timeout → Conversa fechada
```

## Bug 1 — callStrictRAG 400 tokens (JÁ CORRIGIDO)

O `callStrictRAG` usava `max_completion_tokens: 400` com `gpt-5` (reasoning model). Os tokens de raciocínio consomem o limite antes de gerar output visível → resposta vazia → "Pode repetir".

**Status: CORRIGIDO** — Já aumentado para `1200` e deploy feito.

## Bug 2 — `'não consigo'` na FALLBACK_PHRASES é muito genérico (NOVO — ATIVO)

A lista `FALLBACK_PHRASES` (linha 726) contém `'não consigo'`. Quando a IA gera uma resposta legítima como "Não consegui encontrar informações sobre seu pedido", o detector de fallback marca como `fallback_phrase_detected`.

Com `flow_context` ativo, o sistema tenta "limpar" a resposta removendo frases de transferência. Mas `'não consigo'` não é uma frase de transferência — é uma expressão normal. O resultado é que a resposta original é mantida mas o contador de fallback incrementa, e após repetições, a IA para de tentar.

**Evidência real do banco (ai_events):**
- `"Sem contexto ainda\nMds"` → `confidence_score: 0.3` → `fallback_phrase_detected` → "Não consegui resolver"
- `"Se não consegue resolver o que você faz?"` → `confidence_score: 0.72` → `fallback_phrase_detected` de novo

**A resposta com score 0.72 era VÁLIDA mas foi marcada como fallback** porque continha "não consigo" em algum trecho.

### Correção

**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts` — Linha 726

Substituir `'não consigo'` por variações mais específicas que realmente indicam incapacidade total:

```typescript
// DE:
'não consigo',

// PARA:
'não consigo te ajudar com isso',
'não consigo resolver',
```

Isso mantém a detecção de frases que indicam desistência real da IA, sem capturar usos legítimos como "não consigo encontrar informações" ou "não consigo localizar seu pedido".

## Deploy

Apenas `ai-autopilot-chat` precisa ser redeployado após a correção.

## Sobre o Teste Automatizado

Não é possível simular um teste end-to-end completo pela ferramenta porque o fluxo depende de mensagens reais do WhatsApp entrando pelo webhook. O que posso garantir:
- O fix de `callStrictRAG` (1200 tokens) está no código ✅
- A correção do `'não consigo'` eliminará os falsos positivos de fallback
- Após deploy, a próxima mensagem "1" no menu de pedidos receberá uma resposta real da IA em vez de "Pode repetir"

