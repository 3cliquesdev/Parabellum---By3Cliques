

# Modo Rascunho Testavel -- 4 Ajustes de Seguranca + UX

## Resumo

Implementar os 4 ajustes solicitados para que fluxos em rascunho possam ser testados com seguranca total: visibilidade condicional, validacao de role no backend, log persistente em audit_logs, e mensagens de erro claras com CTA.

## Alteracoes

### 1. Frontend -- `src/components/inbox/FlowPickerButton.tsx`

**Receber prop `isTestMode`** do SuperComposer e controlar a visibilidade dos fluxos:

- Se `isTestMode === false`: mostrar apenas fluxos ativos (comportamento atual)
- Se `isTestMode === true`: mostrar ativos + inativos, separados em duas secoes com labels "Ativos" e "Rascunhos (teste)"
- Fluxos inativos usam icone `FlaskConical` (beaker) e badge textual "Rascunho"
- Ao clicar num fluxo inativo, enviar `bypassActiveCheck: true` no body da request
- Quando nao ha fluxos (nem ativos nem rascunhos em test mode), mostrar botao desabilitado com tooltip adequado

### 2. Frontend -- `src/components/inbox/SuperComposer.tsx`

- Importar `useTestModeToggle` para obter `isTestMode` da conversa atual
- Passar `isTestMode` como prop ao `FlowPickerButton`

### 3. Backend -- `supabase/functions/process-chat-flow/index.ts`

Substituir o bloco de rejeicao de fluxo inativo (linhas 447-452) por logica condicional:

```text
Se flow.is_active:
  -> prosseguir normalmente (sem mudanca)

Se !flow.is_active:
  -> Verificar bypassActiveCheck no body da request
  -> Verificar is_test_mode da conversa (ja consultado na linha 314-320)
  -> Verificar role do usuario chamador via user_roles (admin/manager/general_manager/support_manager/cs_manager/financial_manager)
  
  Se bypassActiveCheck + isTestMode + role privilegiado:
    -> Permitir execucao
    -> Log console: "[DRAFT-TEST] Flow draft executed in test mode"
    -> Inserir registro em audit_logs (user_id, action: "draft_flow_test", table_name: "chat_flows", record_id: flowId, new_data com conversation_id e flow_name)
  
  Se falta isTestMode:
    -> Retornar erro: "Ative o Modo Teste no header desta conversa para rodar fluxos em rascunho."
  
  Se falta role:
    -> Retornar erro: "Apenas administradores e gestores podem testar fluxos em rascunho."
```

Para verificar o role, extrair o JWT do header Authorization e consultar `user_roles` no banco.

### 4. Frontend -- Tratamento de erro no `FlowPickerButton`

- Quando `data?.error` retornar do backend, exibir toast com a mensagem exata (que ja inclui o CTA textual)
- Isso ja funciona no codigo atual (linha 56), entao nenhuma mudanca adicional e necessaria -- o backend e que precisa retornar a mensagem correta

## Fluxo de Decisao no Backend

```text
manualTrigger + flowId
  |
  v
Buscar fluxo
  |
  v
flow.is_active?
  |-- SIM --> prosseguir (zero mudanca)
  |-- NAO --> bypassActiveCheck?
                |-- NAO --> erro "Fluxo esta inativo"
                |-- SIM --> isTestMode?
                              |-- NAO --> erro "Ative o Modo Teste..."
                              |-- SIM --> role privilegiado?
                                            |-- NAO --> erro "Sem permissao..."
                                            |-- SIM --> executar + audit_log + log console
```

## Criterios de Aceite

1. Sem test mode: botao mostra apenas fluxos ativos
2. Com test mode: mostra ativos + rascunhos separados visualmente
3. Executar rascunho sem test mode: toast com erro claro e CTA
4. Executar rascunho sem role privilegiado: toast com erro de permissao
5. Executar rascunho com test mode + admin/manager: executa normalmente
6. Nenhum rascunho dispara automaticamente (somente manualTrigger)
7. Cada execucao de rascunho gera registro em audit_logs

## Impacto

- Zero regressao: fluxos ativos continuam identicos
- Fluxos inativos nunca disparam automaticamente
- Tripla validacao no backend (bypassActiveCheck + isTestMode + role)
- Auditoria persistente em audit_logs
- Upgrade puro sem downgrade

