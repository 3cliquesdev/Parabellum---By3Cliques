

# Documentação: Contrato de Saídas de Intenção — Regras Travadas

Vou criar o arquivo `INTENT_EXIT_CONTRACT.md` na raiz do projeto, seguindo o mesmo padrão do `TEST_MODE_CONTRACT.md` existente. O documento servirá como referência imutável para as 5 saídas de intenção.

## Conteúdo do documento

O contrato cobrirá todas as regras auditadas e validadas:

### 1. Arquitetura de Saídas
- 6 handles no nó `ai_response`: `default`, `financeiro`, `cancelamento`, `comercial`, `suporte`, `consultor`
- Hierarquia de fallback: `[intent path]` → `ai_exit` (legado) → `default`
- Consultor com fallback automático para suporte quando sem `consultant_id`

### 2. Prompt (`generateRestrictedPrompt`)
- Todos os 5 intents usam `[[FLOW_EXIT:intent]]` (financeiro, cancelamento, comercial, consultor, suporte)
- Desambiguação obrigatória antes de disparar exit
- Instruções de confirmação em cada intent

### 3. Guards Contextualizados (`*GuardInstruction`)
- 4 guards: `financialGuardInstruction`, `cancellationGuardInstruction`, `commercialGuardInstruction`, `consultorGuardInstruction`
- Cada guard tem flag `ambiguous*Detected` para reforço contextualizado
- Todos injetados no `contextualizedSystemPrompt`

### 4. Propagação de Flags (`forbid*`)
- 4 flags: `forbidFinancial`, `forbidCommercial`, `forbidCancellation`, `forbidConsultant`
- Propagadas em: buffer context, direct context (Meta), flow_context (Evolution)

### 5. Propagação de `intentData`
- Todas as re-invocações incluem `intentData: { ai_exit_intent: 'intent' }`
- Meta webhook: financeiro (2x), comercial (2x), cancelamento (1x)
- Evolution webhook: financeiro, comercial, cancelamento + clean exit

### 6. Motor (`process-chat-flow`)
- Destructuring de todos os force flags
- Forbids lidos do nó
- `intentData` mapping para 5 intents
- Auto-detect para 5 intents
- Path selection para 6 paths

### 7. Tabela de referências de código
- Mapeamento arquivo → responsabilidade → linhas críticas

## Arquivo a criar

`INTENT_EXIT_CONTRACT.md` — ~150 linhas, formato idêntico ao `TEST_MODE_CONTRACT.md`

