

# Auditoria de Conversas Reais -- Últimas 4 Horas

## Dados Coletados

**Resumo de eventos (4h):**
- 36 respostas IA
- 24 `contract_violation_blocked` (IA tentou fabricar transferência, foi bloqueada)
- 8 `zero_confidence_cautious` (IA sem confiança, todos com 0 artigos KB)
- 4 `fallback_phrase_detected` (frases de fallback na resposta)
- 4 `ai_transfer` / 3 `handoff_to_human`

9 conversas com problemas analisadas mensagem por mensagem.

---

## Falhas Identificadas

### BUG 1: "Código inválido" em contexto errado (CRÍTICO)
**Conversas afetadas:** António (f7116eb2), Lucas Bosco (f257f88c)

**O que aconteceu:**
- António escolheu opção 6 (Falar com consultor), descreveu seu problema: "No dia 3 de março assinei o plano criação..."
- IA respondeu: **"Código inválido. O código deve ter 6 dígitos"**
- Lucas Bosco pediu acompanhamento de saque, disse "Foi solicitado nessa data!" e recebeu **"Código inválido"**

**Causa raiz:** `hasFirstContactOTPPending = !hasEverVerifiedOTP && contactHasEmail` -- qualquer contato com email que nunca verificou OTP é tratado como "aguardando OTP". Quando a mensagem contém qualquer dígito (ex: "dia 3 de março", "7 dias"), o guard na linha 6113 intercepta como tentativa de OTP inválida.

**Correção:** `hasFirstContactOTPPending` deve ser restrito a situações onde OTP foi **efetivamente enviado** (flag `awaiting_otp_verification` no metadata), não a "qualquer contato com email que nunca verificou".

### BUG 2: Loop de saudação -- IA reseta contexto (CRÍTICO)
**Conversas afetadas:** Érika (b0605698), Lucas (39eaa4b5), Rosy (578cee8f), Rodrigo (0834aafe)

**O que aconteceu:**
- Érika pediu devolução de R$400. IA respondeu corretamente com link Kiwify.
- Cliente corrigiu: "Não quero cancelar o curso e sim a adesão no Dropbox"
- IA ignorou e respondeu **novamente** "Olá! Sou Helper Financeiro. Posso te ajudar com financeiro. Como posso te ajudar? 😊"
- Isso se repetiu **6 vezes** na mesma conversa. Cliente ameaçou Reclame Aqui.

**Causa raiz:** Após `contract_violation_blocked`, a IA substitui a mensagem por "Entendi! Poderia me dar mais detalhes..." (linha 9357). Mas na próxima interação, o zero_confidence gera a saudação padrão novamente. A IA perde todo o contexto da conversa anterior.

**Correção:** 
1. Após contract_violation, incrementar o contador de fallbacks do nó
2. Quando atingir threshold (ex: 2 violations consecutivas no mesmo nó), forçar `flowExit` com transferência para humano em vez de ficar em loop

### BUG 3: "Não consegui resolver por aqui" sem transferência (GRAVE)
**Conversas afetadas:** Rosy Comercial (2ac068f7), Sarah Comercial (b9c21d09), Rodrigo Financeiro (0834aafe)

**O que aconteceu:**
- Rosy pediu "Quero 7 dia grátis sou nova"
- IA respondeu: "Não consegui resolver por aqui." e **encerrou sem transferir**
- Sarah disse "Quero ingressar no digital" -- mesma resposta abandonatória
- Rodrigo pagou R$950 PIX e plataforma não carregou -- mesma resposta

**Causa raiz:** Quando `fallback_phrase_detected` ocorre e a mensagem limpa fica < 5 chars, o código substitui por "Entendi! Poderia me dar mais detalhes..." Mas quando isso acontece repetidamente (2x fallback no mesmo nó), o anti-loop deveria ativar `flowExit` para transferir a um humano. Parece que o anti-loop está deixando a mensagem "Não consegui resolver por aqui" passar sem forçar handoff.

**Correção:**
1. Verificar a lógica `ai_node_fallback_count` -- após 2 fallbacks consecutivos no mesmo nó, forçar `flowExit: true` com handoff
2. A mensagem "Não consegui resolver por aqui" NÃO deve ser enviada sem garantir que o cliente será transferido

### BUG 4: Saque tratado como dúvida informativa (MODERADO)
**Conversa afetada:** Lucas (39eaa4b5)

**O que aconteceu:**
- Cliente disse: "Já se faz 9 dias que solicitei o saque do meu saldo e até agora não recebi..."
- IA respondeu: **"Posso ajudar com sua dúvida financeira! Como posso te ajudar?"** (fallback informativo)
- Deveria ter disparado OTP por ser `isFinancialActionRequest` (cobrança sobre saque)

**Causa raiz:** O fallback na linha 7400 (`isFinancialRequest`) captura o caso como dúvida. O `isWithdrawalRequest` pode não ter matcheado porque "solicitei o saque" não está nos patterns, ou o fallback foi ativado ANTES do porteiro financeiro.

**Correção:** Revisar `WITHDRAWAL_PATTERNS` para incluir variações como "solicitei o saque", "saque não recebi", "saque pendente".

### BUG 5: Érika redirecionada ao comercial repetidamente (MODERADO)
**Conversa afetada:** Érika (b0605698)

**O que aconteceu:**
- Cliente deu email, IA respondeu "Como você ainda não é nosso cliente, vou te direcionar para nosso time Comercial"
- Mas a cliente **é** cliente -- fez compra e quer devolução
- Isso significa que `verify-customer-email` não encontrou o email, mas a cliente é real

**Causa raiz:** O email pode não estar cadastrado na tabela contacts ou a busca é case-sensitive. O fluxo assume que "email não encontrado = não é cliente", mas o contato pode existir com variação de email.

**Correção:** Após "não encontrado", em vez de redirecionar ao comercial, a IA deveria oferecer alternativas ("Você tem outro email?") ou transferir ao financeiro diretamente.

---

## Plano de Correções (Prioridade)

### Correção A -- Eliminar falso positivo de OTP (BUG 1)
- Remover `hasFirstContactOTPPending` do cálculo de `hasOTPPendingContext`
- Contexto de OTP pendente deve depender APENAS de `hasAwaitingOTP` ou `hasRecentOTPPending` (flags reais de que um OTP foi enviado)

### Correção B -- Anti-loop com handoff obrigatório (BUGS 2 e 3)
- Após `contract_violation_blocked`, incrementar `ai_node_fallback_count`
- Se `ai_node_fallback_count >= 2` no mesmo nó: forçar `flowExit: true` com mensagem humanizada de transferência
- A mensagem "Não consegui resolver por aqui" deve ser substituída por transferência efetiva

### Correção C -- Saudação repetida (BUG 2)
- A mensagem "Olá! Sou [Persona]..." (saudação do nó) deve ser enviada **apenas 1 vez** por nó
- Verificar se o `ai_node_current_id` já é o nó atual antes de enviar saudação

### Correção D -- Patterns de saque expandidos (BUG 4)
- Adicionar ao `WITHDRAWAL_PATTERNS`: "solicitei o saque", "saque pendente", "saque não caiu", "saque há \d+ dias", "saque e até agora"

### Correção E -- Fluxo de email não encontrado (BUG 5)
- Quando `verify-customer-email` retorna não encontrado em contexto financeiro, perguntar "Você tem outro email?" antes de redirecionar ao comercial

### Deploy
- Redeploiar `ai-autopilot-chat` com todas as correções

