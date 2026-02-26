

# Plano: Modo Teste bloqueado por ai_mode=waiting_human (regressão)

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Diagnóstico

Na conversa `#7D091C1D`, após o fluxo anterior atingir `max_interactions` e o fix avançar para o próximo nó, a conversa ficou com `ai_mode = waiting_human`. Quando você tenta ativar o Modo Teste novamente:

1. `TestModeDropdown` seta `is_test_mode = true` e chama `process-chat-flow` com `manualTrigger: true`
2. `process-chat-flow` chega na **linha 371** — proteção de `ai_mode`
3. Como `ai_mode = waiting_human`, retorna `PROTEÇÃO: ai_mode=waiting_human - NÃO processar` **antes** de chegar no handler de `manualTrigger` (linha 447)
4. O bypass de `isTestMode` só existe para o Kill Switch (linha 339), **não** para a proteção de `ai_mode`

Os logs confirmam: `🛡️ PROTEÇÃO: ai_mode=waiting_human - NÃO processar fluxo/IA` aparece repetidamente.

## Solução

Duas mudanças coordenadas:

### Mudança 1: `process-chat-flow/index.ts` — linha 371

Adicionar `isTestMode` como bypass na proteção de `ai_mode`, igual já existe no Kill Switch:

```typescript
// ANTES (linha 371):
if (currentAiMode === 'waiting_human' || currentAiMode === 'copilot' || currentAiMode === 'disabled') {

// DEPOIS:
if ((currentAiMode === 'waiting_human' || currentAiMode === 'copilot' || currentAiMode === 'disabled') && !isTestMode) {
```

E adicionar log quando test mode bypassa:

```typescript
if (isTestMode && (currentAiMode === 'waiting_human' || currentAiMode === 'copilot' || currentAiMode === 'disabled')) {
  console.log(`[process-chat-flow] 🧪 TEST MODE: Bypassing ai_mode=${currentAiMode} protection`);
}
```

### Mudança 2: `TestModeDropdown.tsx` — `handleSelectFlow`

Ao ativar teste, resetar `ai_mode` para `autopilot` junto com `is_test_mode: true`:

```typescript
// ANTES:
.update({ is_test_mode: true })

// DEPOIS:
.update({ is_test_mode: true, ai_mode: 'autopilot' })
```

Isso garante que mesmo que o bypass do `process-chat-flow` falhe, a conversa volta ao estado correto para aceitar fluxos.

## Arquivos e linhas

| Arquivo | Linhas | Mudança |
|---|---|---|
| `supabase/functions/process-chat-flow/index.ts` | 371 | Adicionar `&& !isTestMode` na proteção de ai_mode |
| `src/components/inbox/TestModeDropdown.tsx` | 67 | Resetar `ai_mode: 'autopilot'` ao ativar teste |

## Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — proteção de ai_mode continua funcionando para conversas normais (não teste) |
| Upgrade | Sim — teste pode ser reativado em qualquer estado da conversa |
| Kill Switch | Não afetado — bypass de Kill Switch já existia separadamente |
| Segurança | Sim — apenas `is_test_mode=true` permite bypass; operação atômica no frontend |

