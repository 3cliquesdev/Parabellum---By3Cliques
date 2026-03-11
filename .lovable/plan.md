

# Auditoria: Distribuição da IA para o Próximo Nó — Bugs Encontrados

## Resumo

Após analisar `process-chat-flow/index.ts` (~3922 linhas) e `meta-whatsapp-webhook/index.ts` (~2098 linhas), identifiquei **3 bugs reais** e **2 riscos de inconsistência** no pipeline de transição AI → próximo nó.

---

## Bug 1: Retry do `forceAIExit` usa `skip_db_save: true` + `sender_type: system` (inconsistência com primeira tentativa)

**Arquivo:** `meta-whatsapp-webhook/index.ts`, linhas ~1940-1944

Na primeira tentativa de `forceAIExit` (linha 1825), a mensagem é enviada corretamente:
```
skip_db_save: false, is_bot_message: true
```

Mas no **retry** (linha 1941-1944):
```
skip_db_save: true  ← salva manualmente como sender_type: "system"
```

**Impacto:** Mensagens do retry aparecem como `system` em vez de `user` (bolha do bot), quebrando a renderização no inbox. Além disso, `formatOptionsAsText` não é aplicado no retry, então opções de `ask_options` são perdidas.

**Correção:** Alinhar retry com a primeira tentativa: `skip_db_save: false`, `is_bot_message: true`, e aplicar `formatOptionsAsText`.

---

## Bug 2: `flowExit/contractViolation` handler ignora `preferred` transfer type

**Arquivo:** `meta-whatsapp-webhook/index.ts`, linhas 1672-1720

No CASO 2 (resposta estática), o handler de transfer tem lógica completa para `transferType === 'preferred'` (linhas 970-1015) com cadeia preferred_agent → preferred_dept → org_default_dept.

Porém, no handler de `flowExit/contractViolation` (linhas 1672-1700), a lógica de transfer **não verifica** `transferType === 'preferred'`. Usa apenas a lógica de `consultant_id` genérica.

**Impacto:** Quando a IA sai do nó via `flowExit` ou `contractViolation` e o próximo nó é um transfer do tipo `preferred`, o contato é roteado para o pool genérico em vez do atendente/departamento preferido.

**Correção:** Extrair a lógica de transfer do CASO 2 para uma função reutilizável e aplicar em todos os handlers (financialBlocked, commercialBlocked, flowExit, forceAIExit, flow_advance_needed).

---

## Bug 3: `forceAIExit` no `process-chat-flow` não propaga `flow_context` na resposta

**Arquivo:** `process-chat-flow/index.ts`, linhas 2888-2926

Quando `forceAIExit` avança para um nó `ai_response` (novo nó de IA após o anterior), o motor retorna `useAI: true, aiNodeActive: true`, mas o **webhook que recebeu a re-invocação** (linhas 1806-1915) não trata esse cenário. Ele espera `transfer: true` ou uma `response` estática, mas recebe `aiNodeActive: true`.

**Impacto:** Se o fluxo é: `IA_node_1 → IA_node_2`, quando a IA faz exit do node 1, o motor retorna `aiNodeActive: true` para o node 2, mas o webhook não chama a IA novamente — ele simplesmente faz `continue` sem ação. O contato não recebe resposta e fica preso.

**Correção:** No handler de `flow_advance_needed` / `forceAIExit` no webhook (após re-invocar `process-chat-flow`), adicionar tratamento para quando o resultado retorna `aiNodeActive: true`: chamar `ai-autopilot-chat` diretamente com o novo `flow_context`.

---

## Risco 1: Duplicação massiva de lógica de transfer

A lógica de transfer (consultor, preferred, route-conversation) está **copiada e colada** em pelo menos 6 locais diferentes no webhook:
- CASO 2 (linhas 940-1135)
- financialBlocked handler (linhas 1289-1360)
- commercialBlocked handler (linhas 1494-1550)
- flowExit/contractViolation handler (linhas 1672-1720)
- forceAIExit / flow_advance_needed handler (linhas 1843-1912)
- Retry de cada um dos acima

Cada cópia tem variações sutis (ex: preferred só no CASO 2, `formatOptionsAsText` ausente em alguns retries). Isso é a raiz dos bugs 1 e 2.

**Recomendação:** Extrair para uma função `handleFlowTransfer(supabase, conversation, contact, flowResult, instance, fromNumber)` e reutilizar.

---

## Risco 2: Mensagem de fallback do `ai_response` salva como `channel: 'web_chat'`

**Arquivo:** `process-chat-flow/index.ts`, linhas 2225-2233

Quando `maxReached` ou `aiExitForced`, o `fallback_message` é inserido com `channel: 'web_chat'` hardcoded, ignorando o canal real da conversa (que pode ser `whatsapp`).

**Impacto:** Mensagens de fallback ficam com canal errado no banco, potencialmente afetando filtros e relatórios.

---

## Plano de Correção

### Arquivo: `supabase/functions/meta-whatsapp-webhook/index.ts`

1. **Extrair função `executeFlowTransfer`** — Centralizar lógica de transfer (consultor, preferred, route-conversation, dispatch) em uma única função reutilizável
2. **Aplicar em todos os handlers** — CASO 2, financialBlocked, commercialBlocked, flowExit, forceAIExit
3. **Corrigir retry** — Alinhar com primeira tentativa (`skip_db_save: false`, `is_bot_message: true`, `formatOptionsAsText`)
4. **Tratar `aiNodeActive` no re-invoke** — Quando `process-chat-flow` retorna `aiNodeActive: true` após forceAIExit, chamar IA com novo contexto

### Arquivo: `supabase/functions/process-chat-flow/index.ts`

5. **Corrigir `channel` do fallback_message** — Usar canal da conversa em vez de `'web_chat'` hardcoded

