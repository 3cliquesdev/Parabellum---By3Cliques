

# Auditoria: Conversa 1F6A8C49 — IA Falha ao Criar Ticket de Saque

## Diagnóstico Completo

Analisei a conversa `1f6a8c49` mensagem por mensagem. O cliente seguiu todo o fluxo corretamente:

```text
Cliente: "bom dia"             → Menu Produto
Cliente: "1" (Nacional)        → Menu Assunto  
Cliente: "2" (Financeiro)      → IA Financeiro ativada
IA: "Sou Helper Financeiro..."
Cliente: "quero sacar!"        → IA envia OTP
Cliente: "100496"              → OTP validado ✅
IA: "Código validado! Você quer: A) Cancelar? B) Sacar?"  ← PROBLEMA 1
Cliente: "ja falei pra voce procure na conversa!"
IA: "Não encontrei informações..."  ← PROBLEMA 2
[auto-encerramento por inatividade]
```

## 3 Problemas Identificados

### Problema 1: Resposta pós-OTP é hardcoded e ignora o contexto
Após o OTP ser validado, o código (linha 8458) retorna uma mensagem fixa:
> "Você quer: A) Cancelar? B) Sacar?"

Mas o cliente **já disse "quero sacar!"** 3 mensagens atrás. A IA ignora a intenção original e faz uma pergunta desnecessária.

### Problema 2: Flag `otpVerified` não é propagada ao flow_state
O `collected_data` do flow_state mostra `customer_validated: false` e **nenhum** `__ai_otp_verified`. O handler de `verify_otp_code` (linha 8412) marca a verificação na tabela `email_verifications`, mas **não atualiza** o `chat_flow_states.collected_data` com a flag `__ai_otp_verified: true`. O sync automático (linha 6094) só roda no **próximo** ciclo e depende de `flow_context.stateId`, que pode não estar presente.

### Problema 3: Na invocação seguinte, a IA busca na KB ao invés de coletar dados
Como `otpVerified` nunca chegou ao flow_context, a instrução `otpVerifiedInstruction` (que diz "COLETE DADOS DO SAQUE") não foi injetada no prompt. O resultado: a IA fez uma busca KB (confidence 0.44) e respondeu genericamente.

## Correções Propostas

### 1. Resposta pós-OTP inteligente (ao invés de hardcoded)
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts` (~linha 8454-8464)

Ao validar OTP com CPF OK:
- Detectar se o cliente já mencionou "saque" ou "reembolso" no histórico recente
- Se sim: pular a pergunta A/B e ir direto para a coleta de dados (enviar a `structuredCollectionMessage`)
- Se não: manter a pergunta A/B como fallback
- Incluir `otpVerified: true` no `collected_data` do flow_state imediatamente

### 2. Sync imediato do `__ai_otp_verified` no flow_state
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts` (~linha 8412-8474)

Após marcar `email_verifications.verified = true`:
- Buscar o `chat_flow_states` ativo da conversa
- Atualizar `collected_data` com `__ai_otp_verified: true` e `customer_validated: true`
- Isso garante que na próxima invocação, `process-chat-flow` propague `otpVerified: true` no `flow_context`

### 3. Injeção de contexto da intenção original no prompt pós-OTP
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts` (~linha 6865)

Quando `otpVerified` estiver ativo, injetar no prompt:
- A intenção original do cliente extraída do histórico (ex: "quero sacar")
- Instrução explícita: "O cliente JÁ informou que quer [saque/reembolso]. NÃO pergunte novamente. Prossiga diretamente com a coleta de dados."

## Resultado Esperado

Fluxo corrigido:
```text
Cliente: "quero sacar!"        → IA envia OTP
Cliente: "100496"              → OTP validado ✅
IA: "Verificado! Para seu saque, preciso dos dados: Chave PIX, Banco, Valor, Motivo"
Cliente: [fornece dados]       → IA cria ticket automaticamente ✅
```

