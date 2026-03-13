# Sistema de Encerramento de Conversas — Documentação Técnica

> **Última atualização:** 12/03/2026  
> **Status:** Auditado e validado

---

## Visão Geral

O encerramento de conversas segue um fluxo de **2 etapas (2-step confirmation)**:

1. **IA detecta sinal de encerramento** → chama tool `close_conversation` com `confirmed: false`
2. **IA pergunta ao cliente** → "Posso ajudar em algo mais?"
3. **Cliente responde** → keywords determinam ação (encerrar, continuar, ou repetir pergunta)
4. **Sem resposta (5 min)** → auto-fechamento via Stage 3.5

---

## Arquivos Envolvidos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `supabase/functions/ai-autopilot-chat/index.ts` | Prompt, keywords, tool handler, confirmação |
| `supabase/functions/auto-close-conversations/index.ts` | Stage 3.5 — auto-close por inatividade |
| `supabase/functions/handle-whatsapp-event/index.ts` | Webhook Evolution API — bypass de confirmação |
| `supabase/functions/meta-whatsapp-webhook/index.ts` | Webhook Meta — bypass de confirmação |

---

## Keywords de Confirmação

### `yesKeywords` (encerra a conversa)
```
/^(sim|s|é sim|isso|exato|isso mesmo|era só isso|só isso|era isso|nao tenho|não tenho|
pode encerrar|pode fechar|encerra|encerrar|ta resolvido|tá resolvido|resolvido|
resolveu|nao preciso|não preciso|so isso|só isso|era so|era só)$/i
```

**NÃO inclui:** obrigado, valeu, obrigada, vlw, grato, agradecido

### `noKeywords` (continua atendimento)
```
/^(nao|não|n|ainda nao|ainda não|tenho sim|tenho outra|sim tenho|
preciso de mais|tem mais|outra duvida|outra dúvida|espera|perai|
tenho mais|falta|nao era so|não era só)$/i
```

### `ambiguityKeywords` (repete a pergunta)
```
/mas|porém|porem|entretanto|contudo|no entanto|será que|sera que|
e se|talvez|acho que/i
```

### Guard: Interrogação
Se a mensagem contém `?`, **não é tratada como confirmação** — é redirecionada para resposta normal da IA.

---

## Tool `close_conversation`

### Prompt (L6690)
A IA é instruída a **NUNCA** chamar `close_conversation` quando:
- Cliente diz "obrigado", "valeu", "obrigada"
- Cliente faz pergunta adicional
- Cliente demonstra insatisfação

### Tool Definition (L6871)
```json
{
  "name": "close_conversation",
  "parameters": {
    "reason": "ex: 'assunto_resolvido', 'duvida_esclarecida'",
    "confirmed": "boolean — false na primeira chamada"
  }
}
```

### Handler (L8194-8221)
- `confirmed: false` → seta `awaiting_close_confirmation: true` no metadata + salva `close_reason`
- `confirmed: true` → invoca edge function `close-conversation`

---

## Fluxo de Confirmação (detalhe)

```
1. IA chama close_conversation(confirmed: false)
   → metadata.awaiting_close_confirmation = true
   → metadata.close_reason = "..."
   → IA envia mensagem de confirmação

2. Cliente responde:
   a) yesKeywords match + sem "?"
      → Kill Switch check
      → Shadow Mode check
      → Tags obrigatórias check
      → Invoca close-conversation
      → Limpa metadata (close_reason, awaiting_close_confirmation)

   b) noKeywords match
      → Limpa flags
      → Continua atendimento normal

   c) ambiguityKeywords match
      → Repete pergunta de confirmação

   d) Nenhum match
      → Trata como nova mensagem (conversa continua)

3. Cliente NÃO responde (5 min):
   → Stage 3.5 do auto-close-conversations
   → Envia mensagem de aviso
   → Tag "Falta de Interação"
   → Fecha conversa
```

---

## Stage 3.5 — Auto-Close por Inatividade

**Arquivo:** `auto-close-conversations/index.ts` (L626-699)

### Query
Busca conversas com:
- `status = 'open'`
- `metadata->awaiting_close_confirmation = true`
- `updated_at < now() - 5 minutes`

