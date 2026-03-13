

# Auditoria Completa — process-chat-flow/index.ts

## Status das 9 Alterações

| # | Alteração | Status | Detalhe |
|---|---|---|---|
| 1 | Destructuring forceXxxExit | ✅ OK | Linha 776 |
| 2 | 5 novas variáveis *IntentMatch | ✅ OK | Linhas 2593-2598 |
| 3 | **5 blocos regex + ai_events** | ❌ FALTANDO | Nenhum pattern de detecção existe |
| 4 | Mapeamento intentData + aliases | ⚠️ BUG | `'suporte'` mapeia para `pedidosIntentMatch` (deveria ser `supportIntentMatch`) |
| 5 | Salvar ai_exit_intent automático | ✅ OK | Linhas 3428-3447 |
| 6 | Condição de saída expandida | ✅ OK | Linha 3449 |
| 7 | Path selection nova hierarquia | ✅ OK | Linhas 3503-3542 |
| 8 | Forbid flags no retorno | ✅ OK | Linhas 3594-3598 |
| 9 | Handoff sem próximo nó | ✅ OK | Linhas 3611-3639 |

## Problemas Encontrados

### Problema 1 — CRÍTICO: Blocos de regex não existem (Alteração 3)
Os 5 blocos de detecção automática por regex (`pedidosActionPattern`, `devolucaoActionPattern`, `saqueActionPattern`, `sistemaActionPattern`, `internacionalActionPattern`) nunca foram inseridos. Isso significa que **auto-detect por texto do usuário não funciona** — os novos intents só são ativados via `intentData` propagado dos webhooks ou `force*Exit` flags, nunca por análise direta da mensagem.

Inserir após linha 3253 (logo após o bloco de consultor), os 5 blocos completos conforme especificado no patch original, cada um com:
- Action pattern regex (detecção forte)
- Ambiguous pattern regex (desambiguação)
- Forbid flag lido do nó (`currentNode.data?.forbid_*`)
- Log de desambiguação
- Atribuição de `*IntentMatch`
- Insert em `ai_events`

### Problema 2 — BUG: Mapeamento `'suporte'` → `pedidosIntentMatch` (Alteração 4, linha 3396)
A linha atual:
```typescript
else if (intent === 'suporte' || intent === 'suporte_pedidos') { pedidosIntentMatch = true; }
```

Deveria ser:
```typescript
else if (intent === 'suporte_pedidos') { pedidosIntentMatch = true; }
else if (intent === 'suporte') { supportIntentMatch = true; }
```

Sem essa correção, qualquer conversa com `intentData.ai_exit_intent = 'suporte'` é roteada para pedidos em vez de suporte humano.

## Plano de Execução

1. Inserir os 5 blocos de regex após linha 3253 (pedidos, devolução, saque, sistema, internacional)
2. Corrigir mapeamento de `'suporte'` na linha 3396 para `supportIntentMatch`
3. Redeploy da edge function

