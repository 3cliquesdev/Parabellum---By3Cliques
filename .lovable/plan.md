

# Plano: Corrigir IA pedindo email e redirecionando para consultor durante fluxo

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Diagnóstico (3 problemas encontrados)

### Problema 1: System prompt manda pedir email mesmo com bypass
**Linha 5517** do `ai-autopilot-chat/index.ts`:
```typescript
${contactEmail ? `- Email: ${safeEmail}` : '- Email: NÃO CADASTRADO - SOLICITAR'}
```
Quando o contato não tem email, o prompt diz **"SOLICITAR"** — o GPT-5 obedece e pede email, mesmo que a Identity Wall esteja bypassed pelo `flow_context`. O `identityWallNote` diz "NÃO peça email" mas a instrução "SOLICITAR" no contexto do cliente contradiz.

### Problema 2: CONSULTANT REDIRECT interrompe o atendimento
Quando o usuário fornece email e o `verify_customer_email` encontra o cliente com `consultant_id`, o código **automaticamente** (linhas 2760-2797):
- Atribui conversa ao consultor
- Muda `ai_mode` para `copilot`
- Envia "Encontrei seu cadastro, Ronny teste Ronny teste! Vou te conectar com seu consultor"
- **Para de ajudar com a pergunta original** (pedido)

O usuário quer que a IA ajude PRIMEIRO, não redirecione imediatamente.

### Problema 3: Nome duplicado "Ronny teste Ronny teste"
O contato com email `libertecdados@gmail.com` tem `first_name: "Ronny teste"` e `last_name: "Ronny teste"` — dado incorreto no banco. O template concatena os dois.

## Solução

### Mudança 1: Remover "SOLICITAR" do contexto do cliente quando há flow_context
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts` (linha 5517)

Quando `flow_context` existe, o email no contexto deve dizer "Não identificado (aguardando)" em vez de "NÃO CADASTRADO - SOLICITAR":

```typescript
// ANTES:
${contactEmail ? `- Email: ${safeEmail}` : '- Email: NÃO CADASTRADO - SOLICITAR'}

// DEPOIS:
${contactEmail ? `- Email: ${safeEmail}` : (flow_context ? '- Email: Não identificado (a IA pode ajudar sem email)' : '- Email: NÃO CADASTRADO - SOLICITAR')}
```

### Mudança 2: Desabilitar CONSULTANT REDIRECT quando há flow_context ativo
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts` (linhas 2760-2797)

Quando o nó `ai_response` do fluxo está ativo, o cliente deve ser ajudado pela IA — não redirecionado automaticamente para consultor. O redirect só deve ocorrer fora de fluxo ativo ou quando o usuário pedir explicitamente.

```typescript
// Adicionar verificação de flow_context antes do redirect
if (consultantId && !flow_context) {
  // ... redirect atual ...
} else if (consultantId && flow_context) {
  console.log('[ai-autopilot-chat] ℹ️ Consultor encontrado mas flow_context ativo - IA continua ajudando');
  // Salvar consultant_id para uso futuro mas NÃO redirecionar
  autoResponse = foundMessage; // Usar resposta normal de confirmação
} else {
  // Sem consultor - comportamento atual
  autoResponse = foundMessage;
}
```

### Mudança 3 (dados): Nome duplicado
O contato com `libertecdados@gmail.com` tem `first_name` e `last_name` idênticos ("Ronny teste"). Isso é um problema de dados, não de código. Pode ser corrigido manualmente no CRM. Não é mudança de código.

## Resumo

| Arquivo | Linha | Mudança |
|---|---|---|
| `ai-autopilot-chat/index.ts` | 5517 | Remover "SOLICITAR" quando `flow_context` existe |
| `ai-autopilot-chat/index.ts` | 2760 | Não redirecionar para consultor quando `flow_context` está ativo |

## Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — fora de fluxo, comportamento idêntico ao atual |
| Upgrade | Sim — IA ajuda antes de transferir, não pede email desnecessariamente |
| Kill Switch | Não afetado |
| CONSULTANT REDIRECT sem fluxo | Mantido — só desabilita durante fluxo ativo |

