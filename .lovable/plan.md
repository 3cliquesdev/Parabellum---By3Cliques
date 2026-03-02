

# Diagnóstico: Conversa #4168E4DC parou no meio do Master Flow

Analisei o projeto atual e sigo as regras da base de conhecimento.

## O que aconteceu

A conversa seguiu o Master Flow corretamente até o nó "Múltipla Escolha" (Pedidos/Sistema/Acesso/Outros). O cliente respondeu "1" (Pedidos), mas o fluxo travou e a conversa caiu em `waiting_human` sem avançar.

**Causa raiz**: o crash do `deliverFlowMessage is not defined` que já corrigimos na sessão anterior. Esta conversa foi afetada **antes** do fix ser deployado.

## Problema adicional: edges duplicadas no fluxo

Ao analisar o `flow_definition`, cada opção do nó `ask_options` tem **duas edges** saindo do mesmo handle — uma para um nó `message` ("Trava") e outra para um nó `condition`. Exemplo da opção 1:

```text
opt_1769459784782 → 1772136527156 (message "Trava")
opt_1769459784782 → 1772196913050 (condition)
```

O `findNextNode` usa `edges.find()` que retorna apenas a primeira match. O comportamento depende da ordem dos edges no JSON — isso é frágil e pode causar caminhos inesperados.

## Plano de correção

### 1. Resetar conversa #4168E4DC
SQL para devolver ao nó de IA (`ai_response`) com `ai_mode: autopilot` e `status: active`, para que a próxima mensagem do cliente seja processada pela IA normalmente via Master Flow.

### 2. Proteger `findNextNode` contra edges duplicadas
No `process-chat-flow/index.ts`, quando `ask_options` encontra múltiplas edges do mesmo `sourceHandle`, priorizar nós de conteúdo (`message`, `transfer`, `ai_response`) sobre nós lógicos (`condition`, `input`, `start`). Isso garante comportamento determinístico independente da ordem no JSON.

### Arquivos editados
- `supabase/functions/process-chat-flow/index.ts` — hardening do `findNextNode`
- Migration SQL — reset da conversa #4168E4DC

### Sem risco de regressão
- O fix do `findNextNode` apenas adiciona priorização quando existem edges duplicadas. Fluxos com edges únicas (o caso normal) não são afetados.
- O reset da conversa restaura o estado para que o Master Flow reassuma controle.

