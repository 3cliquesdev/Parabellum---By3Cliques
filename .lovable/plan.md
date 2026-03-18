

# Auditoria V10: Bugs Residuais Pós-V8/V9

## Status dos Fixes V8 em Produção

| Fix V8 | Status |
|---|---|
| Bug 1: Self-blocking loop (`contract_violation_blocked`) | **✅ CORRIGIDO** — 0 eventos nos últimos 30 min |
| Bug 2: Greeting double-send | **❌ PARCIALMENTE** — causa raiz diferente encontrada |
| Bug 3: `{{conversation_queue}}` vazando | ✅ Corrigido |
| Bug 4: Detecção financeira ampla | ✅ Corrigido (refinado) |
| Bug 5: KB artigos sandbox irrelevantes | ✅ Sandbox excluído |
| Bug 6: Typo persona | ✅ Corrigido |

---

## Novos Bugs Encontrados (Ativos Agora)

### BUG 7 (CRITICO): Greeting Proativo + Fallback — Causa Raiz Real

**Evidência:** Em TODAS as conversas recentes, a saudação é seguida por "Não encontrei informações..." dentro de 10-14 segundos:
- Conv `5442c10d`: Greeting 13:17:21 → Fallback 13:17:32
- Conv `78209738`: Greeting 13:12:19 → Fallback 13:12:33
- Conv `b618f455`: Greeting 13:07:39 → Fallback 13:07:52
- Conv `accf0858`: Greeting 13:05:31 → Fallback 13:05:41

**Causa raiz:** Quando `isProactiveGreeting=true`, o customerMessage é substituído por `[SYSTEM: O cliente acabou de chegar...]` (L1494). Após enviar a saudação, o código testa se deve pular a LLM (L7441-7442):
```
if (isGreetingOnly || isMenuNoise) skipLLMForGreeting = true;
```
Mas `[SYSTEM: O cliente acabou de chegar...]` NÃO casa com `isGreetingOnly` (regex de saudações) nem com `isMenuNoise` (dígito curto). Resultado: `skipLLMForGreeting = false` → LLM é chamada → retorna vazio → fallback enviado.

**Fix:** Adicionar `|| isProactiveGreeting` na condição L7442:
```typescript
if (isGreetingOnly || isMenuNoise || isProactiveGreeting) {
  skipLLMForGreeting = true;
}
```

---

### BUG 8 (CRITICO): Dígitos de Menu Pós-Greeting Causam Loop de Fallback

**Evidência:** Os `zero_confidence_cautious` events revelam que as mensagens do cliente são majoritariamente dígitos ("1", "3", "6"):
- "1" → zero_confidence → fallback
- "3" → zero_confidence → fallback
- "6" → zero_confidence → fallback

**Causa raiz:** Após o greeting ser enviado, `alreadySentGreeting=true`. O bloco de greeting (L7359) é pulado inteiramente, incluindo toda a lógica de `skipLLMForGreeting`. O dígito "1" vai direto para a LLM, que não sabe interpretá-lo → retorna vazio → fallback → anti_loop → handoff forçado.

**Fix:** Após o bloco de greeting (L7448), adicionar verificação independente:
```typescript
// Se o greeting já foi enviado e o cliente mandou apenas um dígito de menu,
// responder contextualizadamente em vez de chamar LLM
if (alreadySentGreeting && isMenuNoise && !skipLLMForGreeting) {
  skipLLMForGreeting = true;
  // Enviar mensagem contextual
  assistantMessage = 'Pode me contar com mais detalhes o que você precisa? Estou aqui para ajudar!';
  // ... salvar e enviar, retornar
}
```

---

### BUG 9 (MODERADO): Race Condition — Saudação/Fallback Duplicados

**Evidência em conv `68a340b9`:**
- 13:01:18.973 — "Olá! Sou Ana Júlia, CS..."
- 13:01:19.347 — "Olá! Sou Ana Júlia, CS..." (0.3s depois, DUPLICADO)
- 13:01:35.609 — "Entendi! Poderia me dar mais detalhes..."
- 13:01:36.642 — "Entendi! Poderia me dar mais detalhes..." (1s depois, DUPLICADO)

**Causa raiz:** O webhook invoca `ai-autopilot-chat` duas vezes simultaneamente para mensagens batched. A flag `greeting_sent_node_` não é persistida rápido o suficiente para bloquear a segunda invocação.

**Fix:** Adicionar dedup check no início da função: antes de enviar QUALQUER mensagem IA, verificar se já existe uma mensagem `is_ai_generated=true` nos últimos 5 segundos para a mesma conversa. Se sim, skip.

---

### BUG 10 (DADOS): Persona "Helper Sistema" com role "elper Sistema"

**Evidência:** `SELECT name, role FROM ai_personas` retorna:
- name: "Helper Sistema", role: "elper Sistema" (falta o 'H')

Resultado na saudação: "Olá! Sou Helper Sistema, elper Sistema do Drop Nacional."

**Fix:** Migration para corrigir:
```sql
UPDATE ai_personas SET role = 'Helper Sistema' WHERE id = '49810ef3-e824-4cf4-8996-15362521e6b3';
```

---

### BUG 11 (MENOR): KB retornando 0 artigos para perguntas reais

**Evidência:** "Minha senha não que entra" → 0 artigos. O threshold 0.55 pode estar filtrando resultados marginalmente relevantes. Com 219 artigos manuais ativos, há cobertura limitada mas deveria haver ALGO para problemas comuns.

**Avaliação:** O threshold 0.55 é correto para filtrar lixo. O problema real é cobertura de KB insuficiente — não há artigos sobre "acesso/senha". Não requer mudança de código, mas sim enriquecimento da base de conhecimento.

---

## Resumo de Impacto

| # | Severidade | Bug | Impacto |
|---|---|---|---|
| 7 | CRITICO | isProactiveGreeting não pula LLM → double-send | Toda nova conversa recebe greeting + fallback |
| 8 | CRITICO | Dígitos de menu pós-greeting → loop fallback | 50%+ dos zero_confidence vêm de dígitos |
| 9 | MODERADO | Race condition → mensagens duplicadas | Mensagens duplicadas em conversas batched |
| 10 | DADOS | Persona role "elper Sistema" | Saudação com texto quebrado |
| 11 | MENOR | KB sem cobertura para temas comuns | Artigos=0, depende de enriquecimento manual |

## Plano de Correções

1. **Bug 7:** L7442 — adicionar `|| isProactiveGreeting` ao skip condition
2. **Bug 8:** Após L7448 — adicionar guard para dígitos de menu quando greeting já foi enviado, respondendo contextualmente sem LLM
3. **Bug 9:** Adicionar dedup check antes de salvar mensagem IA (verificar se msg idêntica nos últimos 5s)
4. **Bug 10:** Migration SQL para corrigir role da persona
5. **Bug 11:** Sem correção de código — recomendação de enriquecer KB

