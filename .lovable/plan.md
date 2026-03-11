

# Fix: IA desiste em saudações casuais ("Tudo bem?") e avança o fluxo indevidamente

## Problema raiz

A mensagem "Tudo bem?" do cliente causou score 0 + 0 artigos na KB. O guard de zero-confidence (`flow_advance_needed`) disparou imediatamente porque "Tudo bem?" **não está na lista de saudações reconhecidas** (`isSimpleGreeting`). O fluxo avançou ao próximo nó, enviando mensagens genéricas do fluxo em vez de deixar a IA responder naturalmente.

Logs confirmam:
```
ZERO CONFIDENCE + ZERO ARTICLES + flow_context → flow_advance_needed IMEDIATO
  score: 0, articles: 0, node_id: "ia_entrada"
```

## Causa técnica

A regex `isSimpleGreeting` (linha ~4557 e ~4300 do `ai-autopilot-chat`) não inclui frases como:
- "Tudo bem?"
- "Tudo bom?"
- "Como vai?"
- "E aí?"
- "Blz"
- "Tranquilo"

Como `shouldSkipHandoff = false`, o guard de zero-confidence (linha ~4881) retorna `flow_advance_needed` sem nem chamar o modelo de IA.

## Mudanças

### 1. Expandir regex de saudações (`ai-autopilot-chat/index.ts`)

Atualizar AMBAS as instâncias de `isSimpleGreeting` (linhas ~4300 e ~4557) para incluir:
- `tudo bem`, `tudo bom`, `tudo certo`, `tudo tranquilo`
- `como vai`, `como está`, `como vc está`
- `e aí`, `eai`, `eae`
- `blz`, `tranquilo`, `suave`, `beleza`
- `hey`, `bom`, `legal`

### 2. Expandir regex de greeting bypass antecipado (linha ~4300)

A mesma lista deve ser adicionada ao `isSimpleGreetingEarly` para garantir consistência entre os dois checks.

### Arquivo a editar
- `supabase/functions/ai-autopilot-chat/index.ts` — expandir as regex `isSimpleGreeting` e `isSimpleGreetingEarly`

Resultado: Quando o cliente envia saudações casuais, a IA responde naturalmente (usando conhecimento geral) em vez de abandonar o nó e avançar para o próximo passo do fluxo.

