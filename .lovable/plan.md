

# Diagnóstico: IA no fluxo não responde → conversa cai no Suporte

## Bug encontrado

**Linha 1148 do `meta-whatsapp-webhook/index.ts`:**

```typescript
if (conversation.ai_mode === "autopilot" && !conversation.awaiting_rating) {
```

O webhook verifica `conversation.ai_mode` usando o objeto **stale** (carregado no início do request). Porém, o `process-chat-flow` acabou de restaurar `ai_mode` para `autopilot` via soberania do fluxo (linhas 699-704). O webhook não sabe dessa atualização → a verificação falha → **IA nunca é chamada**.

### Fluxo do bug (passo a passo):

```text
1. Conversa com ai_mode='waiting_human' (dispatch falhou anteriormente)
2. Contato envia mensagem
3. Webhook carrega conversation → ai_mode='waiting_human' (stale)
4. Webhook chama process-chat-flow
5. process-chat-flow vê fluxo ativo → SOBERANIA → restaura ai_mode='autopilot' no DB
6. process-chat-flow retorna { useAI: true, aiNodeActive: true }
7. Webhook verifica conversation.ai_mode === 'autopilot' → FALSE (stale = 'waiting_human')
8. IA NÃO É CHAMADA → cai no fallback → conversa fica presa
9. Cleanup cron mata o fluxo após 15min → conversa vira 'transferred' → fila de suporte
```

### Prova na conversa #1CBA9A9B:
- Flow state: `current_node_id: ia_entrada` (ai_response), `status: transferred`, `completed_at: 13:39`
- `updated_at: 13:22:59` — nunca mais foi atualizado (nenhuma interação AI aconteceu)
- Mensagens do contato entre 13:22-13:44 foram todas ignoradas pela IA
- Só recebeu mensagens de "fila de atendimento" (anti-spam)

## Solução

**Arquivo:** `supabase/functions/meta-whatsapp-webhook/index.ts`

Na verificação do CASO 3 (linha 1148), usar a informação retornada pelo `process-chat-flow` em vez do objeto stale:

```typescript
// ANTES (BUG):
if (conversation.ai_mode === "autopilot" && !conversation.awaiting_rating) {

// DEPOIS (FIX):
// Se process-chat-flow retornou aiNodeActive=true, a soberania do fluxo
// já restaurou ai_mode para autopilot no DB. Confiar no fluxo.
const effectiveAiMode = (flowData.useAI && flowData.aiNodeActive) 
  ? "autopilot" 
  : conversation.ai_mode;
if (effectiveAiMode === "autopilot" && !conversation.awaiting_rating) {
```

Isso garante que quando `process-chat-flow` retorna `aiNodeActive: true`, o webhook confia na decisão do motor de fluxo e chama a IA independentemente do valor stale de `ai_mode`.

### Arquivos alterados
- `supabase/functions/meta-whatsapp-webhook/index.ts` — fix stale ai_mode check no CASO 3

