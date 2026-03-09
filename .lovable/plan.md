

# Plano: Ativar o botão "Testar" do Editor de Fluxo com teste real

## Problema Atual
O botão "Testar" no editor de fluxo (linha 183-191 de `ChatFlowEditorPage.tsx`) abre um `ChatFlowSimulator` — um simulador **local/frontend** que apenas percorre nós no browser. Não testa o motor real (`process-chat-flow`), não envia mensagens, não valida OTP, não cria tickets. É essencialmente inútil para validação real.

## Solução
Transformar o botão "Testar" para abrir um **diálogo de teste real**, similar ao `TestModeDropdown` do inbox, que:

1. **Salva o fluxo automaticamente** antes de iniciar (para garantir que o teste usa a versão atual)
2. **Permite escolher uma conversa existente** ou criar uma conversa de teste
3. **Ativa o Test Mode** (`is_test_mode: true`, `ai_mode: autopilot`) na conversa escolhida
4. **Invoca `process-chat-flow`** com `manualTrigger: true` e `bypassActiveCheck: true` (já que pode ser rascunho)
5. **Redireciona para o inbox** na conversa de teste para acompanhar em tempo real

## Componentes

### 1. Novo componente `FlowTestDialog`
- Dialog modal com duas opções:
  - **Conversa existente**: busca conversas abertas e permite selecionar
  - **Nova conversa de teste**: cria conversa + contato de teste automaticamente
- Campo de busca para filtrar conversas
- Botão "Iniciar Teste" que executa a sequência atômica

### 2. Alteração em `ChatFlowEditorPage.tsx`
- Substituir `handleOpenSimulator` / `ChatFlowSimulator` pelo novo `FlowTestDialog`
- Auto-save do fluxo antes de iniciar teste
- Após iniciar, redirecionar para `/inbox` com a conversa selecionada

### 3. Fluxo de execução
```text
[Clique "Testar"]
  → Salva fluxo atual (se houver mudanças)
  → Abre FlowTestDialog
  → Usuário escolhe conversa (existente ou nova)
  → [Iniciar Teste]
    → UPDATE conversations SET is_test_mode=true, ai_mode='autopilot'
    → INVOKE process-chat-flow (flowId, manualTrigger, bypassActiveCheck)
    → Redireciona para /inbox?conversation={id}
```

### Impacto
- Remove o `ChatFlowSimulator` (simulador local) que não agrega valor
- Reutiliza a mesma lógica já validada do `TestModeDropdown`
- Zero alteração no motor de fluxos ou edge functions
- Nenhuma migração de banco necessária

