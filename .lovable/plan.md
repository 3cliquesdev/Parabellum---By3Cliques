

# Auditoria V11: Bugs Residuais em Lógica Legada

## Estado Atual Pós-V10

Os fixes V8-V10 resolveram o self-blocking loop (0 violations pós-deploy) e o greeting proativo duplicado (isProactiveGreeting skip funciona). Porém **4 bugs de lógica legada** permanecem ativos e causam degradação severa da experiência.

## Dados das Últimas 2 Horas

| Metrica | Valor |
|---|---|
| ai_response | 117 |
| contract_violation_blocked (OLD code, parou ~13:03) | 56 |
| zero_confidence_cautious | 18 |
| fallback_phrase_detected | 16 |
| anti_loop_max_fallbacks | 5 |
| Conversas com 3+ fallbacks seguidos | 4 |
| Conversas com 6 fallbacks seguidos | 1 |

---

## BUG 12 (CRITICO): Cliente Aceita Transferência e IA Ignora

**Evidência direta (conv `a48f1943`):**
```
IA: "Quer que eu te conecte com a equipe de suporte?"
Cliente: "Sim quero"
IA: [greeting do nó financeiro] → [fallback] → [fallback]
Cliente: "Sim"
IA: "Não consegui resolver por aqui."
Cliente: "Me transfere para o atendimento"
IA: "Não encontrei informações..." (FALLBACK NOVAMENTE)
```

**Causa raiz:** Quando a IA envia "Quer que eu te conecte com a equipe?", não existe handler para respostas afirmativas ("sim", "quero", "pode ser"). O "Sim" vai para a LLM que retorna vazio, gerando outro fallback. O mesmo acontece com "Me transfere para o atendimento" — a LLM não processa e o escape check está desativado para `isSystemGeneratedMessage`.

**Fix:** Adicionar detecção PRÉ-LLM de intenção de transferência do cliente. Antes de chamar a LLM (~L7509), verificar se o `customerMessage` contém pedido explícito de transferência:
```typescript
const CUSTOMER_TRANSFER_INTENT = /\b(me\s+transfere|transfere\s+pra|me\s+conecte|falar\s+com\s+(atendente|humano|pessoa|alguém)|quero\s+(um\s+)?(atendente|humano)|passa\s+pra\s+(um\s+)?(atendente|humano))\b/i;
const CUSTOMER_AFFIRM_TRANSFER = /^(sim|quero|pode|por\s+favor|pode\s+ser|claro|ok|quero\s+sim|sim\s+quero)[\s!.,]*$/i;
```
Se detectar + existir fallback recente na conversa → executar flowExit com handoff imediato.

---

## BUG 13 (CRITICO): Contador Anti-Loop Reseta Entre Nós

**Evidência (conv `f6490f7e`):** 6 fallbacks em 17 minutos:
- Nó financeiro: 2 fallbacks → anti-loop → flowExit → novo nó
- Novo nó: 2 fallbacks → anti-loop → flowExit → novo nó  
- Novo nó: 2 fallbacks → anti-loop → flowExit

O `ai_node_fallback_count` reseta a cada transição de nó (L9170: `if (aiNodeId !== flow_context.node_id)`). O cliente fica em loop infinito de 2 fallbacks + troca de nó.

**Fix:** Adicionar um contador GLOBAL `ai_total_fallback_count` no `customer_metadata` que NUNCA reseta entre nós. Threshold: >= 4 fallbacks totais na conversa → handoff obrigatório independente do nó.

---

## BUG 14 (MODERADO): Greeting Enviado DEPOIS de Fallback

**Evidência (conv `a48f1943`):**
- 13:31:10 — Fallback "Não encontrei..."
- 13:32:08 — Greeting "Olá! Sou Helper Financeiro..."

O greeting chega 58s DEPOIS do fallback porque a transição de nó ativou um novo AI node com proactive greeting. O dedup de 5s (V10 Bug 9) não pega porque o gap é > 5s.

**Fix:** No bloco de greeting (L7388), além do dedup de 5s, verificar se já existe alguma mensagem de fallback nos últimos 60s. Se sim, pular o greeting (o contexto já foi quebrado).

---

## BUG 15 (MENOR): OLD Code Executou por ~30min Pós-Deploy

As 55 violations com texto antigo ("Posso transferir") pararam às 13:03, confirmando lag de cache no edge runtime. Já resolvido — mas recomendação de adicionar um `BUILD_TIMESTAMP` no log de boot para confirmar versão em produção.

---

## Plano de Correções

### 1. Bug 12 — Detecção de intenção de transferência do cliente (PRÉ-LLM)
- **Onde:** `ai-autopilot-chat/index.ts`, antes de `callAIWithFallback` (~L7509)
- **O que:** Regex para detectar pedidos explícitos de transferência e respostas afirmativas ("sim") após fallback. Se detectar → retornar `flowExit` com handoff imediato sem chamar LLM.

### 2. Bug 13 — Contador global anti-loop
- **Onde:** `ai-autopilot-chat/index.ts`, junto ao anti-loop existente (L9162)
- **O que:** Adicionar `ai_total_fallback_count` que incrementa a cada fallback independente do nó. Threshold de 4 total → handoff obrigatório.

### 3. Bug 14 — Greeting pós-fallback suprimido
- **Onde:** `ai-autopilot-chat/index.ts`, bloco de greeting (L7388)
- **O que:** Verificar se há mensagem de fallback nos últimos 60s antes de enviar greeting. Se sim, skip greeting e ir direto para LLM.

### 4. Bug 15 — Build timestamp no log
- **Onde:** `ai-autopilot-chat/index.ts`, topo do serve handler
- **O que:** Adicionar `console.log('[BUILD] V11 — ' + new Date().toISOString())` para rastreabilidade de versão.

