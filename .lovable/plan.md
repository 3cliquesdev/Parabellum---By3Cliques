
# Auditoria Completa v2: process-chat-flow — Verificação Bloco a Bloco

Após reler as 4668 linhas do motor, com os 9 fixes anteriores já aplicados, encontrei **6 novos problemas** que ainda podem causar travamentos ou comportamentos incorretos.

---

## Bug A: Main auto-advance loop (L3588) NÃO inclui `validate_customer` nem `fetch_order`

**Arquivo**: `process-chat-flow/index.ts` ~L3588
**Contexto**: O loop principal de auto-avanço (`while (nextNode && (nextNode.type === 'message' || nextNode.type === 'create_ticket'))`) só processa `message` e `create_ticket`. O fix do Bug 8 anterior foi aplicado APENAS no handler genérico `ask_*` (L2178-2264), mas o loop PRINCIPAL (L3588) que roda após `ask_options`, `condition`, `condition_v2` e `ai_response` continua sem cobrir esses tipos.

**Impacto**: Se `ask_options → message → validate_customer → condition → ask_text`, o loop para no `validate_customer` e o estado fica preso sem executá-lo.

**Fix**: Expandir o `while` em L3588 para incluir `validate_customer` e `fetch_order`, executando-os inline (igual ao handler genérico).

---

## Bug B: Master Flow traversal (L4167) NÃO inclui `fetch_order` no `NO_CONTENT` set

**Arquivo**: `process-chat-flow/index.ts` ~L4094
**Contexto**: `const NO_CONTENT = new Set(['input', 'start', 'condition', 'condition_v2', 'validate_customer'])` — `fetch_order` não está incluído. Se o Master Flow tem `start → fetch_order → condition → ai_response`, o loop para no `fetch_order` e tenta entregá-lo como um nó de conteúdo (sem mensagem).

**Fix**: Adicionar `'fetch_order'` ao set `NO_CONTENT` e incluir handler inline de `fetch_order` no loop de travessia Master Flow (similar ao `validate_customer` que já existe em L4215-4291).

---

## Bug C: Manual trigger traversal (L940) NÃO inclui `fetch_order` no `NO_CONTENT_MANUAL` set

**Arquivo**: `process-chat-flow/index.ts` ~L940
**Contexto**: `const NO_CONTENT_MANUAL = new Set(['input', 'start', 'condition', 'condition_v2', 'validate_customer'])` — mesmo problema do Bug B, mas no caminho manual.

**Fix**: Adicionar `'fetch_order'` ao set + handler inline.

---

## Bug D: Trigger match traversal (L4513) NÃO inclui `validate_customer` nem `fetch_order`

**Arquivo**: `process-chat-flow/index.ts` ~L4513
**Contexto**: O loop de travessia para fluxos disparados por trigger (`while (attempts < maxAttempts && (trigCurrentNode.type === 'input' || trigCurrentNode.type === 'condition' || trigCurrentNode.type === 'condition_v2'))`) não inclui `validate_customer` nem `fetch_order`. Se um trigger match cai em um fluxo que começa com `start → validate_customer → condition`, o loop para no `validate_customer`.

**Fix**: Expandir a condição do while para incluir `validate_customer` e `fetch_order` com handlers inline.

---

## Bug E: OTP not_customer path (L1730-1776) — Transfer NÃO chama `transition-conversation-state`

**Arquivo**: `process-chat-flow/index.ts` ~L1761-1776
**Contexto**: Quando o OTP retorna `not_customer` e o próximo nó resolvido é `transfer`, o motor marca `status: 'transferred'` e retorna `transfer: true`, mas NÃO chama a edge function `transition-conversation-state`. O mesmo problema do Bug 6 anterior, mas num path diferente (OTP not_customer). Todos os outros paths de transfer JÁ foram corrigidos.

**Fix**: Adicionar chamada `transition-conversation-state` antes do return no bloco L1762-1776, replicando o padrão do transfer principal (L3496-3518).

---

## Bug F: OTP success path (L1887-1901) — Transfer NÃO chama `transition-conversation-state`

**Arquivo**: `process-chat-flow/index.ts` ~L1887-1901
**Contexto**: Idêntico ao Bug E mas no path de OTP verificado com sucesso. Se após verificação OTP bem-sucedida o próximo nó é `transfer`, o motor retorna `transfer: true` sem chamar `transition-conversation-state`.

**Fix**: Adicionar chamada `transition-conversation-state` antes do return.

---

## Resumo dos 6 fixes

| Bug | Local | Impacto | Complexidade |
|-----|-------|---------|-------------|
| A | Main auto-advance loop L3588 | Travamento em validate_customer/fetch_order | Médio |
| B | Master Flow NO_CONTENT L4094 | fetch_order não executado | Fácil |
| C | Manual trigger NO_CONTENT_MANUAL L940 | fetch_order não executado | Fácil |
| D | Trigger match traversal L4513 | validate_customer/fetch_order ignorados | Médio |
| E | OTP not_customer transfer L1761 | Conversa não transiciona corretamente | Fácil |
| F | OTP success transfer L1887 | Conversa não transiciona corretamente | Fácil |

## Nós já blindados (confirmados OK)

- **ask_options**: Matcher estrito com 4 camadas + reenvio de opções ✅
- **ask_name/email/phone/cpf/text**: Validação + save_as + auto-traverse completo ✅
- **condition (clássico)**: Cascata de handles (true/yes/1, false/no/2) ✅
- **condition_v2**: Avaliador V2 Sim/Não em TODAS as 5 zonas ✅
- **ai_response**: Persistente + intent detection + anti-loop + max_interactions ✅
- **verify_customer_otp**: Máquina de estados 4 sub-estados ✅ (exceto transfers nos paths E/F)
- **validate_customer**: Inline em 3 de 5 zonas ✅ (faltam Main loop + Trigger match)
- **fetch_order**: Inline em 2 de 5 zonas ✅ (faltam Main loop + Master + Manual + Trigger)
- **transfer**: transition-conversation-state em 4 de 6 paths ✅ (faltam OTP paths)
- **end**: end_actions em 3 de 3 paths ✅
- **create_ticket**: Idempotência via key ✅
- **message**: Auto-avanço em 3 de 3 zonas ✅

## Arquivo a editar

- `supabase/functions/process-chat-flow/index.ts` (único arquivo, 6 edições)
