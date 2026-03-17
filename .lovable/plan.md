

# Fase 3 — Correção Massiva de Encoding (Abordagem Segura)

## Diagnóstico atual
O mojibake persiste em todo o arquivo (10.070 linhas). A tentativa anterior com `line_replace` teve apenas ~50% de sucesso porque os bytes corrompidos não são detectados de forma confiável pelo mecanismo de busca textual.

## Problema técnico
Os caracteres corrompidos (`ðŸ†•`, `Ã§Ã£o`, `âœ…`, etc.) existem como sequências de bytes raw no arquivo. O tooling de search/replace não faz match consistente nessas sequências, causando falhas silenciosas.

## Estratégia: Reescrita bloco-a-bloco com verificação manual

Dividir em **5 fases sequenciais**, cada uma reescrevendo ~2.000 linhas:

| Fase | Linhas | Conteúdo principal |
|------|--------|--------------------|
| 3.1 | 1–2000 | Config, helpers, scoring, WhatsApp |
| 3.2 | 2001–4000 | Intent detection, OTP, flow context |
| 3.3 | 4001–6000 | Strict RAG, prompt building, API call |
| 3.4 | 6001–8000 | Tool calls, ticket creation |
| 3.5 | 8001–10070 | Post-processing, fallback, handoff, guards |

### Processo por fase:
1. Ler o bloco inteiro (2000 linhas)
2. Reescrever com encoding corrigido via `code--write` com preservação das seções não-tocadas
3. Verificar que nenhuma linha de lógica foi alterada (apenas strings, comments, logs)

### Após todas as 5 fases:
- Deploy da edge function `ai-autopilot-chat`
- Verificar logs para confirmar startup sem erros
- Buscar mojibake residual

## Risco
- **Zero lógica alterada** — apenas substituição de bytes em strings literais/comentários
- **Rollback instantâneo** via histórico de versão se qualquer fase quebrar
- Cada fase é independente — se uma falhar, paramos e revertemos só aquela

