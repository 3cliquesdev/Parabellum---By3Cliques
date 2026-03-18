

# Auditoria V16: Conversa #08277AB5

## Timeline Confirmada

| Hora | Evento | Status |
|---|---|---|
| 15:01-15:02 | Menu produto + assunto → Financeiro | ✅ OK |
| 15:02-15:04 | OTP enviado e validado com sucesso | ✅ OK |
| 15:04:06 | "Agora posso te ajudar" (pós-OTP) | ✅ OK |
| 15:05:54 | "Então quero sacar o valor..." | ❌ Deveria coletar dados do ticket |
| 15:06:31 | "Não consegui resolver por aqui." | ❌ Fallback em vez de coleta |
| 15:06:32 | "O que prefere fazer?" (SEM opções) | ❌ **BUG 31** |
| 15:10:36 | "Quero sacar meu dinheiro" | ❌ Preso no escape node |
| 15:10:39 | Menu retry COM opções (1-Voltar, 2-Atendente) | ✅ Retry funciona |

## BUG 31 (CRITICO): Escape Node Enviado SEM Opções

**O que aconteceu:** `node_escape_financeiro` (ask_options) tem `message: "O que prefere fazer?"` e `options: [{↩ Voltar ao menu}, {👤 Falar com atendente}]`. A mensagem foi enviada como texto puro, sem as opções formatadas.

**Causa raiz:** O `process-chat-flow` insere o `fallback_message` diretamente no DB (L3697), e depois retorna `{ response: "O que prefere fazer?", options: [...] }`. O caller (webhook re-invocation L1910+) formata com `formatOptionsAsText()` e envia via `send-meta-whatsapp`. MAS o fallback_message inserido no DB (L3697) NÃO é enviado via WhatsApp — é apenas um DB insert. Então:

1. O fallback ("Não consegui resolver por aqui.") é salvo no DB mas NÃO enviado ao WhatsApp
2. O webhook envia `"O que prefere fazer?" + options` via send-meta-whatsapp

Porém no DB temos os dois como mensagens separadas. Há uma duplicação: o `ai-autopilot-chat` (L3504) salva a resposta no DB **antes** do webhook re-invocar o flow. O resultado é que a mensagem "O que prefere fazer?" pode ter sido salva sem options pelo ai-autopilot-chat, e depois o webhook tentou enviar com options mas o DB já tinha a versão sem.

**Fix:** No `process-chat-flow` L3697, quando o fallback_message é inserido, também incluir as opções do próximo nó (se for `ask_options`) na mesma mensagem. Alternativamente, combinar fallback + escape message + options em uma ÚNICA resposta retornada ao caller.

## BUG 32 (CRITICO): Após OTP Verificado, Saque Não Coletou Dados do Ticket

**O que aconteceu:** Após OTP verificado com sucesso, cliente pediu "quero sacar" mas a IA não iniciou a coleta de dados (pix_key, bank, reason, amount). Em vez disso, o `ai_transfer` foi disparado com `exit_reason: ai_handoff_exit` após apenas 4 interações (max=15).

**Causa raiz:** O nó `node_ia_financeiro` tem `objective: "Validar identidade do cliente via OTP, identificar tipo (saque/reembolso), coletar dados completos..."`. Após OTP, a IA deveria entrar no modo de coleta. Mas ela emitiu `[[FLOW_EXIT]]` porque não encontrou artigos na KB sobre "sacar o valor da minha conta do seu armazem" (zero_confidence). A IA não entendeu que deveria COLETAR os dados, não buscar na KB.

**Fix:** Atualizar o `objective` do nó financeiro para ser mais explícito pós-OTP: após verificação, a IA deve COLETAR os campos (pix_key, bank, reason, amount) via conversa e criar ticket — NÃO buscar na KB. Adicionar instrução no `context_prompt` para priorizar coleta sobre KB quando OTP já verificado.

## Plano de Correção

### 1. Bug 31 — Combinar fallback + escape message + options em resposta única

No `process-chat-flow` L3693-3710, ao invés de inserir o fallback_message separadamente no DB, acumulá-lo como `extraMessage` para ser combinado com a resposta do próximo nó. Isso garante que o caller receba UMA resposta com tudo:

```
"Não consegui resolver por aqui.\n\nO que prefere fazer?\n\n1️⃣ ↩ Voltar ao menu\n2️⃣ 👤 Falar com atendente"
```

Remover o `supabaseClient.from('messages').insert()` do fallback (L3697) e passar o fallback como parte do `extraMessages` array que já existe no flow (L4598).

### 2. Bug 32 — Atualizar objective do nó financeiro para priorizar coleta pós-OTP

Via migration SQL, atualizar o `objective` do `node_ia_financeiro` no fluxo `cafe2831`:

```
Objetivo: Após OTP verificado, COLETAR dados financeiros via conversa:
1. Tipo (saque ou reembolso)
2. Chave PIX ({{pix_key}})
3. Banco ({{bank}})
4. Motivo ({{reason}})
5. Valor ({{amount}})
Após coletar TODOS os dados, confirmar com o cliente e criar ticket com create_ticket.
NÃO buscar na KB para pedidos de saque/reembolso — a ação é coleta de dados.
```

### 3. Anti-exit pós-OTP

No `ai-autopilot-chat`, quando `otpVerified === true` e `smart_collection_fields` está configurado, suprimir `[[FLOW_EXIT]]` e forçar permanência no nó para completar a coleta. Adicionar regra no prompt:

```
APÓS VERIFICAÇÃO OTP: Sua tarefa é COLETAR os dados financeiros listados no objetivo.
NÃO emita [[FLOW_EXIT]]. Permaneça no nó até coletar todos os campos necessários.
```

### Resumo de Arquivos

1. **`supabase/functions/process-chat-flow/index.ts`** — L3693-3710: remover DB insert do fallback, acumular como extraMessage
2. **`supabase/functions/ai-autopilot-chat/index.ts`** — Adicionar regra anti-exit pós-OTP quando smart_collection_fields ativo
3. **Migration SQL** — Atualizar objective do `node_ia_financeiro` no fluxo `cafe2831`

