

# Plano: Saída "Consultor" + Desambiguação Obrigatória em Todas as Intenções

## Resumo

Duas melhorias no nó AI Response:
1. **Nova saída "Consultor"** (6º handle) — roteia para consultor vinculado ao contato, com verificação se `consultant_id` existe
2. **Desambiguação obrigatória** em todas as 5 intenções — a IA pergunta antes de rotear, nunca assume

---

## Mudanças

### 1. UI — AIResponseNode.tsx
- Adicionar 6º handle `consultor` (cor roxo/violeta 💼) na posição `bottom` ou reposicionar os 6 handles distribuídos (14%, 28%, 42%, 56%, 70%, 84%)
- Adicionar label `💼 consultor` e badge correspondente
- Adicionar `forbid_consultant` ao interface

### 2. UI — BehaviorControlsSection.tsx
- Adicionar toggle `💼 Consultor` com descrição: "Falar com consultor → saída roxa (só se tiver consultor vinculado)"
- Adicionar badge na seção de status

### 3. Engine — process-chat-flow/index.ts

**3a. Nova variável e regex:**
```typescript
const forbidConsultant = currentNode.data?.forbid_consultant ?? false;
const consultorIntentPattern = /falar\s+com\s*(meu\s*)?(consultor|assessor|gestor)|quero\s+(meu\s*)?(consultor|assessor)|cadê\s*(meu\s*)?(consultor)|consultor\s+de\s+vendas|estratégia\s+de\s+vendas|meu\s+consultor/i;
const consultorIntentMatch = forbidConsultant && msgLower.length > 0 && consultorIntentPattern.test(userMessage || '');
```

**3b. Verificação de consultant_id:**
Quando `consultorIntentMatch=true`, verificar se o contato tem `consultant_id`. Se sim → saída `consultor`. Se não → IA informa que não há consultor vinculado e encaminha pelo handle `suporte`.

**3c. Desambiguação obrigatória para TODAS as intenções:**
Adicionar padrões ambíguos (como já existe para financeiro) para cancelamento, comercial, suporte e consultor. Quando ambíguo, injetar instrução de desambiguação no prompt da IA:

| Intenção | Pergunta de desambiguação |
|---|---|
| Financeiro | "Posso te ajudar com informações sobre [tema] ou você gostaria de fazer uma solicitação?" |
| Cancelamento | "Você tem dúvidas sobre cancelamento ou deseja cancelar um produto/serviço?" |
| Comercial | "Você deseja comprar algum plano ou tem dúvidas sobre seu plano atual?" |
| Consultor | "Você deseja falar com um consultor para estratégias de vendas? Ou quer um atendimento normal pela equipe de suporte?" |
| Suporte | (mantém comportamento atual — termos explícitos como "atendente" não precisam desambiguação) |

**3d. Lógica de ambiguidade:**
Para cada intenção, criar um `ambiguousPattern` com termos isolados (ex: "cancelar", "plano", "consultor") e só disparar o exit quando for uma ação clara. Termos ambíguos → IA pergunta primeiro.

**3e. Integrar na cadeia de exit e logging:**
- Adicionar `consultorIntentMatch` em todos os guards (`keywordMatch`, `maxReached`, etc.)
- Salvar `ai_exit_intent = 'consultor'`
- Log `ai_blocked_consultant` em ai_events
- Path `consultor` no findNextNode

### 4. Engine — ai-autopilot-chat/index.ts
Injetar instruções de desambiguação no prompt da IA para cancelamento, comercial e consultor (financeiro já existe).

### 5. ChatFlowEditor.tsx
Adicionar `forbid_consultant: false` nos defaults de novos nós AI.

---

## Arquivos Afetados

| Arquivo | Tipo |
|---|---|
| `src/components/chat-flows/nodes/AIResponseNode.tsx` | 6º handle + badge |
| `src/components/chat-flows/panels/BehaviorControlsSection.tsx` | Toggle consultor |
| `src/components/chat-flows/ChatFlowEditor.tsx` | Default `forbid_consultant` |
| `supabase/functions/process-chat-flow/index.ts` | Regex + match + exit + disambiguation |
| `supabase/functions/ai-autopilot-chat/index.ts` | Prompts de desambiguação |

