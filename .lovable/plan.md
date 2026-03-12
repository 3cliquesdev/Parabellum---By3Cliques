

# Auditoria Completa v4: process-chat-flow — Últimos Bugs Remanescentes

Após reler as 5048 linhas com todos os 21 fixes anteriores (1-9, A-F, G-N), encontrei **3 bugs** restantes.

---

## Bug O: `masterContactData` nunca declarado — RuntimeError no Master Flow end_actions

**Local**: L4664, L4679-4680
**Impacto**: No fix do Bug K (Master Flow end → end_actions), os handlers de `create_ticket` e `add_tag` usam `masterContactData?.id` para `contactId` e `contact_id`. Mas essa variável **nunca é declarada** neste escopo. A variável correta é `contactData` (declarada em L4300). Isso causa um `ReferenceError` em runtime, silenciando completamente a criação de tickets e tags no Master Flow end.

**Fix**: Substituir `masterContactData` por `contactData` nas 3 ocorrências (L4664, L4679, L4680).

---

## Bug P: OTP not_customer → end NÃO executa end_actions

**Local**: L1763-1815
**Impacto**: Quando o OTP retorna `not_customer` e o `resolvedNode` é do tipo `end`, o motor simplesmente renderiza a mensagem genérica e retorna `useAI: resolvedNode.type === 'ai_response'` — sem setar `status: 'completed'`, sem `completed_at`, e sem executar `end_actions`. O handler de `transfer` foi adicionado no Bug E, mas o handler de `end` está ausente neste path.

Compare: OTP max_attempts (L2051-2100) já tem handler `end` completo (Bug H). OTP not_customer NÃO tem.

**Fix**: Adicionar bloco `if (resolvedNode.type === 'end')` antes do retorno genérico (L1804), com `status: 'completed'`, `completed_at`, e execução de `end_actions` (create_ticket + add_tag).

---

## Bug Q: OTP success → end NÃO executa end_actions

**Local**: L1902-1963
**Impacto**: Idêntico ao Bug P mas no path de OTP verificado com sucesso. Quando `resolvedNode` é `end`, o motor cai no retorno genérico (L1957) sem executar end_actions. O handler de `transfer` (L1914) e `ai_response` (L1946) existem, mas `end` está ausente.

**Fix**: Adicionar bloco `if (resolvedNode.type === 'end')` antes do retorno genérico, com end_actions completas.

---

## Resumo

| Bug | Local | Tipo | Impacto | Complexidade |
|-----|-------|------|---------|-------------|
| O | Master Flow end_actions L4664,4679 | RuntimeError | Tickets/tags silenciosamente falham | Trivial (3 substituições) |
| P | OTP not_customer → end L1804 | Estado/Ação | end_actions ignoradas, status incorreto | Médio |
| Q | OTP success → end L1957 | Estado/Ação | end_actions ignoradas, status incorreto | Médio |

## Cobertura final após fixes O/P/Q

Todos os 13 tipos de nó, em todas as 5 zonas de execução + 3 sub-paths OTP, estarão 100% cobertos:

```text
                    Main  Generic  Master  Manual  Trigger  OTP-nc  OTP-ok  OTP-max
message              ✅     ✅      ✅      ✅      ✅       —       —       —
ask_*                ✅     ✅      ✅      ✅      ✅       —       —       —
ask_options          ✅     ✅      ✅      ✅      ✅       —       —       —
condition/v2         ✅     ✅      ✅      ✅      ✅       ✅      ✅      ✅
ai_response          ✅     ✅      ✅      ✅      ✅       ✅      ✅      ✅
verify_customer_otp  ✅     ✅      ✅L     ✅      ✅M      —       —       —
validate_customer    ✅     ✅      ✅      ✅      ✅D      ✅      ✅      ✅
fetch_order          ✅     ✅      ✅B     ✅C     ✅D      ✅      ✅      ✅
transfer             ✅     ✅      ✅J     ✅      ✅N      ✅E     ✅F     ✅G
end                  ✅     ✅      ✅K→O   ✅      ✅N      ✅→P    ✅→Q    ✅H
create_ticket        ✅     ✅      ✅      ✅      ✅       —       —       —
```

## Arquivo

- `supabase/functions/process-chat-flow/index.ts` — 3 edições (Bug O: 3 substituições, Bug P: 1 bloco, Bug Q: 1 bloco)

