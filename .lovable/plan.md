

# Auditoria Completa do Motor de Fluxo (process-chat-flow)

## Tipos de nó auditados

| Nó | Frontend | Engine (início) | Engine (resposta) | Auto-avanço | Status |
|---|---|---|---|---|---|
| **message** | ✅ OK | ✅ Manual trigger OK | 🔴 BUG: fica preso | ✅ Manual / 🔴 Main path | ⚠️ |
| **ask_name** | ✅ OK | ✅ OK | ✅ Validação name OK | N/A | ⚠️ |
| **ask_email** | ✅ OK | ✅ OK | ✅ Validação email OK | N/A | ⚠️ |
| **ask_phone** | ✅ OK | ✅ OK | ✅ Validação phone OK | N/A | ⚠️ |
| **ask_cpf** | ✅ OK | ✅ OK | ✅ Validação CPF OK | N/A | ⚠️ |
| **ask_text** | ✅ OK | ✅ OK | ✅ Validação text OK | N/A | ⚠️ |
| **ask_options** | ✅ OK | ✅ OK | ✅ Validação estrita OK | N/A | ⚠️ |
| **condition** (clássico) | ✅ OK | ✅ Avalia + traversa | ✅ Avalia + path | ✅ Auto-traverse | ✅ |
| **condition** (multi-regra) | ✅ OK | ✅ Aguarda input | ✅ evaluateConditionPath | ✅ Auto-traverse | ✅ |
| **condition** (inatividade) | ✅ OK | ✅ Aguarda timeout | ✅ Cron + path | ✅ | ✅ |
| **ai_response** | ✅ OK | ✅ aiNodeActive=true | ✅ Persistente + anti-dup | N/A | ✅ |
| **transfer** | ✅ OK | ✅ Manual trigger OK | ✅ Status=transferred | N/A | ✅ |
| **end** | ✅ OK | N/A | ✅ Status=completed | N/A | ✅ |
| **fetch_order** | ✅ OK | N/A | ✅ Busca + salva dados | ⚠️ Parcial | ⚠️ |

---

## 🔴 BUG 1 — CRÍTICO: Nós `message` não fazem auto-avanço no caminho principal

**Cenário**: ask_name → **message** ("Obrigado, {{name}}!") → ask_email

**O que acontece hoje**:
1. Usuário responde o nome
2. Engine encontra próximo nó = `message`, retorna o texto
3. Estado fica parado no nó `message`
4. Usuário precisa enviar **uma mensagem extra** para avançar
5. Essa mensagem extra é "processada" pelo nó message (sem efeito) e aí sim avança para ask_email

**Impacto**: UX quebrada — o usuário não sabe que precisa enviar algo após uma mensagem informativa.

**Nota**: O manual trigger (linhas 886-954) JÁ tem auto-avanço para message. O caminho principal (linhas 1509-1533) NÃO tem.

**Correção**: Após linhas 1509-1517, quando `nextNode.type === 'message'`, entregar a mensagem E continuar avançando até encontrar um nó que colete input (ask_*, ai_response, transfer, end). Replicar a lógica de auto-avanço que já existe no manual trigger.

---

## 🟡 BUG 2 — MÉDIO: Status `waiting_input` não é definido nas transições do caminho principal

**Linha 1511-1517**: O `update` do state NÃO inclui `status`. Para nós `ask_*`, o status deveria ser `waiting_input`.

**Impacto**: Semanticamente incorreto. Funciona porque a query filtra por `['active', 'waiting_input', 'in_progress']`, mas pode causar problemas em relatórios ou lógica futura.

**Correção**: Adicionar `status: nextNode.type.startsWith('ask_') || nextNode.type === 'condition' ? 'waiting_input' : 'active'` ao update.

---

## 🟡 BUG 3 — MÉDIO: Typo `ask_input` no auto-avanço do manual trigger

**Linha 931**: `advanceNode.type === 'ask_input'` — esse tipo NÃO existe. Os tipos corretos são: `ask_name`, `ask_email`, `ask_phone`, `ask_cpf`, `ask_text`, `ask_options`.

**Impacto**: Nós `ask_name`, `ask_email`, `ask_phone`, `ask_cpf`, `ask_text` recebem status `active` em vez de `waiting_input` quando alcançados via auto-avanço no manual trigger.

**Correção**: Mudar para `advanceNode.type.startsWith('ask_')`.

---

## 🟢 BUG 4 — BAIXO: `fetch_order` pós-condição não faz loop completo

**Linhas 1382-1408**: Após `fetch_order → condition`, se a condição leva a outro nó não-conteúdo (outra condition, input), o engine para. Faz apenas 1 nível.

**Impacto**: Fluxos com `fetch_order → condition → condition → message` podem ficar presos no segundo condition.

**Correção**: Reutilizar o loop de auto-traverse (enquanto `['condition','input','start']`) após o fetch_order, igual ao loop principal (linhas 1311-1363).

---

## Plano de implementação

### Arquivo: `supabase/functions/process-chat-flow/index.ts`

**Fix 1** (Crítico) — Auto-avanço para message nodes no caminho principal (após linha 1517):
- Quando `nextNode.type === 'message'`: entregar mensagem, e continuar avançando em loop até encontrar nó de input/content
- Entregar cada mensagem intermediária ao usuário (concatenar ou enviar em sequência)
- Parar quando encontrar: `ask_*`, `ai_response`, `transfer`, `end`, ou null

**Fix 2** (Médio) — Adicionar `status` ao update na linha 1511-1517:
```typescript
status: nextNode.type.startsWith('ask_') || nextNode.type === 'condition' 
  ? 'waiting_input' : 'active'
```

**Fix 3** (Médio) — Corrigir typo na linha 931:
```typescript
// De:
advanceNode.type === 'ask_options' || advanceNode.type === 'ask_input'
// Para:
advanceNode.type.startsWith('ask_')
```

**Fix 4** (Baixo) — Loop completo após fetch_order (linhas 1382-1408):
- Substituir a verificação single-step por um while loop idêntico ao auto-traverse principal

### Resultado
- Fluxos com nós `message` intermediários funcionam sem exigir input extra
- Status semântico correto em todas as transições
- Todos os tipos de nó cobertos e testados para produção

