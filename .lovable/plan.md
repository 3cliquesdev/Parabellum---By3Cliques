

# Auditoria: Encoding corrompido em todo o `ai-autopilot-chat`

## Problema encontrado

O arquivo `supabase/functions/ai-autopilot-chat/index.ts` (9812 linhas) tem **2620 ocorrências** de caracteres UTF-8 corrompidos (mojibake). Isso afeta:

- **94 mensagens enviadas ao cliente** (strings `assistantMessage = '...'`) — ex: `"solicitaÃ§Ã£o"` em vez de `"solicitação"`
- **Console logs** (cosmético, mas dificulta debugging)
- **Comentários** (cosmético)
- **Regex de detecção de intenção** — ex: `desinscriÃ§Ã£o` nunca vai dar match contra `"desinscrição"` real

## Causa raiz

O arquivo foi salvo em algum momento com encoding Latin-1/ISO-8859-1, mas os bytes são UTF-8. Isso gera o padrão clássico de mojibake:

```text
ã → Ã£    é → Ã©    ç → Ã§    õ → Ãµ
á → Ã¡    í → Ã­    ó → Ã³    ú → Ãº
â → Ã¢    ê → Ãª    ô → Ã´    ñ → Ã±
✅ → âœ…   ❌ → âŒ   ⚠️ → âš ï¸   🔧 → ðŸ"§
```

## Impacto em produção

- Quando a IA retorna resposta vazia e um fallback hardcoded é usado (linhas 7212-7216), o cliente vê caracteres corrompidos
- Mensagens de OTP, verificação de email, handoff — **todas** têm strings corrompidas
- Regex de detecção de intenção (`desinscriÃ§Ã£o`, `cobranÃ§a`, etc.) **nunca fazem match** porque o texto real do cliente vem em UTF-8 correto

## Plano de correção

### Abordagem: substituição sistemática de mojibake

Aplicar substituições em todo o arquivo `ai-autopilot-chat/index.ts`, corrigindo os padrões de mojibake para UTF-8 correto. As substituições principais:

| Mojibake | Correto |
|----------|---------|
| `Ã§Ã£o` | `ção` |
| `Ã£o` | `ão` |
| `Ãµes` | `ões` |
| `Ã©` | `é` |
| `Ã­` | `í` |
| `Ã¡` | `á` |
| `Ãº` | `ú` |
| `Ã§` | `ç` |
| `Ã³` | `ó` |
| `Ã¢` | `â` |
| `Ãª` | `ê` |
| `Ã´` | `ô` |
| `âœ…` | `✅` |
| `âŒ` | `❌` |
| `âš ï¸` | `⚠️` |
| `ðŸ"` + variantes | emojis corretos |

### Execução

Como o arquivo tem 9812 linhas, a correção será feita em blocos focando nas seções mais críticas:

1. **Prioridade 1**: Todas as strings `assistantMessage = '...'` com mojibake (94 ocorrências) — texto que o cliente vê
2. **Prioridade 2**: Regex de detecção de intenção (linhas 370-407) — afeta roteamento
3. **Prioridade 3**: Logs e comentários — cosmético mas importante para debugging

### Resultado esperado

- Mensagens de fallback exibidas corretamente ao cliente
- Regex de intenção funcionando para palavras acentuadas
- Logs legíveis para debugging

