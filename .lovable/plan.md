

# Unificar Teste de Fluxo em Um Unico Clique

## Problema Atual

O usuario precisa de **dois cliques em dois botoes diferentes** para testar um fluxo de rascunho:
1. Clicar no botao "Testar" (header) para ativar o modo teste
2. Procurar e clicar no botao "Workflow" (composer) para selecionar o fluxo

Isso e confuso e pouco intuitivo. O usuario espera que ao clicar em "Testar", ja possa escolher o fluxo.

## Solucao Proposta

Transformar o botao "Testar" em um **dropdown com duas funcoes**:
- Toggle do modo teste (liga/desliga)
- Lista de fluxos de rascunho para iniciar diretamente

### Comportamento do Botao "Testar" (novo)

**Clique no botao principal:** Toggle do modo teste (comportamento atual preservado)

**Seta/dropdown ao lado:** Abre lista de fluxos disponíveis para teste (rascunhos + ativos), similar ao FlowPickerButton mas posicionado no header.

**OU alternativa mais simples:**

Transformar o botao "Testar" em um **DropdownMenu** que:
1. Primeiro item: "Ativar/Desativar Modo Teste" (toggle)
2. Separador
3. Secao "Iniciar Fluxo de Rascunho" com lista dos fluxos inativos
4. Secao "Iniciar Fluxo Ativo" com lista dos fluxos ativos

Ao selecionar um fluxo de rascunho, o sistema:
- Ativa o modo teste automaticamente (se nao estiver ativo)
- Inicia o fluxo selecionado
- Tudo em um unico clique

### Alteracoes Tecnicas

**Arquivo: `src/components/ChatWindow.tsx`**

- Substituir o `Button` simples do teste (linhas 515-534) por um `DropdownMenu`
- Importar `useChatFlows` para listar os fluxos disponiveis
- Importar `useActiveFlowState` para verificar se ja ha fluxo ativo
- Ao selecionar um fluxo rascunho:
  1. Se `isTestMode` for `false`, chamar `toggleTestMode(true)` primeiro
  2. Depois chamar `supabase.functions.invoke("process-chat-flow", { body: { conversationId, flowId, manualTrigger: true, bypassActiveCheck: true } })`
- Se ja houver fluxo ativo (`activeFlow` nao nulo), mostrar toast bloqueando

**Arquivo: `src/components/inbox/FlowPickerButton.tsx`**

- Manter como esta (sem mudancas) — ele continua funcional no composer para quem preferir usar por la

### UX do Dropdown

```text
[🧪 Testar v]
  |
  +-- [Toggle] Modo Teste: Ativo/Inativo
  |
  +-- ---- separador ----
  |
  +-- Rascunhos (teste):
  |     > Fluxo Vendas v2
  |     > Fluxo Suporte Beta
  |
  +-- ---- separador ----
  |
  +-- Ativos:
  |     > Fluxo Principal
  |     > Fluxo Suporte
```

### Logica de Seguranca (preservada)

- Dropdown so aparece para `hasPermission('inbox.test_mode') && hasFullAccess(role)`
- Fluxos de rascunho enviam `bypassActiveCheck: true` (validacao tripla no backend)
- Se ha fluxo ativo, bloqueia inicio de outro
- Modo teste e ativado automaticamente ao selecionar rascunho

### Impacto

- Zero regressao: FlowPickerButton no composer continua funcionando
- Upgrade de UX: usuario testa rascunho com um unico clique no lugar obvio
- Backend inalterado: mesma Edge Function, mesmas validacoes
- ActiveFlowIndicator continua mostrando qual fluxo esta rodando

