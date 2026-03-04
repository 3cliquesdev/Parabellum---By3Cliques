

# Fix: IA nao encerra conversa quando cliente confirma

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Problema

O regex de confirmação (`yesPatterns`) na linha 1759 do `ai-autopilot-chat/index.ts` usa ancoragem estrita (`^...$`), exigindo que a mensagem do cliente seja **exatamente** uma das palavras listadas. Respostas naturais como "sim obrigado", "sim, fui ajudada", "foi sim", "sim valeu obrigado", "pode sim, obrigado" **não passam** no teste regex e caem no bloco "ambíguo" (linha 1896), que repete a pergunta infinitamente.

## Solução

**Arquivo: `supabase/functions/ai-autopilot-chat/index.ts`** (linha ~1759)

1. Trocar o regex de `yesPatterns` para ser mais flexível: em vez de exigir match exato da string inteira, verificar se a mensagem **contém** um padrão afirmativo e **não contém** negação
2. Mesma lógica para `noPatterns`: verificar se contém negação

Abordagem concreta:

```typescript
// ANTES (muito restritivo):
const yesPatterns = /^(sim|s|yes|pode|pode sim|ok|claro|...)$/i;

// DEPOIS (flexível, detecta "sim" em qualquer posição):
const yesKeywords = /\b(sim|s|yes|pode|ok|claro|com certeza|isso|beleza|blz|valeu|vlw|pode fechar|encerra|encerrar|fechou|tá bom|ta bom|obrigad[oa]?|brigad[oa]?|top|perfeito|resolvido|resolveu|ajudou)\b/i;
const noKeywords = /\b(n[aã]o|nao|ainda n[aã]o|tenho sim|outra|mais uma|espera|perai|pera|n[aã]o foi|problema|d[uú]vida)\b/i;

const msgLower = (customerMessage || '').toLowerCase().trim();
const hasYes = yesKeywords.test(msgLower);
const hasNo = noKeywords.test(msgLower);

if (hasYes && !hasNo) {
  // Confirma encerramento
} else if (hasNo && !hasYes) {
  // Não quer encerrar
} else {
  // Ambíguo - repetir pergunta
}
```

3. Adicionar também "obrigado/obrigada/brigado" como confirmação positiva (muito comum o cliente responder apenas "obrigado" como sinal de que foi resolvido)

## Impacto
- Zero regressão: a lógica de close-conversation, CSAT, tags, kill switch e shadow mode permanece idêntica
- Apenas o critério de match da resposta do cliente muda
- Edge case: se cliente diz "sim, mas tenho outra dúvida" → `hasYes=true` e `hasNo=false` (sem "não"), cairia em YES. Para mitigar, adicionar "mas" como keyword de ambiguidade

