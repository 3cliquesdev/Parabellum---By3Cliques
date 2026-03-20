

## Auditoria Completa — Conversa #8181F702

### Linha do Tempo

| Hora | Evento | Status |
|------|--------|--------|
| 00:29:51 | Cliente "BOA noite" → Menu produtos | ✅ OK |
| 00:30:14 | Cliente "1" (Drop Nacional) → Menu departamentos | ✅ OK |
| 00:30:24 | Cliente "2" (Financeiro) → **"Não encontrei informações"** | ❌ BUG |
| 00:34:24 | Cliente "oi" → Saudação proativa disparou | ✅ OK |
| 00:35:52 | "quero sacar" → Pede dados (Nome, PIX, etc) | ✅ OK |
| 00:36:28 | Dados com "todo saldo da carteira" → **"Não consegui resolver"** | ❌ BUG |
| 00:37:52 | Volta ao menu, escolhe "2" novamente → **"Não encontrei informações"** | ❌ BUG |
| 00:39:43 | "quero sacar" → Pede dados novamente | ✅ OK |
| 00:40:14 | Dados com "Valor: 3.000" → **"Não consegui resolver"** | ❌ BUG |

### Bugs Identificados

**Bug A — skipInitialMessage AINDA não funciona (Bug 3/4 do plano anterior)**
A seleção "2" no menu ainda é tratada como query de KB em vez de disparar saudação proativa. Possível que o deploy das correções no webhook/processor não tenha pego, OU o batching não propagou o flag.

**Bug B — LLM retorna VAZIO em vez de chamar `create_ticket` (BUG NOVO — CRÍTICO)**
Logs mostram a sequência fatal:
1. `callStrictRAG` (sem tools) → GPT-5-mini retorna resposta vazia → handoff forçado
2. flow_context ativo → ignora handoff, cai no "fluxo padrão"
3. LLM principal chamada com tools → também retorna VAZIO (sem tool_calls)
4. Retry com prompt reduzido → também VAZIO

A raiz: `callStrictRAG` roda ANTES do LLM principal e **não tem acesso às tools** (create_ticket). Quando recebe dados estruturados (Nome/PIX/Banco/Valor), não sabe o que fazer → resposta vazia. O "fluxo padrão" subsequente herda o contexto poluído e também falha.

**Bug C — False positive `FLOW_EXIT:comercial` (BUG NOVO — CRÍTICO)**
Após LLM retornar vazio, o FIX C (linha ~7932-7958) testa regex de intent comercial:
```
commercialTerms = /\b(comprar|contratar|assinar|upgrade|plano|preço|valor)\b/i
```
A palavra **"Valor:"** nos dados estruturados do cliente casa com essa regex → `FLOW_EXIT:comercial` → escape node → "Não consegui resolver por aqui."

### Plano de Correção — 3 edições no `ai-autopilot-chat/index.ts`

**Edição 1: Bypass `callStrictRAG` quando OTP verificado + dados estruturados**
Na condição do strict RAG (~linha 4935), adicionar bypass quando `hasRecentOTPVerification` ou quando a mensagem contém padrão de dados estruturados (múltiplas linhas "campo: valor"):
```typescript
const looksLikeStructuredData = /\b(nome|pix|banco|motivo|valor|chave)\s*:/i.test(customerMessage) 
  && customerMessage.split('\n').filter(l => l.includes(':')).length >= 3;

if (isStrictRAGMode && !isOperationalTopic && !isGreetingBypass 
    && !hasRecentOTPVerification && !looksLikeStructuredData  // ← ADICIONAR
    && OPENAI_API_KEY && knowledgeArticles.length > 0) {
```

**Edição 2: Excluir "valor" da regex `commercialTerms` no FIX C**
Na linha ~7936, remover "valor" da regex comercial (é ambíguo demais — aparece em dados financeiros):
```typescript
const commercialTerms = /\b(comprar|contratar|assinar|upgrade|plano|preço)\b/i;
// "valor" REMOVIDO — causa false positive em dados financeiros estruturados
```

**Edição 3: Fallback financeiro quando LLM vazia + OTP verificado**
Na seção pós-retry (~linha 7932), ANTES de testar `commercialTerms`, adicionar guard para dados financeiros com OTP:
```typescript
if (!rawAIContent && !toolCalls.length && flow_context) {
  // GUARD: Se OTP verificado e dados parecem financeiros → NÃO sair do fluxo,
  // tentar criar ticket diretamente via create_ticket hardcoded
  if (hasRecentOTPVerification && looksLikeStructuredData) {
    console.log('[ai-autopilot-chat] 🆘 LLM vazia + OTP verificado + dados estruturados → forçando create_ticket');
    // Extrair campos e chamar create_ticket programaticamente
    // (fallback de último recurso quando LLM falha)
  }
  // ... resto do FIX C
}
```

**Deploy:** `ai-autopilot-chat`

### Resultado Esperado
- Dados financeiros pós-OTP → bypass strict RAG → LLM com tools → `create_ticket` → ticket criado → confirmação
- "Valor: 3.000" não dispara mais `FLOW_EXIT:comercial`
- skipInitialMessage precisa ser re-verificado nos logs do webhook/processor após o deploy anterior

