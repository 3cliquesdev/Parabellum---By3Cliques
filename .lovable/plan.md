

# Relatório IA Governante para Gerentes

## Situação Atual

- A Edge Function `ai-governor` já busca **qualquer perfil** com `notify_ai_governor = true` — não filtra por role. Então o backend já suporta gerentes.
- O problema está no **frontend**: o `ProfileEditDialog` só mostra a seção "IA Governante" (WhatsApp + toggle) quando `isAdmin === true` (linha 202). Gerentes não conseguem ativar.

## Mudança Necessária

Apenas **1 arquivo**: `src/components/ProfileEditDialog.tsx`

### 1. Expandir a condição de visibilidade da seção IA Governante

Trocar `isAdmin` por `hasFullAccess(role)` (importando de `src/config/roles.ts`), que inclui: admin, manager, general_manager, support_manager, cs_manager, financial_manager.

Linha 202: `{isAdmin && (` → `{hasFullAccess(role) && (`

### 2. Expandir a condição de salvamento

Linha 95: `if (isAdmin)` → `if (hasFullAccess(role))` para que gerentes também salvem `whatsapp_number` e `notify_ai_governor`.

### 3. Obter o role

O componente já usa `useAuth()`. Precisa adicionar `useUserRole()` para ter acesso ao `role`.

## Impacto
- Zero regressão — backend já aceita qualquer perfil com a flag
- Gerentes passam a ver a seção no perfil, configurar WhatsApp e ativar o relatório
- Admins continuam funcionando igual

