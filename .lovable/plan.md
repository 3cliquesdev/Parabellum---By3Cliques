

# Diagnóstico da Conversa #D0300F0F - "Alucinação" após envio de email

## O que aconteceu (cronologia)

1. Cliente: "Boa tarde" → IA responde normalmente
2. Cliente: "Problema pra subir produtos" → IA responde sobre "Publicar catálogo" (resposta possivelmente imprecisa, mas dentro do fluxo normal)
3. Cliente: "Preciso falar com algum especialista" → IA pede email para verificar identidade (comportamento esperado)
4. Cliente: "Henriqueriko961@gmail.com" → **Aqui começa o problema:**
   - `ai-autopilot-chat` verifica o email, encontra o customer, responde: "Encontrei seu cadastro! ✅ Continuando seu atendimento..."
   - Com `skipEarlyReturn = true`, a IA continua processando com o flow_context
   - A resposta da IA dispara detecção de `contractViolation` ou `flowExit` no `process-buffered-messages`
   - `handleFlowReInvoke` é chamado com `forceAIExit: true`
   - O fluxo re-invoca `process-chat-flow`, que avança para o **próximo nó** via `path='ai_exit'`
   - O próximo nó é o INÍCIO do fluxo mestre, que pergunta: **"Você já é nosso cliente?"**

**Resultado**: O sistema já confirmou que é customer, mas o fluxo reinicia do zero perguntando novamente.

## Causa raiz

Duplo processamento: a verificação de email em `ai-autopilot-chat` confirma o customer e responde, mas a resposta é processada novamente pelo pipeline, que detecta uma "violação" e re-invoca o fluxo desde o início.

O `handleFlowReInvoke` não preserva o contexto de que o email já foi validado. O fluxo recomeça como se fosse uma conversa nova.

## Dado extra preocupante

O `first_name` deste contato é: **"Lavador Limpador De Pinceis Maquiagem Automático Elétrico Bivolt - (Cores Sortidas)"** - é um nome de PRODUTO, não de pessoa. Importado via CSV com colunas trocadas.

## Correção proposta

### 1. Evitar re-invoke do fluxo quando email já foi validado
Em `process-buffered-messages/index.ts`, após o `ai-autopilot-chat` retornar com `emailVerified: true` ou similar, **pular** a lógica de `contractViolation/flowExit` que dispara `handleFlowReInvoke`. Se o email já foi validado com sucesso, o fluxo já avançou internamente.

### 2. Adicionar flag `emailVerified` na resposta do autopilot
Em `ai-autopilot-chat`, quando a verificação de email encontra o customer e `skipEarlyReturn = true`, incluir `emailVerified: true` na resposta JSON. 

### 3. Condicionar re-invoke no process-buffered-messages
```
// Não re-invocar se email acabou de ser verificado
if ((autopilotData.contractViolation || autopilotData.flowExit) 
    && autopilotData.hasFlowContext 
    && !autopilotData.emailVerified  // ← NOVO
    && autopilotData.status !== "flow_advance_needed") {
  await handleFlowReInvoke(...);
}
```

### Arquivos a alterar
- `supabase/functions/ai-autopilot-chat/index.ts` - adicionar `emailVerified: true` na resposta quando email validado
- `supabase/functions/process-buffered-messages/index.ts` - condicionar re-invoke para ignorar quando `emailVerified`