### Lógica
1. Verifica se último sender é `contact` → **skip** (cliente respondeu, não é inatividade)
2. Limpa metadata: `awaiting_close_confirmation`, `close_reason`
3. Envia mensagem: "Como não tivemos retorno, estamos encerrando..."
4. Adiciona tag: "Falta de Interação"
5. Envia via WhatsApp (se canal = whatsapp)
6. Fecha conversa: `status = 'closed'`, `closed_reason = 'auto_close_confirmation_timeout'`

---

## Bypass de Webhooks

### Problema
Quando `ai_mode = waiting_human` e `awaiting_close_confirmation = true`, a mensagem do cliente precisa chegar na IA para processar a confirmação — mas o webhook normalmente ignora mensagens em modo `waiting_human`.

### Solução: Bypass

**Meta Webhook** (L755-789):
```
Se awaiting_close_confirmation = true E skipAutoResponse = true:
  → Força chamada ao ai-autopilot-chat
  → Ignora check de ai_mode
```

**Evolution API Webhook** (L1198-1237):
```
Se awaiting_close_confirmation = true E ai_mode ≠ autopilot:
  → Força chamada ao ai-autopilot-chat
  → Ignora check de ai_mode
```

---

## Guards de Segurança

Antes de qualquer encerramento, 3 guards são verificados:

### 1. Kill Switch (L2210-2224)
Se `ai_global_enabled = false` → não encerra, retorna mensagem padrão.

### 2. Shadow Mode (L2227-2243)
Se `ai_shadow_mode = true` → sugere encerramento mas não executa.

### 3. Tags Obrigatórias (L2247-2274)
Se tags obrigatórias não foram preenchidas → bloqueia encerramento com mensagem de erro.

---

## Checklist de Validação (22 itens)

| # | Item | Local | Status |
|---|------|-------|--------|
| 1 | Prompt sem "obrigado" como trigger | ai-autopilot-chat L6690 | ✅ |
| 2 | Tool description sem "cliente_agradeceu" | ai-autopilot-chat L6871 | ✅ |
| 3 | yesKeywords restritivo | ai-autopilot-chat L2178 | ✅ |
| 4 | Guard de interrogação | ai-autopilot-chat L2187-2191 | ✅ |
| 5 | noKeywords cobertura | ai-autopilot-chat L2180 | ✅ |
| 6 | ambiguityKeywords | ai-autopilot-chat L2182 | ✅ |
| 7 | Tool handler 2 etapas | ai-autopilot-chat L8194-8221 | ✅ |
| 8 | Confirmação YES → close | ai-autopilot-chat L2290-2296 | ✅ |
| 9 | Confirmação NO → continua | ai-autopilot-chat L2315-2323 | ✅ |
| 10 | Ambíguo → repete | ai-autopilot-chat L2324-2337 | ✅ |
| 11 | Kill Switch guard | ai-autopilot-chat L2210-2224 | ✅ |
| 12 | Shadow Mode guard | ai-autopilot-chat L2227-2243 | ✅ |
| 13 | Tags obrigatórias guard | ai-autopilot-chat L2247-2274 | ✅ |
| 14 | Limpeza close_reason (YES) | ai-autopilot-chat L2206-2208 | ✅ |
| 15 | Limpeza close_reason (NO) | ai-autopilot-chat L2317-2319 | ✅ |
| 16 | Meta webhook bypass | meta-whatsapp-webhook L755-789 | ✅ |
| 17 | Evolution webhook bypass | handle-whatsapp-event L1198-1237 | ✅ |
| 18 | Stage 3.5 query inativas | auto-close-conversations L626-634 | ✅ |
| 19 | Stage 3.5 filtra awaiting | auto-close-conversations L640-643 | ✅ |
| 20 | Stage 3.5 verifica sender | auto-close-conversations L652-663 | ✅ |
| 21 | Stage 3.5 limpa metadata | auto-close-conversations L669 | ✅ |
| 22 | Stage 3.5 tag + fecha | auto-close-conversations L682-699 | ✅ |

---

*Documentação mantida pela equipe de desenvolvimento.*
