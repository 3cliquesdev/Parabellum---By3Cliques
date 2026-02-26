

# Trava Financeira no Nó de Resposta IA

## Alterações (5 arquivos)

### 1. `src/components/chat-flows/panels/BehaviorControlsSection.tsx`
- Adicionar import `DollarSign` do lucide-react
- Na seção "O que a IA NÃO pode fazer" (bloco vermelho, após o switch de "Não dar opções numeradas" ~linha 172), adicionar novo switch:
  - Ícone: `DollarSign` vermelho
  - Label: "Não resolver assuntos financeiros"
  - Descrição: "A IA transfere para humano ao detectar saque, reembolso ou devolução"
  - Campo: `forbid_financial` (default `false`)
- Adicionar badge `💰 Sem financeiro` na lista de badges ativas (~linha 175-191)

### 2. `src/components/chat-flows/nodes/AIResponseNode.tsx`
- Adicionar `forbid_financial?: boolean` na interface `AIResponseNodeData`
- Adicionar import `DollarSign` do lucide-react
- Renderizar badge `Sem financeiro` (variant destructive, ícone DollarSign) quando `data.forbid_financial === true`

### 3. `src/components/chat-flows/ChatFlowEditor.tsx`
- Adicionar `forbid_financial: false` nos defaults do nó ai_response (~linha 188)

### 4. `supabase/functions/process-chat-flow/index.ts`
- Nos 4 locais onde já passa `forbidQuestions`/`forbidOptions` (linhas ~1227, ~1387, ~1883, ~2094), adicionar:
  ```
  forbidFinancial: node.data?.forbid_financial ?? false,
  ```

### 5. `supabase/functions/ai-autopilot-chat/index.ts`

**5a. Ler flag (~linha 1273):**
```typescript
const flowForbidFinancial: boolean = flow_context?.forbidFinancial ?? false;
```

**5b. Injetar no system prompt (onde já injeta restrições de forbidQuestions/forbidOptions):**
Se `flowForbidFinancial === true`, adicionar bloco:
```
🔒 TRAVA FINANCEIRA ATIVA:
Você NÃO pode resolver assuntos financeiros (saque, reembolso, estorno, devolução, cancelamento, cobrança, pagamento).
Se o cliente mencionar qualquer assunto financeiro, responda EXATAMENTE:
"Esse tipo de solicitação precisa ser tratada por um atendente. Vou te transferir agora!"
E use request_human_agent imediatamente.
Você PODE: coletar dados (email, CPF, ID do pedido) e resumir o caso. NÃO PODE: instruir processos financeiros ou prometer resolução.
```

**5c. Validação pós-resposta (~linha 7774, após validateResponseRestrictions):**
Adicionar `validateFinancialRestriction(assistantMessage, forbidFinancial)`:
- Regex no conteúdo da mensagem da IA detectando afirmações de resolução financeira:
  ```
  /(j[áa] processei|foi estornado|solicitei reembolso|vou reembolsar|pode sacar|liberei o saque|reembolso aprovado|estorno realizado|cancelamento confirmado|pagamento devolvido)/i
  ```
- Se detectar: substituir por fallback "Esse tipo de solicitação precisa ser tratada por um atendente." + forçar `request_human_agent` (ou retornar com flag `force_human_transfer: true`)

## Impacto
- Zero regressão: toggles existentes inalterados
- Aditivo: novo campo `forbid_financial` opcional no nó
- Dupla camada: prompt + validação pós-resposta

