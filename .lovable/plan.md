

# Correção: Strings com UTF-8 corrompido (Mojibake) no ai-autopilot-chat

## Problema
O arquivo `supabase/functions/ai-autopilot-chat/index.ts` (9902 linhas) contém centenas de strings com caracteres corrompidos (mojibake) — ex: `vocÃª` em vez de `você`, `Ã"timo` em vez de `Ótimo`, `soluÃ§Ã£o` em vez de `solução`. Essas strings aparecem em **mensagens enviadas ao cliente no WhatsApp**, resultando em texto "feio" e ilegível.

## Strings críticas afetadas (enviadas ao WhatsApp)

| Linha | Variável | Texto corrompido |
|-------|----------|-----------------|
| 1678 | `cancelMsg` | `vocÃª deseja cancelar` |
| 2588 | `successMessage` | `Ã"timo...Identifiquei vocÃª...solicitaÃ§Ã£o` |
| 2593 | `successMessage` | `Ã"timo...Identifiquei vocÃª` |
| 3073 | `handoffMessage` | `solicitaÃ§Ã£o financeira...vocÃª` |
| 3074 | `handoffMessage` | `dÃºvida...vocÃª...poderÃ¡` |
| 3766 | `leadMessage` | `vocÃª ainda nÃ£o Ã©...poderÃ¡...ðŸ¤` |
| 4894 | `strictHandoffMessage` | `OlÃ¡...questÃ£o especÃ­fica` |
| 5251 | `notFoundMessage` | `NÃ£o encontrei o pedido` |
| 5256 | `notFoundMessage` | `NÃ£o encontrei os cÃ³digos` |
| 5699 | `handoffMessage` | `OlÃ¡...questÃ£o` |
| 8293 | `assistantMessage` | `Qual Ã© o seu email` |
| 8300 | `handoffNote` | `TransferÃªncia solicitada` |
| 8550 | `assistantMessage` | `ClassificaÃ§Ã£o nÃ£o executada` |
| 8586 | `assistantMessage` | `ClassificaÃ§Ã£o disponÃ­vel apÃ³s` |
| 8616 | `assistantMessage` | `ClassificaÃ§Ã£o sugerida...nÃ£o aplicada` |
| 8702 | `assistantMessage` | `classificar o ticket...jÃ¡ foi encerrado` |

Além disso, arrays como `FALLBACK_PHRASES` (linhas 740-744) contêm mojibake que afeta a detecção de padrões.

## Plano de correção

### 1. Corrigir TODAS as strings user-facing com mojibake
Substituir cada ocorrência de texto corrompido pelo equivalente UTF-8 correto em todo o arquivo. Exemplos:
- `vocÃª` → `você`
- `Ã"timo` → `Ótimo`
- `OlÃ¡` → `Olá`
- `NÃ£o` → `Não`
- `solicitaÃ§Ã£o` → `solicitação`
- `questÃ£o` → `questão`
- `poderÃ¡` → `poderá`
- `ðŸ¤` → `🤝`
- `âœ…` → `✅`
- `ðŸ"§` → `📧`

### 2. Corrigir arrays de detecção de padrões
- `FALLBACK_PHRASES` (linhas 740-744): strings com mojibake não matcham corretamente
- `noKeywords` regex (linha 2201): padrões com `nÃ£o` não funcionam
- `ambiguityKeywords` (linha 2203): `porÃ©m` não matcha

### 3. Corrigir comentários e console.log
- Menos crítico mas mantém o código legível e consistente

## Arquivo alterado
- `supabase/functions/ai-autopilot-chat/index.ts` — correção em ~100+ linhas espalhadas

## Impacto
- Elimina texto corrompido/feio nas mensagens de WhatsApp
- Corrige detecção de padrões (fallback phrases, keywords) que falhavam silenciosamente
- Zero risco funcional — apenas substituição de texto corrompido por texto correto

