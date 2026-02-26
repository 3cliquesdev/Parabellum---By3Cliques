

# Fix: IA ignora contexto original e envia menu genérico após verificação de email

## Problema Identificado

Na conversa `#912BAC7F`, o fluxo foi:
1. Cliente: "Comprei mais não recebi acesso"
2. IA: "Pode me informar o email?"
3. Cliente: `libertecdados@gmail.com`
4. IA: "Encontrei seu cadastro! Precisa de ajuda com: **1** - Pedidos **2** - Sistema" ← **ERRADO**

A IA **ignorou o contexto original** ("não recebi acesso") e enviou um menu genérico hardcoded (linha 2873). Isso acontece porque:

- O `original_intent` é salvo no metadata (linha 4519-4523) quando a IA pede email
- Mas ao verificar o email (linhas 2849-2975), o código **nunca recupera** esse `original_intent`
- Em vez disso, envia sempre o menu fixo "1-Pedidos / 2-Sistema"

Isso é pior quando `flow_context` existe e tem consultor (linha 2967), onde envia o menu e perde o fluxo.

## Plano de Implementação

### 1. Alterar `ai-autopilot-chat/index.ts` — Recuperar contexto original na verificação de email

**No bloco de email verificado (linhas ~2849-2976):**

- Antes de montar `autoResponse`, recuperar `original_intent` e `original_intent_category` do `conversation.customer_metadata`
- Se `original_intent` existir:
  - **NÃO enviar menu** "1-Pedidos / 2-Sistema"
  - Enviar: "Encontrei seu cadastro, {nome}! ✅ Voltando à sua dúvida sobre {intent_label}..."
  - **Não retornar early** — deixar o fluxo continuar para que a IA processe a pergunta original usando a KB
- Se `original_intent` NÃO existir (cliente mandou email sem contexto prévio):
  - Manter comportamento atual (menu de departamentos)

### 2. Remover menu hardcoded como fallback em flow_context

- Linha 2967 (`flow_context` ativo + consultor): trocar `autoResponse = foundMessage` por mensagem contextual + deixar IA continuar
- Linha 2975 (sem consultor, sem flow_context): manter menu apenas nesse caso (Master Flow assume)

### 3. Limpar `original_intent` do metadata após uso

- Após recuperar e usar o `original_intent`, limpar do metadata para evitar reprocessamento

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/ai-autopilot-chat/index.ts` | Recuperar `original_intent` no bloco de verificação de email (~linhas 2849-2976) e usar como contexto em vez de menu genérico |

## Governança
- Zero regressão: apenas muda o comportamento quando `original_intent` existe no metadata
- Sem `original_intent`, tudo funciona como antes (menu de departamentos)
- O fluxo de consultant redirect permanece intacto

