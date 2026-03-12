

# Auditoria Completa — Status Final

## Resultado: 95% OK — 1 bug funcional, 2 issues menores

---

## BUG: Consultor sem `consultant_id` → mensagem ignorada

**Arquivo:** `process-chat-flow/index.ts`, linhas 2237-2248

Quando o cliente diz "quero falar com meu consultor" mas **nao tem `consultant_id`**, o codigo seta `consultorIntentMatch = false` (linha 2240). Porem, nenhuma outra flag e ativada — `supportIntentMatch` nao captura termos de consultor (regex diferente). Resultado: a mensagem e tratada como interacao normal da IA e o pedido do cliente e **silenciosamente engolido**.

**Correção:** Quando `consultorIntentMatch` vira `false` por falta de consultant, forcar `supportIntentMatch = true` (ou criar flag dedicada) para rotear a conversa para suporte, e salvar `ai_exit_intent = 'suporte'`.

---

## Issue menor 1: Sem log `ai_blocked_support`

Todas as 4 outras intencoes (financeiro, cancelamento, comercial, consultor) tem blocos de logging que inserem em `ai_events`. `supportIntentMatch` so tem um `console.log` — nao registra evento no banco.

**Correção:** Adicionar bloco de logging identico para `supportIntentMatch` com `event_type: 'ai_blocked_support'`.

---

## Issue menor 2: `delete collectedData.__ai` redundante

Linhas 2274, 2301, 2328, 2356 — cada intent block faz `delete collectedData.__ai` individualmente. Linha 2490 faz o mesmo delete no bloco geral de exit. Nao causa bug (double-delete e seguro), mas e codigo duplicado.

**Correção opcional:** Remover os deletes individuais e confiar no delete da linha 2490.

---

## O que esta 100% correto

| Componente | Status |
|---|---|
| AIResponseNode — 6 handles (default, financeiro, cancelamento, comercial, suporte, consultor) | OK |
| BehaviorControlsSection — 5 toggles de intencao + badges | OK |
| ChatFlowEditor — defaults `false` para todos os forbid flags | OK |
| findNextNode — hierarquia path → ai_exit → default → any | OK |
| Desambiguacao financeira (regex + prompt IA) | OK |
| Desambiguacao cancelamento (regex + prompt IA) | OK |
| Desambiguacao comercial (regex + prompt IA) | OK |
| Desambiguacao consultor (regex + prompt IA) | OK |
| ai_exit_intent auto-save para todas as 6 intencoes | OK |
| Handoff fallback quando nextNode=null | OK |
| Trava comercial dupla (process-chat-flow + ai-autopilot-chat) | OK |
| forbidCancellation independente de forbidFinancial | OK |
| keywordMatch → suporte, aiExitForced → default | OK |
| Edge function `process-chat-flow` deployada e funcionando | OK |
| Edge function `ai-autopilot-chat` com prompts de desambiguacao | OK |
| Propagacao dos 5 forbid flags na resposta aiNodeActive | OK |

---

## Plano de Correção (3 edits, 1 arquivo)

**Arquivo:** `supabase/functions/process-chat-flow/index.ts`

1. **Linha 2240:** Apos setar `consultorIntentMatch = false`, adicionar logica para forcar roteamento para suporte
2. **Apos linha 2197:** Adicionar bloco de logging `ai_blocked_support` para `supportIntentMatch`
3. **Linhas 2274, 2301, 2328, 2356:** Remover `delete collectedData.__ai` redundantes (opcional)

