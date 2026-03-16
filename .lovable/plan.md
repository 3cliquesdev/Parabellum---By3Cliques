

# Ticket no Nó IA + Departamento + Continuidade do Fluxo

## Problema Atual
1. O nó `create_ticket` **não tem campo de departamento** no editor — o `department_id` já é suportado no motor mas nunca é preenchido pela UI
2. O nó `ai_response` não tem opção de criar ticket como ação
3. Após criar ticket, o fluxo **transfere direto** em vez de continuar para o próximo nó (ex: escape menu "Voltar ao menu" / "Falar com atendente")

## Solução

### 1. Adicionar campo Departamento ao nó `create_ticket` (Editor)
**Arquivo:** `src/components/chat-flows/ChatFlowEditor.tsx` (~L1362-1441)

- Adicionar um `<Select>` de departamento usando `useDepartments({ activeOnly: true })` (mesmo padrão do `TransferPropertiesPanel`)
- Salvar em `department_id` e `department_name` no node data
- O motor já lê `nextNode.data?.department_id` — zero alteração no backend

### 2. Adicionar `end_action: create_ticket` ao nó `ai_response`
**Arquivo:** `src/components/chat-flows/AIResponsePropertiesPanel.tsx`

- Adicionar uma seção "Ação ao Sair" com select: `none` | `create_ticket`
- Quando `create_ticket` selecionado, exibir os campos de configuração (assunto, descrição, categoria, prioridade, departamento, `use_collected_data`)
- O motor já suporta `end_action: create_ticket` em nós — precisa verificar se o bloco de handoff do `ai_response` no `process-chat-flow` executa `end_action`

### 3. Garantir continuidade do fluxo após `create_ticket`
**Arquivo:** `supabase/functions/process-chat-flow/index.ts`

O nó `create_ticket` já funciona como **auto-advance** (L2798-2811) — ele cria o ticket e avança para o próximo nó conectado. O fluxo **já continua** normalmente.

O problema real é que no Master Flow atual, após o `create_ticket` o próximo nó conectado é um `transfer`. A solução é **visual/configuração**: o usuário conecta o `create_ticket` → `ask_options` (escape menu) em vez de → `transfer`.

Portanto, nenhuma alteração no motor é necessária para esse ponto — é uma questão de como o fluxo está desenhado.

### 4. Defaults do nó `create_ticket`
**Arquivo:** `src/components/chat-flows/ChatFlowEditor.tsx` (~L298-304)

Adicionar `department_id: null, department_name: null` nos defaults.

## Resumo de Alterações

| Arquivo | Alteração |
|---------|-----------|
| `ChatFlowEditor.tsx` | Adicionar select de departamento no painel do `create_ticket` + defaults |
| `AIResponsePropertiesPanel.tsx` | Adicionar seção "Ação ao Sair" com opção `create_ticket` + campos |
| `AIResponseNode.tsx` | Adicionar interface + badge visual para `end_action` |
| `process-chat-flow/index.ts` | Verificar se handoff do `ai_response` executa `end_action` (se não, adicionar) |

