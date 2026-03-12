

# Fix: Ativar IA no Modo Teste sem fluxo ativo

## Problema

Quando o Modo Teste está ativo mas **não existe um fluxo com estado ativo** (flow completou, ou usuário envia mensagem antes de iniciar um fluxo), o `process-chat-flow` retorna `test_mode_manual_only` com `skipAutoResponse: true`. O webhook interpreta isso como "silenciar tudo" e a mensagem do cliente é ignorada.

Fluxo atual:
```text
Mensagem "sacar" → webhook → process-chat-flow
  → Não tem activeState (fluxo já completou ou não foi iniciado)
  → isTestMode && !manualTrigger → retorna test_mode_manual_only
  → webhook faz continue → SILÊNCIO
```

## Solução

Alterar o comportamento do bloco `test_mode_manual_only` no `process-chat-flow` para permitir que a IA responda normalmente quando o test mode está ativo, bloqueando apenas o **Master Flow e triggers automáticos** (que é o objetivo original).

### Mudança 1: `process-chat-flow/index.ts` (linha ~4560)

Em vez de retornar `skipAutoResponse: true`, retornar `useAI: true` para que o webhook encaminhe para o `ai-autopilot-chat`:

```
// ANTES: Bloqueia TUDO (IA + fluxos)
return { useAI: false, skipAutoResponse: true, reason: 'test_mode_manual_only' }

// DEPOIS: Bloqueia auto-triggers mas permite IA
return { useAI: true, reason: 'test_mode_ai_allowed' }
```

Isso faz com que o webhook continue o fluxo normal e chame `ai-autopilot-chat`, que já tem o bypass de kill switch para test mode.

### Mudança 2: `handle-whatsapp-event/index.ts` (linha ~1199)

Adicionar `isTestMode` à condição de entrada da IA:

```
// ANTES
if (isAIGloballyEnabled && conversationAIMode === 'autopilot')

// DEPOIS  
if ((isAIGloballyEnabled || isTestMode) && conversationAIMode === 'autopilot')
```

Isso garante que mesmo com kill switch ativo, o test mode permite processar.

### Resultado esperado

```text
Mensagem "sacar" → webhook → process-chat-flow
  → Não tem activeState
  → isTestMode && !manualTrigger → retorna useAI: true (bloqueia Master Flow, permite IA)
  → webhook chama ai-autopilot-chat
  → IA responde normalmente (com desambiguação financeira)
```

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/process-chat-flow/index.ts` | Bloco test_mode_manual_only retorna `useAI: true` |
| `supabase/functions/handle-whatsapp-event/index.ts` | Condição de AI inclui `isTestMode` |

