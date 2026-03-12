

# Auditoria Nó-a-Nó: Fluxo Financeiro de Saque — Blindagem Final

## Problemas Encontrados

### Problema 1: Mensagens ambíguas caem no "limbo" (CRÍTICO)
Quando o cliente diz algo como **"saque"**, **"meu saldo"**, **"estorno"** (uma palavra só, sem verbo imperativo), a mensagem:
- NÃO casa com `financialActionPattern` (exige "quero sacar", "fazer saque", etc.)
- NÃO casa com `financialInfoPattern` (exige "qual prazo", "como funciona", etc.)

**Resultado**: A IA responde livremente, sem trava financeira nem roteamento. É aqui que a alucinação acontece — a IA tenta "ajudar" inventando dados.

**Solução**: Adicionar uma **terceira regex** (`financialAmbiguousPattern`) que detecta termos financeiros isolados. Quando detectado E `forbidFinancial=true`, em vez de bloquear ou deixar passar, a IA recebe uma instrução especial no prompt para **perguntar ao cliente**: "Você gostaria de informações sobre saque ou deseja realizar um saque?"

### Problema 2: `forbid_options: true` bloqueia a pergunta de desambiguação
O nó `ia_entrada` tem `forbid_options: true`. O validator em `validateResponseRestrictions` bloqueia respostas com padrões tipo "1️⃣", "opção", "selecione". Mas uma pergunta natural ("Você quer saber sobre saque ou realizar um?") NÃO é uma opção formatada — é uma pergunta simples. 

**Porém**, o `forbid_questions` está `false` no nó, então a IA PODE fazer perguntas. O problema é que o prompt de trava financeira NÃO instrui a IA a perguntar em caso de ambiguidade — ela simplesmente não sabe que pode.

**Solução**: Atualizar o bloco `TRAVA FINANCEIRA ATIVA` no `generateRestrictedPrompt` para incluir instrução de desambiguação:
> "Se a mensagem mencionar termos financeiros (saque, saldo, reembolso, estorno) mas NÃO for claramente uma ação NEM uma pergunta informativa, pergunte ao cliente de forma natural: 'Você gostaria de informações sobre [tema] ou deseja realizar uma solicitação?' Isso é obrigatório — nunca assuma a intenção."

### Problema 3: Regex de ação muito restritiva — variações comuns escapam
Frases reais que **NÃO** são capturadas pelo `financialActionPattern` atual:
- "Preciso do meu saque" (falta "quero" antes)
- "Cadê meu dinheiro" (não casa com nenhum padrão)
- "Quero receber meu pagamento"
- "Me devolvam" / "Me reembolsem"
- "Não recebi meu reembolso" (reclamação que implica ação)

**Solução**: Expandir `financialActionPattern` com esses padrões adicionais.

### Problema 4: Fallback anti-alucinação genérico demais
O fallback atual é: "Não tenho essa informação no momento. O setor financeiro poderá te orientar com detalhes." Isso é bom mas a IA pode ignorar e inventar antes de chegar ao fallback.

**Solução**: Reforçar com instrução POSITIVA (dizer o que FAZER, não só o que NÃO fazer): "Quando o assunto for financeiro, sua PRIMEIRA ação deve ser verificar se a KB contém informação EXATA. Se NÃO contiver, use o fallback. Não tente deduzir ou estimar."

## Onde configurar (resposta à pergunta do usuário)

A configuração acontece em **3 camadas combinadas**:

1. **No nó `ia_entrada`** (flow_definition) — flags `forbid_financial`, `forbid_questions: false`, `objective`
2. **No prompt restritivo** (`generateRestrictedPrompt` em `ai-autopilot-chat`) — instruções textuais que a LLM recebe
3. **Na regex de detecção** (ambos `ai-autopilot-chat` e `process-chat-flow`) — decide o que bloquear vs. deixar passar

A pergunta de desambiguação é configurada no **prompt restritivo** (camada 2) — basta adicionar a instrução. O nó já permite perguntas (`forbid_questions: false`).

## Plano de Implementação

### Arquivo 1: `supabase/functions/ai-autopilot-chat/index.ts`

**A) Adicionar `financialAmbiguousPattern`** (após as duas regex existentes, ~linha 1378):
```
const financialAmbiguousPattern = /\b(saque|saldo|reembolso|estorno|devolu[çc][ãa]o|ressarcimento|pix|cobran[çc]a)\b/i;
```

**B) Atualizar lógica de interceptação** (~linha 1384):
- Se `isFinancialAction && !isFinancialInfo` → bloquear (atual)
- Se `isFinancialInfo` → passar para LLM (atual)
- Se `!isFinancialAction && !isFinancialInfo && financialAmbiguousPattern.test(msg)` → NÃO bloquear, mas setar flag `ambiguousFinancial: true` para injetar instrução de desambiguação no prompt

**C) Atualizar `generateRestrictedPrompt`** (~linha 1180):
Adicionar bloco de desambiguação quando `forbidFinancial=true` E `!forbidQuestions`:
> "Se o cliente mencionar termos como saque, saldo, reembolso ou estorno sem deixar claro se quer informação ou realizar uma ação, pergunte de forma natural e empática: 'Posso te ajudar com informações sobre [tema] ou você gostaria de fazer uma solicitação?' Nunca assuma a intenção do cliente."

**D) Expandir `financialActionPattern`**:
Adicionar: `cad[êe]\s*(meu\s*)?(dinheiro|saldo|reembolso)`, `n[ãa]o\s+recebi\s*(meu\s*)?(reembolso|estorno|saque|pagamento)`, `me\s+(devolvam|reembolsem|paguem)`, `preciso\s+do\s+meu\s+(saque|reembolso|saldo)`, `quero\s+receber\s*(meu\s*)?(pagamento|dinheiro|saldo)`

### Arquivo 2: `supabase/functions/process-chat-flow/index.ts`

Mesmas alterações de regex (sincronizar `financialActionPattern` expandido e adicionar `financialAmbiguousPattern`). Quando ambíguo, não disparar exit — deixar a IA perguntar.

## Resultado Esperado

| Mensagem do cliente | Antes | Depois |
|---|---|---|
| "Quero sacar meu saldo" | ✅ Roteia para fluxo | ✅ Mantém |
| "Qual o prazo de saque?" | ✅ IA responde via KB | ✅ Mantém |
| "Saque" (isolado) | ❌ IA alucina | ✅ IA pergunta: "Posso te ajudar com informações sobre saque ou você gostaria de realizar uma solicitação?" |
| "Meu saldo" | ❌ IA inventa | ✅ IA pergunta desambiguação |
| "Cadê meu dinheiro" | ❌ Escapa | ✅ Detecta como AÇÃO → roteia |
| "Não recebi meu reembolso" | ❌ Escapa | ✅ Detecta como AÇÃO → roteia |
| "Dúvidas com estorno" | ✅ IA responde (info) | ✅ Mantém |

