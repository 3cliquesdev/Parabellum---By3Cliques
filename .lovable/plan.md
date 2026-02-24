

# Restringir Modo Teste a Gerentes e Admins

## Problema Atual

O botao "Testar IA" na linha 513 do `ChatWindow.tsx` usa apenas `hasPermission('inbox.test_mode')` combinado com condicoes de estado da IA. A permissao `inbox.test_mode` pode estar habilitada para roles que nao sao gerentes/admins, permitindo que agentes comuns ativem o modo de teste.

## Solucao

### Arquivo: `src/components/ChatWindow.tsx`

Alterar a condicao de visibilidade do botao na linha 513 para adicionar uma verificacao de role usando `hasFullAccess(role)` que ja existe no projeto e cobre exatamente os cargos de gestao (admin, manager, general_manager, support_manager, cs_manager, financial_manager).

**Antes:**
```
hasPermission('inbox.test_mode') && !isAIGlobalEnabled && isAutopilot
```

**Depois:**
```
hasPermission('inbox.test_mode') && hasFullAccess(role)
```

Isso tambem remove as condicoes `!isAIGlobalEnabled && isAutopilot` para que o botao apareca sempre para gerentes/admins com permissao (conforme o plano anterior aprovado de tornar o botao visivel para testar fluxos em rascunho).

### Detalhes tecnicos

- Importar `hasFullAccess` de `@/config/roles`
- Obter `role` de `useUserRole()` (ja disponivel na linha 90: `const { isAdmin, isManager, isSalesRep } = useUserRole()` -- basta adicionar `role`)
- A funcao `hasFullAccess` valida: admin, manager, general_manager, support_manager, cs_manager, financial_manager
- Dupla protecao: permissao granular (`inbox.test_mode`) + verificacao de cargo de gestao

### Atualizacao dos tooltips

- Ativo: "Modo Teste ATIVO - Fluxos de rascunho disponiveis e IA responde nesta conversa"
- Inativo: "Ativar Modo Teste - Permite testar fluxos em rascunho nesta conversa"

## Impacto

- Agentes comuns (support_agent, financial_agent, consultant, sales_rep) nao verao o botao mesmo que tenham a permissao
- Gerentes e admins verao o botao em qualquer conversa
- Zero regressao em outras funcionalidades
- Alinhado com a validacao tripla do backend (que ja exige role privilegiado)

