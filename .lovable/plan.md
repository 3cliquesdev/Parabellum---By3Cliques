

# Corrigir lógica financeira: Desambiguar + Seguir fluxo para ações

## Problema atual

"Sacar!" é uma palavra isolada que **não** bate no `financialActionPattern` (que exige frases compostas), mas bate no `OTP_REQUIRED_KEYWORDS` (simples `includes('sacar')`). Isso causa bloqueio imediato sem desambiguação.

A cadeia de falha:
1. `process-chat-flow` envia para `ai-autopilot-chat` com `forbidFinancial=true`
2. A interception precoce (linha 1527) NÃO pega "Sacar!" (não bate no `financialActionPattern`)
3. Mas o check de OTP (linha 5543) pega "sacar" via `OTP_REQUIRED_KEYWORDS`
4. Como `flow_context.forbidFinancial=true`, retorna `financialBlocked=true` direto, sem perguntar nada

## Comportamento desejado

- **Dúvida** ("como funciona o saque?") → IA responde via KB, fica no nó
- **Ação clara** ("quero sacar meu saldo") → Segue fluxo financeiro (OTP → ticket automático)
- **Ambíguo** ("sacar", "saque", "reembolso") → IA pergunta: "Você quer informações sobre saque ou deseja solicitar um saque?"
  - Se confirmar ação → Segue fluxo financeiro
  - Se for dúvida → IA responde via KB

## Alterações

### 1. `ai-autopilot-chat/index.ts` — Corrigir o check de OTP com flow context

No bloco de OTP (linha ~5986), quando `flow_context.forbidFinancial=true`:
- **Antes de bloquear**, verificar se a mensagem é uma ação clara ou ambígua
- Se **ambígua** (termo isolado como "sacar", "saque"), NÃO bloquear. Injetar instrução de desambiguação no prompt e deixar a IA perguntar
- Se **ação clara** (frase composta como "quero sacar meu saldo"), manter o bloqueio e devolver ao fluxo

Mudança concreta:
```
// Antes do check de OTP (linha ~5986):
if (contactHasEmail && isWithdrawalRequest && !hasRecentOTPVerification) {
  if (flow_context?.forbidFinancial) {
    // 🆕 VERIFICAR se é ação clara ou termo ambíguo
    const isAmbiguousWithdrawal = OTP_REQUIRED_KEYWORDS.some(k => 
      customerMessage.toLowerCase().includes(k)
    ) && !WITHDRAWAL_ACTION_PATTERNS.some(p => p.test(customerMessage));
    
    if (isAmbiguousWithdrawal) {
      // NÃO bloquear — deixar IA perguntar via desambiguação
      console.log('[ai-autopilot-chat] 🔍 OTP SAQUE AMBÍGUO: termo isolado, IA vai desambiguar');
      // Setar flag para injetar instrução no prompt
      // (continua execução normal, não retorna aqui)
    } else {
      // Ação clara → devolver ao fluxo (comportamento atual)
      return Response...financialBlocked
    }
  }
}
```

### 2. `ai-autopilot-chat/index.ts` — Injetar instrução de desambiguação no prompt

Na montagem do system prompt, quando `ambiguousFinancialDetected` ou o novo `ambiguousWithdrawalDetected` for true, adicionar instrução:
```
"O cliente mencionou um termo financeiro ambíguo. Pergunte educadamente:
'Você gostaria de informações sobre [tema] ou deseja fazer uma solicitação de [tema]?'
Se confirmar que quer SOLICITAR/FAZER a ação → responda com [[FLOW_EXIT:financeiro]]
Se for apenas dúvida → responda normalmente usando a Base de Conhecimento."
```

### 3. `ai-autopilot-chat/index.ts` — Detectar confirmação de ação após desambiguação

Quando a IA pergunta "quer solicitar?" e o cliente responde "sim, quero sacar":
- Isso já vai bater no `financialActionPattern` ("quero sacar") → roteamento correto para o fluxo
- Ou se responder só "sim" → verificar se a última mensagem da IA foi uma desambiguação financeira e tratar como confirmação de ação

### 4. `process-chat-flow/index.ts` — Mesma lógica espelhada

No `process-chat-flow` (linha ~3130), a desambiguação para termos ambíguos já existe. Precisa garantir que o `financialAmbiguousPattern` inclua "sacar" (atualmente só tem "saque"):

```
const financialAmbiguousPattern = /\b(saque|sacar|saldo|reembolso|estorno|devolu[çc][ãa]o|ressarcimento|cobran[çc]a)\b/i;
```

### 5. Ambos os arquivos — Adicionar "sacar" ao padrão ambíguo

Tanto em `ai-autopilot-chat` quanto em `process-chat-flow`, o `financialAmbiguousPattern` precisa incluir "sacar" para que o termo isolado seja tratado como ambíguo (e não ignorado nem bloqueado).

## Resumo do fluxo corrigido

```text
Cliente diz "Sacar!"
  ↓
financialActionPattern? NÃO (termo isolado)
financialAmbiguousPattern? SIM ("sacar" agora incluído)
  ↓
IA pergunta: "Você quer informações sobre saque ou deseja solicitar um saque?"
  ↓
Cliente: "quero sacar meu saldo"     Cliente: "como funciona?"
  ↓                                    ↓
financialActionPattern? SIM          financialInfoPattern? SIM
  ↓                                    ↓
Segue fluxo financeiro               IA responde via KB
(OTP → coleta PIX → ticket)          (fica no nó)
```

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/ai-autopilot-chat/index.ts` | Adicionar check ambíguo no bloco OTP, injetar desambiguação no prompt, adicionar "sacar" ao pattern |
| `supabase/functions/process-chat-flow/index.ts` | Adicionar "sacar" ao `financialAmbiguousPattern` |

