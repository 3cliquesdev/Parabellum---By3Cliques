

# Auditoria Completa v3: Verificação Bloco a Bloco — 8 Bugs Remanescentes

Após reler o arquivo inteiro (4772 linhas) com todos os 15 fixes anteriores aplicados, verifiquei cada tipo de nó em cada zona de execução. Encontrei **8 bugs** que ainda podem causar inconsistências.

---

## Bug G: OTP max_attempts → transfer NÃO chama transition-conversation-state

**Local**: L2012-2029
**Impacto**: Quando OTP falha por max tentativas e o próximo nó resolvido é `transfer`, o motor apenas atualiza `current_node_id` e retorna a mensagem — NÃO chama `transition-conversation-state` e NÃO seta `completed_at`. Compare com OTP success (L1914-1943) e OTP not_customer (L1772-1802) que fazem ambos corretamente.

**Fix**: Adicionar bloco `if (resolvedNode.type === 'transfer')` com transition-conversation-state + completed_at, idêntico aos outros OTP paths.

---

## Bug H: OTP max_attempts → end NÃO executa end_actions

**Local**: L2012-2029
**Impacto**: Se OTP falha e o próximo nó é `end`, o status é setado como `active` (via cálculo genérico de `nextStatus`), NÃO como `completed`. E `end_actions` (create_ticket, add_tag) NÃO são executadas.

**Fix**: Adicionar bloco `if (resolvedNode.type === 'end')` com status `completed` + completed_at + execução de end_actions.

---

## Bug I: End após message chain NÃO executa add_tag

**Local**: L3751-3798
**Impacto**: O handler de end após auto-avanço de messages executa `create_ticket` (L3764) mas NÃO `add_tag`. O handler principal de end (L3437-3457) e o genérico (L2338-2348) executam ambos.

**Fix**: Adicionar handler `add_tag` após o bloco create_ticket em L3786, replicando o padrão do main end (L3437-3457).

---

## Bug J: Master Flow transfer NÃO chama transition-conversation-state

**Local**: L4504-4526
**Impacto**: Se o Master Flow resolve para um nó `transfer`, seta status `transferred` mas NÃO chama a edge function centralizada e NÃO define `completed_at`. A conversa fica em estado inconsistente.

**Fix**: Adicionar chamada transition-conversation-state + completed_at antes do return.

---

## Bug K: Master Flow end NÃO executa end_actions

**Local**: L4528-4547
**Impacto**: Se Master Flow resolve para `end`, seta `completed` mas NÃO executa `create_ticket` nem `add_tag`.

**Fix**: Adicionar handlers de end_actions antes do return.

---

## Bug L: Master Flow → verify_customer_otp NÃO inicializa OTP

**Local**: L4549 (handler genérico)
**Impacto**: Se Master Flow traversa até um nó `verify_customer_otp`, cai no handler genérico que retorna a mensagem mas NÃO inicializa `__otp_step` e `__otp_attempts`. A próxima mensagem do usuário encontra OTP sem estado, causando comportamento indefinido.

**Fix**: Adicionar handler dedicado para `verify_customer_otp` antes do handler genérico, igual ao do Manual Trigger (L1369-1386).

---

## Bug M: Trigger Match → verify_customer_otp NÃO inicializa OTP

**Local**: L4688-4748
**Impacto**: Mesmo problema do Bug L, mas no caminho de Trigger Match. Se um trigger dispara um fluxo que começa com OTP, o estado é criado (L4663) sem `__otp_step`.

**Fix**: Adicionar handler `verify_customer_otp` antes do handler genérico em L4747.

---

## Bug N: Trigger Match → transfer/end NÃO são tratados

**Local**: L4688-4748
**Impacto**: Se o Trigger Match resolve para `transfer` ou `end`, caem no handler genérico (L4747) que retorna como mensagem comum. Transfer não chama transition-conversation-state. End não executa end_actions nem seta completed.

**Fix**: Adicionar handlers para `transfer` (com transition-conversation-state + completed_at) e `end` (com end_actions + completed) antes do handler genérico.

---

## Resumo

| Bug | Local | Tipo | Impacto |
|-----|-------|------|---------|
| G | OTP max_attempts → transfer | Transição | Conversa não transiciona |
| H | OTP max_attempts → end | Estado | end_actions ignoradas |
| I | End após message chain | Ação | add_tag ignorada |
| J | Master Flow → transfer | Transição | Conversa não transiciona |
| K | Master Flow → end | Ação | end_actions ignoradas |
| L | Master Flow → OTP | Inicialização | OTP sem estado |
| M | Trigger Match → OTP | Inicialização | OTP sem estado |
| N | Trigger Match → transfer/end | Múltiplo | transfer/end sem lógica |

## Arquivo

- `supabase/functions/process-chat-flow/index.ts` (8 edições)

