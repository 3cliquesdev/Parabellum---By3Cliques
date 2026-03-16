

# Correção: Widget do Portal — UTF-8 + Rastreio + Persona Dedicada

## Problema
1. **Encoding**: A edge function `ai-autopilot-chat` retorna `Content-Type: application/json` sem `charset=utf-8`. O SDK do Supabase usa `response.json()` internamente, que pode falhar com caracteres acentuados.
2. **Rastreio**: O `flow_context` no hook já tem `tracking` em `allowed_sources`, mas falta `useKnowledgeBase: true` e a instrução explícita sobre `check_tracking`.
3. **Persona**: Nenhuma persona existente combina todos os acessos necessários para o widget (tracking + order_history + crm + kb + financial). A "Ana Júlia" (CS) não tem tracking/order_history. Precisa de uma persona dedicada.

## Plano

### 1. Criar persona "Assistente do Portal" no banco
Inserir via SQL uma nova persona com acesso total e tom humano:
```
name: "Assistente do Portal"
role: "Especialista Portal do Cliente"
system_prompt: "Você é a assistente virtual do portal do cliente da 3Cliques. Trate cada cliente pelo nome, seja calorosa e empática. Você tem acesso completo: pedidos, rastreio, financeiro, devoluções e base de conhecimento. Use a ferramenta check_tracking para consultar status de entregas. Nunca transfira sem tentar resolver primeiro. Seja direta mas acolhedora, como uma amiga que trabalha na empresa."
temperature: 0.6
max_tokens: 600
data_access: { customer_data: true, knowledge_base: true, order_history: true, tracking_data: true, financial_data: true }
```

### 2. Atualizar `useClientAssistant.ts`
- Atualizar `contextPrompt` com instrução explícita sobre `check_tracking`
- Adicionar `useKnowledgeBase: true` ao `flow_context`
- Adicionar `persona_id` da nova persona ao body da chamada

### 3. Atualizar `ai-autopilot-chat` — Header UTF-8
- Criar constante `jsonHeaders` com `'Content-Type': 'application/json; charset=utf-8'`
- Substituir todas as ocorrências de `'Content-Type': 'application/json'` pela constante
- Redeploy da função

### 4. Verificar `AssistantWidget.tsx`
- O widget usa `supabase.functions.invoke()` que internamente faz `response.json()`. O fix do charset no servidor resolve o encoding. Não precisa mudar o widget.

## Impacto
- Widget responde com rastreio e acesso completo
- Caracteres acentuados renderizados corretamente
- Nova persona dedicada, sem afetar outras personas existentes
- Zero impacto no fluxo WhatsApp

