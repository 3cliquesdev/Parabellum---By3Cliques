

# Fix: Envio de Template — Auto-Atribuição + Atualização Instantânea

## Problemas Identificados

1. **`ai_mode: "waiting_human"` errado** — Ambos os diálogos (`ReengageTemplateDialog` e `PipelineTemplateDialog`) definem `ai_mode: "waiting_human"` ao enviar template, mesmo já atribuindo `assigned_to: user.id`. Isso faz o banner "Assumir" aparecer desnecessariamente, pois `waiting_human` sinaliza "sem agente presente".

2. **Cache stale** — Após envio do template, os hooks `useAIMode`, `my-inbox-items` e `my-not-responded-inbox` não são invalidados, exigindo refresh manual da página.

## Correções

### 1. `ReengageTemplateDialog.tsx` — Linha 118
Trocar `ai_mode: "waiting_human"` por `ai_mode: "copilot"`.

O agente já está presente e atribuído — modo correto é `copilot`.

### 2. `ReengageTemplateDialog.tsx` — onSuccess (após linha 154)
Adicionar invalidações:
```typescript
queryClient.invalidateQueries({ queryKey: ["ai-mode", conversation.id] });
queryClient.invalidateQueries({ queryKey: ["my-inbox-items"] });
queryClient.invalidateQueries({ queryKey: ["my-not-responded-inbox"] });
```

### 3. `PipelineTemplateDialog.tsx` — Linha 98
Trocar `ai_mode: "waiting_human"` por `ai_mode: "copilot"`.

### 4. `PipelineTemplateDialog.tsx` — onSuccess (após linha 163)
Adicionar invalidações:
```typescript
queryClient.invalidateQueries({ queryKey: ["ai-mode"] });
queryClient.invalidateQueries({ queryKey: ["my-inbox-items"] });
queryClient.invalidateQueries({ queryKey: ["my-not-responded-inbox"] });
```

## Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `src/components/inbox/ReengageTemplateDialog.tsx` | `copilot` + invalidações de cache |
| `src/components/pipeline/PipelineTemplateDialog.tsx` | `copilot` + invalidações de cache |

## Resultado

Após enviar template: conversa fica em modo `copilot` com agente atribuído. UI atualiza instantaneamente sem refresh. Banner "Assumir" não aparece. Conversa aparece em "Minhas" imediatamente.

