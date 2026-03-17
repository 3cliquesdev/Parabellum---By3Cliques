

# Plano: Dar permissão única a cada item de menu

## Problema
Vários itens de menu compartilham a mesma `permission_key`, então aparecem como uma única permissão no painel. Exemplos:
- "Devoluções" e "Fila de Tickets" → ambos `tickets.view`
- "Conf. de Devoluções" e "Configurações" → ambos `settings.view`
- "Painéis Dinâmicos", "Assinaturas", "Report Builder" → todos `analytics.view`
- "AI Studio" e "AI Messages" → ambos `ai.manage_personas`
- "Inbox" e "Instagram" → ambos `inbox.access`
- "Solicitações Internas" → `tickets.view`

O `useSyncPermissions` deduplica por key, então esses menus nunca aparecem individualmente.

## Correção

### 1. Atualizar `src/config/routes.ts` — dar keys únicas
| Menu | Key Atual | Nova Key |
|---|---|---|
| Painéis Dinâmicos | `analytics.view` | `analytics.view_dashboards` |
| Assinaturas | `analytics.view` | `analytics.view_subscriptions` |
| Report Builder | `analytics.view` | `analytics.view_report_builder` |
| Instagram | `inbox.access` | `inbox.access_instagram` |
| AI Messages | `ai.manage_personas` | `ai.manage_messages` |
| Solicitações Internas | `tickets.view` | `tickets.view_internal` |
| Devoluções | `tickets.view` | `cadastros.view_returns` |
| Conf. de Devoluções | `settings.view` | `settings.view_returns_config` |

### 2. Atualizar `CATEGORY_LABELS` no `RolePermissionsManager.tsx`
Nenhuma mudança necessária — as categorias são extraídas do prefixo da key (ex: `analytics`, `inbox`, `cadastros`).

### 3. Migration SQL — inserir as novas keys para todos os roles existentes
- Para cada role existente, inserir as novas permission_keys com `enabled = true` para roles de acesso total e `enabled = (valor da key original)` para os demais.
- Preservar as permissões existentes (não deletar as keys compartilhadas, pois outros menus ainda as usam).

### 4. Atualizar ProtectedRoute nos arquivos de rotas
Onde as rotas usarem `requiredPermission` com as keys antigas que foram renomeadas, atualizar para as novas keys.

### 5. Sincronizar
Após deploy, o botão "Sincronizar Permissões" propagará automaticamente qualquer key que falte.

## Impacto
- Cada item de menu terá toggle independente no painel de permissões
- Zero breaking change — keys originais permanecem para os menus que ainda as usam
- Roles com acesso total continuam ignorando verificações

