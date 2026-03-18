

# Auditoria V12: Bugs V11 Não Deployados + Regex Gaps

## Estado Atual

**V11 NÃO está em produção.** Evidências:
- Zero eventos `customer_transfer_intent_detected` na tabela `ai_events`
- Zero mensagens contendo "transferir agora" (resposta do Bug 12 fix)
- `ai_total_fallback_count = 0` em TODAS as conversas, inclusive `a48f1943` que teve 8+ fallbacks
- Busca por "BUILD" e "V11" nos logs do edge function retornou vazio

O código V11 existe no repositório mas a edge function `ai-autopilot-chat` não foi re-deployada.

## Dados da Última Hora

| Métrica | Valor |
|---|---|
| ai_response | 119 |
| contract_violation_blocked | 49 (OLD code, pre-V8) |
| ai_transfer | 33 |
| state_transition_handoff_to_human | 31 |
| zero_confidence_cautious | 21 |
| fallback_phrase_detected | 16 |
| anti_loop_max_fallbacks | 5 |

## Bug 16 (NOVO): Regex de Transferência Incompleta

Mesmo quando V11 deployar, o regex `CUSTOMER_TRANSFER_INTENT` tem gaps que causariam falhas:

**Mensagens reais dos clientes que NÃO casam com o regex atual:**
- `"Me conecta com a equipe de suporte"` — regex tem `me\s+conecte` (subjuntivo), cliente usou `conecta` (imperativo)
- `"Equipe de suporte"` — não casa com nenhum padrão
- `"Outra forma"` — resposta à pergunta da IA, não é afirmativo mas demonstra frustração

**Fix necessário:** Expandir regex para cobrir conjugações reais:
```
me\s+conect[ae]    (conecta + conecte)
equipe\s+de\s+suporte
atendimento\s+humano
transfere\s+para
```

## Bug 17 (NOVO): Afirmativo "Sim" Não Detecta com Sufixo

O regex `CUSTOMER_AFFIRM_TRANSFER` exige `^(sim|quero...)[\s!.,]*$` — mas "Sim quero" é uma string de 2 palavras. O regex trata `sim` e `quero` como alternativas, não sequência. "Sim quero" NÃO casa com `^sim[\s!.,]*$` nem com `^quero[\s!.,]*$`.

**Fix:** Já está na lista (`sim\s+quero`), porém "Sim, quero" com vírgula não casa. Adicionar variantes com pontuação.

## Bug 18 (MODERADO): `contract_violation_blocked` Ainda Ativo (49 eventos)

Os 49 eventos de `contract_violation_blocked` na última hora confirmam que o código OLD (pré-V8) **ainda está rodando em produção**. Os fixes V8 (self-blocking loop), V10 (greeting skip, dedup) e V11 (transfer intent, global counter) — NENHUM está ativo.

## Bug 19 (CRITICO): Greeting Enviado Após "Sim quero" (Bug 14 Falhou)

Conversa `a48f1943` às 13:31-13:32:
1. IA: "Quer que eu te conecte com a equipe?" (13:31:10)
2. Cliente: "Sim quero" (13:31:29)
3. IA: **"Olá! Sou Helper Financeiro..."** (13:32:08) ← GREETING pós-transferência pedida
4. IA: "Não consegui resolver" (13:32:19) ← FALLBACK

A transição de nó ativou um greeting 39s depois, ignorando a intenção de transferência. O Bug 14 fix (suprimir greeting com 2+ msgs IA em 60s) deveria cobrir isso, mas não está deployado.

---

## Plano de Correção

### 1. Deploy Forçado (Prioridade Máxima)
Re-deployar `ai-autopilot-chat` para ativar TODOS os fixes V8-V11 que estão no código mas não em produção.

### 2. Bug 16 — Expandir regex de transferência
Antes do deploy, corrigir o regex `CUSTOMER_TRANSFER_INTENT` para cobrir conjugações reais:
```typescript
const CUSTOMER_TRANSFER_INTENT = /\b(me\s+transfer[ea]|transfer[ea]\s+pra|me\s+conect[ae]|falar\s+com\s+(atendente|humano|pessoa|algu[eé]m|suporte|equipe)|quero\s+(um\s+)?(atendente|humano)|passa\s+pra\s+(um\s+)?(atendente|humano)|chama\s+(um\s+)?(atendente|humano)|equipe\s+de\s+suporte|atendimento\s+humano)\b/i;
```

### 3. Bug 17 — Expandir regex afirmativo
```typescript
const CUSTOMER_AFFIRM_TRANSFER = /^(sim|quero|pode|por\s+favor|pode\s+ser|claro|ok|quero\s+sim|sim\s+quero|sim[,.]?\s+quero|sim[,.]?\s+por\s+favor|sim[,.]?\s+pode)[\s!.,]*$/i;
```

### 4. Validação Pós-Deploy
Monitorar por 10 min:
- `contract_violation_blocked` deve ir para ZERO
- `customer_transfer_intent_detected` deve aparecer
- `ai_total_fallback_count` deve incrementar em conversas com fallback

