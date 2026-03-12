

# Auditoria: Estado Atual dos 5 Fixes

## Já implementado (mensagem anterior)

| Fix | Status | Evidência |
|---|---|---|
| FIX 1 - `userMessage` → `customerMessage` em webhooks | ✅ Feito | Zero ocorrências em `meta-whatsapp-webhook` e `handle-whatsapp-event` |
| FIX 1 - Validação 400 em `ai-autopilot-chat` | ✅ Feito | L1461-1471 já valida `customerMessage` |
| FIX 2 - Guarantee block em `transition-conversation-state` | ✅ Feito | L161-180 já cria job se ausente |
| FIX 2 - Reconciliação de órfãs em `dispatch-conversations` | ✅ Feito | L64-100 já reconcilia |
| FIX 3 - Queue hygiene em `dispatch-conversations` | ✅ Feito | L102-116 já purga entries mortas |
| FIX 3 - Filtro de status em `route-conversation` | ⚠️ Parcial | L797 filtra apenas `closed`, falta `resolved` e `finished` |
| FIX 4 - Telemetria `ai_decision` (6 pontos) | ✅ Feito | 6 logs estruturados confirmados |
| FIX 5 - `health-check-ai` | ⚠️ Parcial | Existe mas autenticação é fraca (L18-20: verifica `includes` em vez de `===`) |

## Pendências reais (3 itens)

### 1. `userMessage` residual em `ai-autopilot-chat` L3209
A chamada ao `process-chat-flow` ainda usa `userMessage: customerMessage`. Embora o valor seja correto (passa o conteúdo de `customerMessage`), a **chave** deveria ser `customerMessage` para consistência de contrato — **exceto se `process-chat-flow` espera receber `userMessage`**.

**Ação:** Verificar se `process-chat-flow` lê `userMessage` ou `customerMessage` do body. Se lê `userMessage`, manter como está (é o contrato daquela função). Se lê `customerMessage`, renomear.

### 2. Filtro incompleto em `route-conversation` L797
Atualmente: `.neq('conversations.status', 'closed')`
Deveria ser: `.not('conversations.status', 'in', '("closed","resolved","finished")')` para excluir todos os status terminais.

**Ação:** Substituir L797 por filtro completo.

### 3. Autenticação fraca em `health-check-ai` L18-20
O bloco `if (!authHeader || !authHeader.includes(serviceKey!))` não faz nada — o corpo do `if` está vazio (apenas um comentário). Qualquer request passa.

**Ação:** Retornar 401 se autenticação falhar:
```typescript
if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
    status: 401, headers: corsHeaders 
  });
}
```

## Resumo

| Item | Arquivo | Mudança |
|---|---|---|
| 1 | `ai-autopilot-chat/index.ts` L3209 | Verificar contrato de `process-chat-flow` e alinhar chave |
| 2 | `route-conversation/index.ts` L797 | `.neq` → `.not(..., 'in', ...)` com todos status terminais |
| 3 | `health-check-ai/index.ts` L18-20 | Fechar o `if` com return 401 |

3 correções cirúrgicas. Nenhuma refatoração.

