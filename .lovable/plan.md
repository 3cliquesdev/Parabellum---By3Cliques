
# Ajustar o plano para atendentes verem corretamente as conversas da IA

## Diagnóstico
Pelo código e pelos logs, o backend já está entregando conversas da fila IA para o perfil do Miguel:

- `useInboxView.tsx` já inclui `support_agent` na regra que traz:
  - conversas atribuídas a ele
  - conversas do departamento
  - fila IA global sem responsável
  - `autopilot` e `waiting_human`
- O request de `inbox_view` retornou conversas com `ai_mode: "autopilot"` para Miguel
- O realtime também mostrou `shouldShow=true` para uma conversa da IA

Ou seja: o problema agora não parece mais ser permissão/RLS. O gargalo está no filtro da tela.

## Causa raiz mais provável
Em `src/pages/Inbox.tsx`, o filtro da aba `ai_queue` está assim:

```ts
return result.filter(c => c.ai_mode === 'autopilot' && c.status !== 'closed');
```

Isso exclui:
- conversas `waiting_human`
- qualquer conversa “da IA” que ainda deveria aparecer para o atendente, conforme a regra já usada no hook e nas policies

Além disso, o contador em `supabase/functions/get-inbox-counts/index.ts` também conta apenas:

```ts
.eq("ai_mode", "autopilot")
```

Então a UI fica inconsistente:
- o hook traz `autopilot` + `waiting_human`
- a tela mostra só `autopilot`
- o badge da fila IA também conta só `autopilot`

## Plano de ajuste

### 1. Corrigir o filtro visual da aba “Fila IA”
Arquivo: `src/pages/Inbox.tsx`

Trocar a lógica de `ai_queue` para incluir:
- `autopilot`
- `waiting_human`
- apenas conversas não fechadas
- idealmente sem responsável, para manter o conceito de fila global

Exemplo esperado:
```ts
return result.filter(
  c =>
    (c.ai_mode === "autopilot" || c.ai_mode === "waiting_human") &&
    !c.assigned_to &&
    c.status !== "closed"
);
```

### 2. Alinhar o contador da “Fila IA”
Arquivo: `supabase/functions/get-inbox-counts/index.ts`

Atualizar `aiQueueRes` para contar também `waiting_human`, mantendo a mesma regra de visibilidade que já existe no inbox.

Hoje:
```ts
.eq("ai_mode", "autopilot")
```

Ajuste esperado:
```ts
.in("ai_mode", ["autopilot", "waiting_human"])
.is("assigned_to", null)
```

### 3. Revisar coerência com “Fila Humana”
Arquivo: `src/pages/Inbox.tsx`

Como `waiting_human` hoje pode estar caindo na fila humana por causa de:
```ts
c.ai_mode !== 'autopilot'
```

precisa decidir a classificação correta para evitar duplicidade entre:
- `ai_queue`
- `human_queue`

A abordagem mais consistente com o restante do código/memória é:
- `ai_queue`: `autopilot` + `waiting_human` sem responsável
- `human_queue`: conversas humanas / copilot / atribuídas

### 4. Validar coerência com o comportamento já implementado
Sem mexer em RLS, porque os sinais atuais mostram que:
- a visibilidade de dados já está funcionando
- o problema ficou concentrado na camada de filtro/apresentação e nos badges

## Resultado esperado
Depois desse ajuste:
- Miguel e outros atendentes verão a mesma “Fila IA” que o hook já busca
- conversas `waiting_human` não vão sumir da lista
- badge/contador ficará consistente com o conteúdo real da tela
- não será necessário alterar políticas de acesso

## Arquivos a alterar
- `src/pages/Inbox.tsx`
- `supabase/functions/get-inbox-counts/index.ts`

## Verificação depois da implementação
Testar com o perfil do Miguel em `/inbox?filter=ai_queue` e confirmar:
1. se a conversa “da IA” aparece
2. se o número do badge bate com a lista
3. se a conversa não aparece duplicada na fila humana
