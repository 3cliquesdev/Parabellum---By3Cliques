

# Fix: Filtro "Todas da IA" incluindo conversas humanas

## Problema

O filtro "🤖 Todas da IA" filtra por `ai_mode`, mas quando um agente assume uma conversa (copilot), o `ai_mode` muda para `copilot`. Conversas encerradas que foram atendidas por humanos ficam com `ai_mode = 'copilot'` e aparecem no filtro "Todas da IA".

O que o usuário quer: ver apenas conversas que foram **somente atendidas pela IA** (sem agente humano atribuído).

## Solução

### 1. Adicionar nova opção "Somente IA (sem humano)"
Em `InboxFilterPopover.tsx`, adicionar opção:
```typescript
{ value: "ai_only", label: "🤖 Somente IA (sem humano)" }
```

### 2. Lógica de filtragem em `useInboxView.tsx`
Quando `aiMode === 'ai_only'`:
- Filtrar por `ai_mode === 'autopilot'` **E** `assigned_to === null` (nenhum agente humano atribuído)

Isso garante que só apareçam conversas que foram 100% gerenciadas pela IA.

### 3. Ajustar "ai_all" para excluir copilot com agente
Manter `ai_all` como está (agrupa autopilot + copilot + waiting_human), mas adicionar a nova opção `ai_only` como filtro mais restritivo.

### 4. Atualizar tipo em `InboxFilters`
Adicionar `'ai_only'` ao tipo union de `aiMode`.

## Resultado
- **"🤖 Todas da IA"** → mostra qualquer conversa com IA envolvida (autopilot, copilot, waiting_human)
- **"🤖 Somente IA (sem humano)"** → mostra APENAS conversas sem agente atribuído e em autopilot
- Filtro antigo de autopilot/copilot/waiting_human continua funcionando individualmente

