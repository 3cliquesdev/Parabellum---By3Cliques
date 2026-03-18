

# Fix: Ticket não criado + Mensagens IA não salvas no banco

## Diagnóstico da Conversa #C83D106D

### O que aconteceu
1. Cliente no `node_ia_financeiro` pediu "Quero sacar meu saldo do SABR"
2. A LLM respondeu com algo contendo frases de transferência (ex: "vou te encaminhar...")
3. `FALLBACK_STRIP_PATTERNS` (linha 9533) removeu as frases de transferência
4. Mensagem ficou < 5 chars → substituída pelo fallback genérico "Entendi! Poderia me dar mais detalhes..."
5. Isso se repetiu 3x — mas o anti-loop NUNCA disparou
6. A conversa expirou por inatividade sem ticket e sem handoff

### Causa raiz: Bug no contador anti-loop

O contador de fallback é atualizado em **dois momentos diferentes**, mas o primeiro destroi o trabalho do segundo:

```text
EXECUÇÃO SEQUENCIAL:

1. Linha 9317: isFallbackResponse = false (resposta LLM não é fallback... ainda)
2. Linha 9404-9424: Escreve ai_node_fallback_count: 0 (pois isFallbackResponse=false)
3. ... processamento ...
4. Linha 9549: STRIP detecta mensagem vazia → isFallbackResponse = true
5. MAS o counter já foi escrito como 0 na etapa 2!
6. Nenhuma atualização adicional do counter para o caso de strip

Resultado: counter SEMPRE 0, anti-loop NUNCA dispara (threshold = 2)
```

### Causa raiz 2: Mensagens não salvas

As mensagens da IA estão chegando no WhatsApp mas NÃO aparecendo no inbox. A operação de save na linha 9997 provavelmente roda, mas pode estar falhando silenciosamente ou o `status: 'sending'` nunca atualiza para `sent`.

## Plano de Correção

### Fix 1: Mover counter update para DEPOIS do processamento de resposta
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts`

O bloco de atualização do `customer_metadata` (linhas 9392-9448) roda ANTES dos handlers de strip/contract-violation/restriction-violation. Nesse ponto, `isFallbackResponse` ainda tem o valor inicial (geralmente `false`), então o counter é resetado para 0.

**Solução:** Mover o bloco inteiro (linhas 9392-9448) para DEPOIS da linha 9993 (após todo o pipeline de validação/strip/restriction). Nesse ponto, `isFallbackResponse` reflete o estado final real da resposta.

Também remover os counter updates parciais nas linhas 9853-9866 (contract violation) e 9921-9933 (restriction violation) — ficam redundantes com o update unificado no final.

### Fix 2: Anti-loop deve criar ticket automaticamente para conversas financeiras
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts`

Quando o anti-loop dispara (linhas 9340-9389), ele faz `flowExit` com handoff mas NÃO cria ticket. Para conversas no nó financeiro que ficaram em loop, o sistema deveria criar um ticket automaticamente antes do handoff.

**Solução:** No bloco do anti-loop (antes do `return` na linha 9379), verificar se o `flow_context.node_id` contém "financ" ou se o `collectedData.assunto` é "financeiro". Se sim, criar o ticket automaticamente com os dados disponíveis (assunto da conversa, dados do contato, último `customerMessage`).

### Fix 3: Garantir persistência de mensagens de fallback
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts`

Adicionar log mais explícito no catch do save (linha 10022-10024) e verificar se o `INSERT` está retornando erro silencioso. Se houver erro no save, NÃO enviar pelo WhatsApp (consistência).

### Arquivos a alterar
- `supabase/functions/ai-autopilot-chat/index.ts` — 3 fixes acima

