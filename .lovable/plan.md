

# Auditoria: Fluxo Financeiro de Saque — Blindagem Anti-Alucinação

## Estado Atual do Fluxo (912b366e)

O ramo financeiro (saque) segue este caminho:

```text
ia_entrada (forbid_financial=true) 
  → intent_router (ai_exit_intent == "financeiro")
    → fin_msg_seguranca ("Para sua segurança...")
      → fin_otp (Verificar Cliente + OTP)
        → fin_check_otp (OTP Verificado?)
          ├─ true → fin_msg_confirmado → fin_ask_nome → fin_ask_pix 
          │    → fin_ask_banco → fin_ask_motivo → fin_ask_valor 
          │    → fin_create_ticket → fin_msg_ok → fin_end
          └─ false → fin_msg_falha → fin_end_falha
```

## Problemas Encontrados

### 1. Falsos Positivos na Regex (CRÍTICO)
Exemplos reais de produção (antes da separação action/info):
- **"Dúvidas com estorno"** → bloqueado como AÇÃO (era INFO)
- **"Gostaria de me informar sobre a confirmação de uma devolução"** → bloqueado como AÇÃO (era INFO)

O `financialActionPattern` atual ainda tem problemas:
- `estornar` como verbo standalone pode capturar contextos informativos
- `devolu[çc][ãa]o` aparece como substantivo em frases informativas
- A condição `!isFinancialInfo` protege parcialmente, mas o `financialInfoPattern` não cobre todas as variações informativas (ex: "dúvidas com", "informar sobre", "saber sobre")

### 2. Dupla Interceptação ai-autopilot-chat + process-chat-flow (RISCO)
Quando `forbid_financial=true` e o nó está ativo dentro de um fluxo:
1. `ai-autopilot-chat` intercepta PRIMEIRO e retorna `financialBlocked: true` com mensagem fixa genérica
2. Webhook re-invoca `process-chat-flow` com `forceFinancialExit: true`
3. `process-chat-flow` seta `ai_exit_intent=financeiro` e avança

**Problema**: A mensagem genérica do passo 1 ("Vou te encaminhar para um atendente humano") é enviada ao cliente ANTES do fluxo financeiro começar. O cliente recebe uma mensagem confusa seguida da mensagem de segurança do fluxo.

### 3. Nó fin_ask_motivo tem opção "Saque de saldo" mas NÃO tem edge separada
O `fin_ask_motivo` tem 4 opções (Saque, Reembolso, Estorno, Outro). As edges de Reembolso, Estorno e Outro apontam para `fin_ask_valor`, mas a edge default (Saque) também vai para `fin_ask_valor`. Isso funciona, mas perde oportunidade de coleta diferenciada por tipo.

### 4. IA pode alucinar sobre valores/prazos no nó ia_entrada
Antes de detectar a intenção financeira, a IA pode responder 1-2 mensagens sobre finanças usando a KB. Se a KB não tiver informação precisa sobre prazos de saque, a IA pode inventar dados.

### 5. Mensagem fixa no ai-autopilot-chat menciona "atendente humano"
Linha 1382: `"Entendi. Para assuntos financeiros... vou te encaminhar para um atendente humano agora."` — Mas o fluxo NÃO encaminha para humano; ele inicia um fluxo automatizado (OTP + coleta). Mensagem enganosa.

## Plano de Correção

### Correção 1: Ampliar `financialInfoPattern` para cobrir mais variações informativas
Adicionar padrões: `d[úu]vida|saber\s+sobre|informar\s+sobre|informa[çc][ãa]o|perguntar|entender|explicar`

### Correção 2: Eliminar mensagem duplicada no ai-autopilot-chat
Quando `hasFlowContext=true` e `financialBlocked=true`, NÃO enviar a mensagem fixa genérica. Retornar apenas `financialBlocked: true` sem `response/message/aiResponse`, delegando 100% para o fluxo.

### Correção 3: Corrigir texto da mensagem fixa (caso sem fluxo)
Alterar de "atendente humano" para "setor financeiro" — consistente com o que realmente acontece.

### Correção 4: Adicionar restrição anti-alucinação financeira no system prompt
Reforçar no `restrictions` quando `forbidFinancial=true`: "NÃO cite valores, prazos, datas ou percentuais sobre saques/reembolsos a menos que essa informação EXATA exista na base de conhecimento."

### Correção 5: Adicionar log de diagnóstico no fluxo financeiro
Adicionar `console.log` no `process-chat-flow` quando `ai_exit_intent=financeiro` é setado, para rastrear exatamente qual mensagem disparou o roteamento.

## Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/ai-autopilot-chat/index.ts` | Ampliar `financialInfoPattern`, remover mensagem duplicada quando fluxo ativo, corrigir texto fallback, reforçar anti-alucinação no prompt |
| `supabase/functions/process-chat-flow/index.ts` | Ampliar `financialInfoPattern` (mesma regex), log de diagnóstico |

Nenhuma alteração no banco necessária — o flow_definition já está correto com `forbid_financial: true`.

## Resultado Esperado

- "Quero sacar meu saldo" → detecta ação → fluxo financeiro (OTP → coleta → ticket)
- "Dúvidas com estorno" → detecta INFO → IA responde via KB
- "Qual o prazo de saque?" → detecta INFO → IA responde via KB (sem inventar prazos)
- Sem mensagem duplicada ("atendente humano" + "segurança OTP")
- Zero alucinação sobre valores/prazos financeiros

