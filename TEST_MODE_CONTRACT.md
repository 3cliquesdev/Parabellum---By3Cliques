# 🧪 Contrato do Modo Teste — Regras Travadas

> **Status**: ATIVO | **Última atualização**: 2026-02-26
> Este contrato é referência imutável. Qualquer mudança no Modo Teste deve respeitar estas regras.

---

## 1. Ativação (atômica)

- `TestModeDropdown.handleSelectFlow` executa operação **atômica**:
  - `is_test_mode = true`
  - `ai_mode = 'autopilot'`
  - Chama `process-chat-flow` com `manualTrigger: true`
- **Proibido** ativar `is_test_mode` sem resetar `ai_mode` para `autopilot`

## 2. Bypass de proteções

- **Kill Switch** (`ai_global_enabled = false`): Teste bypassa — condição `&& !isTestMode`
- **ai_mode protection** (`waiting_human / copilot / disabled`): Teste bypassa — condição `&& !isTestMode`
- Ambos os bypasses usam a mesma lógica no `process-chat-flow/index.ts`

## 3. Fluxo ativo no teste

- Master Flow e triggers automáticos são **bloqueados** em teste
- Apenas o fluxo selecionado manualmente roda
- **IA responde normalmente** quando não há fluxo ativo (useAI: true, reason: test_mode_ai_allowed)
- Separador visual `"TESTE DE FLUXO INICIADO"` é inserido como mensagem de sistema
- Mensagens de teste têm highlight amarelo (`border-amber-400`)
- Metadata `flow_name` exibida nos bubbles de teste

## 4. ai_response (nó IA persistente)

- Anti-duplicação: janela de 5s para mesmo texto
- `exit_keyword` → limpa `collectedData.__ai`, avança para próximo nó
- `max_interactions` → (opcional) envia `fallback_message` como `sender_type: 'system'`, limpa `__ai`, avança para próximo nó
- **Proibido**: hardcodar `waiting_human` ou completar flow state no `max_interactions`

## 5. Desativação

- Clique no botão amarelo → `is_test_mode = false`
- **Não** reseta `ai_mode` (mantém o estado atual da conversa)

## 6. Reativação

- Pode reativar a **qualquer momento**, independente do `ai_mode` atual
- A ativação atômica (regra 1) reseta tudo automaticamente

---

## Referências de código

| Arquivo | Responsabilidade |
|---|---|
| `src/components/inbox/TestModeDropdown.tsx` | Ativação/desativação atômica |
| `supabase/functions/process-chat-flow/index.ts` | Bypass de Kill Switch e ai_mode |
| `src/hooks/useTestModeToggle.tsx` | Query/mutation do `is_test_mode` |

---

> ⚠️ **Regra de ouro**: Qualquer alteração no fluxo de teste deve ser validada contra este contrato. Se a mudança viola alguma regra, é uma **regressão** e deve ser bloqueada.
