

# Auditoria V9: Deploy Não Propagou — Bugs V8 Ainda Ativos em Produção

## Descoberta Principal

**Os 6 fixes do V8 NÃO estão rodando em produção.** O código no repositório está correto, mas a versão deployada ainda executa a lógica antiga.

**Evidência concreta:**
- 68 `contract_violation_blocked` nas últimas 2h, TODOS com o texto ANTIGO: "Posso transferir você para um atendente especializado"
- O fix V8 mudou essa frase para: "Quer que eu te conecte com a equipe de suporte"
- Se o deploy tivesse propagado, o texto antigo não apareceria mais

## Dados das Últimas 2 Horas

| Metrica | Valor |
|---|---|
| contract_violation_blocked | 68 |
| zero_confidence_cautious | 18 |
| fallback_phrase_detected | 14 |
| anti_loop_max_fallbacks | 5 |
| Conversas com 3+ fallbacks genéricos | 15 |
| "Não consegui resolver" enviados | 11+ |
| Último violation com texto antigo | 13:03 UTC |

## Status dos 6 Fixes V8 no Código vs Produção

| Fix | Código | Produção |
|---|---|---|
| Bug 1: Frase fallback reescrita (L7555) | ✅ | ❌ Texto antigo rodando |
| Bug 2: isSystemGeneratedMessage guard (L9541) | ✅ | ❌ Greeting ainda bloqueado |
| Bug 3: replaceVariables limpa {{vars}} (L541) | ✅ | ❌ (process-chat-flow) |
| Bug 4: FINANCIAL_BARRIER refinado (L754) | ✅ | ❌ |
| Bug 5: sandbox_training excluído (L4613) | ✅ | ❌ |
| Bug 6: Typo persona (migration) | ✅ | ✅ (migration executou) |

## Plano de Correção

1. **Re-deploy `ai-autopilot-chat`** — forçar deploy da versão atual do código
2. **Re-deploy `process-chat-flow`** — forçar deploy da versão com fix de variáveis
3. **Validar pós-deploy** — monitorar `contract_violation_blocked` por 10 min para confirmar que o texto antigo parou de aparecer

Nenhuma alteração de código é necessária — apenas o redeploy das 2 edge functions.

