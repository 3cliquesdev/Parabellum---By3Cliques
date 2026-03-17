

# Fix: "Saque" isolado deve gerar desambiguação natural (não silenciar a IA)

## Diagnóstico

Ao digitar apenas "saque", o sistema corretamente identifica como **termo ambíguo** (`isFinancialAmbiguous=true`) e NÃO faz exit do nó. A instrução de desambiguação já é injetada no prompt da IA. Porém, dois problemas podem causar o "silêncio":

### Problema 1: Exit Keywords no fluxo
Se o nó de triagem tiver "saque" na lista de `exit_keywords`, o `keywordMatch` na linha 3443 dispara um exit silencioso — SEM verificar se o termo é ambíguo. O `keywordMatch` ignora `saqueIntentMatch` no guard, mas captura "saque" se estiver nas keywords configuradas.

**Fix**: Adicionar verificação de `isFinancialAmbiguous` no guard do `keywordMatch` — se o termo é financeiro ambíguo, NÃO tratar como exit keyword, deixar a IA desambiguar.

### Problema 2: Tom da desambiguação pouco natural
As instruções de desambiguação atuais são formais demais ("Posso te ajudar com informações sobre [tema] ou você gostaria de fazer uma solicitação?"). Precisam ser mais humanizadas.

## Plano de Correção

### Arquivo: `supabase/functions/process-chat-flow/index.ts`

**1. Guard no `keywordMatch` para termos ambíguos** (~linha 3443)

Adicionar `&& !isFinancialAmbiguous && !isCancellationAmbiguous` no guard do `keywordMatch`, para que termos ambíguos nunca disparem exit por keyword — a IA deve perguntar primeiro.

```typescript
const keywordMatch = !financialIntentMatch && !commercialIntentMatch 
  && !cancellationIntentMatch && !supportIntentMatch && !consultorIntentMatch 
  && !isFinancialAmbiguous && !isCancellationAmbiguous  // ← NOVO
  && exitKeywords.length > 0 && exitKeywords.some(...)
```

### Arquivo: `supabase/functions/ai-autopilot-chat/index.ts`

**2. Humanizar instruções de desambiguação** (4 locais)

Trocar as frases formais por versões mais naturais e empáticas:

| Intent | Antes | Depois |
|--------|-------|--------|
| Financeiro | "Posso te ajudar com informações sobre [tema] ou você gostaria de fazer uma solicitação?" | "Opa! Sobre saque, posso te explicar como funciona ou, se preferir, te encaminho pra fazer a solicitação. O que prefere?" |
| Cancelamento | "Você tem dúvidas sobre cancelamento ou deseja cancelar um produto/serviço?" | "Entendi! Você quer saber como funciona o cancelamento ou quer cancelar de fato? Me conta que te ajudo!" |
| Comercial | "Você deseja comprar algum plano ou tem dúvidas sobre seu plano atual?" | "Legal! Você tá querendo contratar algo ou só quer tirar uma dúvida sobre os planos? Me fala!" |
| Consultor | "Você deseja falar com um consultor...?" | "Quer que eu chame seu consultor ou posso te ajudar com sua dúvida por aqui mesmo?" |

Atualizar nos 2 locais de cada intent:
- `generateRestrictedPrompt` (instruções base ~linhas 1257-1304)
- Guards contextualizados (`financialGuardInstruction` etc ~linhas 6625-6674)

### Total: ~20 linhas alteradas em 2 arquivos

### Resultado
- "saque" isolado → IA responde naturalmente perguntando se quer info ou ação
- "quero sacar" → continua fazendo exit financeiro (ação clara)
- "como funciona o saque" → continua respondendo via KB (info clara)
- Tom mais humano e empático em todas as desambiguações

