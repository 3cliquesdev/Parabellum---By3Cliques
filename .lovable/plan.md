

# Diagnóstico: Modo Teste Chamando 2 Fluxos

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Problema

Existem **dois componentes separados** na interface que permitem iniciar fluxos na mesma conversa:

1. **TestModeDropdown** (header do chat) — lista rascunhos + ativos, permite iniciar qualquer um
2. **FlowPickerButton** (área do compositor de mensagem) — lista ativos + rascunhos (quando test mode ativo), permite iniciar qualquer um

Ambos estão visíveis ao mesmo tempo e mostram listas **sobrepostas** de fluxos. Quando o usuário inicia um fluxo pelo TestModeDropdown, o FlowPickerButton continua disponível para iniciar outro, criando **dois estados ativos simultâneos**.

Além disso, o `FlowPickerButton` verifica `hasActiveFlow` para bloquear, mas o `TestModeDropdown` **não faz essa verificação** — ele cancela o fluxo ativo e inicia um novo, mas se o cancelamento não completar antes do segundo clique, dois estados são criados.

## Solução Proposta

### Consolidar a funcionalidade em um único ponto

| Mudança | Arquivo | Descrição |
|---|---|---|
| Remover lista de fluxos do TestModeDropdown | `TestModeDropdown.tsx` | Manter apenas o toggle de modo teste. Remover seções de "Rascunhos" e "Ativos" |
| Centralizar início de fluxos no FlowPickerButton | `FlowPickerButton.tsx` | Já possui validação de `hasActiveFlow`. É o local correto |
| Bloquear FlowPickerButton durante fluxo ativo | `FlowPickerButton.tsx` | Já implementado via prop `hasActiveFlow` |

### Detalhamento

**TestModeDropdown.tsx** — simplificar para apenas toggle:
- Remover imports: `useChatFlows`, `useActiveFlowState`, `supabase`, `Workflow`, `Play`
- Remover `handleStartFlow`, `draftFlows`, `activeFlows`
- Manter apenas o `DropdownMenuItem` do toggle on/off
- Resultado: componente limpo, sem sobreposição de funcionalidade

**FlowPickerButton.tsx** — já é o ponto correto:
- Já lista ativos e rascunhos (quando `isTestMode`)
- Já verifica `hasActiveFlow` antes de iniciar
- Já mostra badges de "Rascunho"
- Nenhuma mudança necessária

### Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — funcionalidade de iniciar fluxos permanece no FlowPickerButton |
| Upgrade | Sim — elimina duplicação e fonte de bugs |
| Kill Switch | Preservado |
| Rollback | Restaurar o TestModeDropdown com as seções de fluxo |

