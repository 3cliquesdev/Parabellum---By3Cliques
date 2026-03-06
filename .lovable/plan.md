

# Consolidação Completa de RLS — Migrar para `is_manager_or_admin()`

## Resumo

**65 policies** em ~30 tabelas usam chamadas verbosas `has_role()` em vez do helper unificado `is_manager_or_admin(auth.uid())`. Dessas:

- **14 NEEDS_FIX**: Só checam `admin` + `manager`, excluindo `cs_manager`, `support_manager`, `financial_manager`, `general_manager`
- **51 PARTIAL**: Já listam alguns managers extras mas com chains verbosas de 5-6 `has_role()` OR

**Excluídas** (corretas como estão):
- `role_permissions` — admin-only (governança)
- `user_roles` — admin-only (governança)
- Policies de `sales_rep`, `consultant`, `support_agent` que checam dados próprios (essas permanecem, apenas o bloco "manager" dentro delas é substituído)

## Correção

Uma única migration SQL que:

1. **DROP** cada policy antiga
2. **CREATE** policy nova usando `is_manager_or_admin(auth.uid())` no lugar das chains

### Tabelas NEEDS_FIX (14 policies, acesso quebrado)

| Tabela | Policy | Cmd |
|--------|--------|-----|
| `admin_alerts` | `admin_manager_can_update_alerts` | UPDATE |
| `cadence_enrollments` | `admin_manager_can_manage_all_enrollments` | ALL |
| `cadence_steps` | `admin_manager_can_manage_steps` | ALL |
| `cadence_tasks` | `admin_manager_can_manage_all_tasks` | ALL |
| `cadences` | `admin_manager_can_manage_cadences` | ALL |
| `conversation_ratings` | `admin_manager_can_update_ratings` | UPDATE |
| `customer_journey_steps` | `admin_manager_can_manage_journey_steps` | ALL |
| `internal_requests` | `admin_manager_can_manage_internal_requests` | ALL |
| `kiwify_import_queue` | `admin_manager_can_manage_kiwify_queue` | ALL |
| `knowledge_articles` | `admin_manager_can_update_articles` | UPDATE |
| `playbook_goals` | `Admin and Manager can manage goals` | ALL |
| `public_ticket_portal_config` | `admin_manager_can_manage_portal_config` | ALL |
| `support_channels` | `admin_manager_can_manage_support_channels` | ALL |
| `whatsapp_instances` | `admin_manager_can_manage_all_instances` | ALL |

### Tabelas PARTIAL (51 policies, funcionais mas verbosas)

Inclui policies em: `activities`, `agent_support_channels`, `ai_message_templates`, `ai_persona_tools`, `ai_personas`, `ai_quality_logs`, `ai_routing_rules`, `ai_scenario_configs`, `ai_tools`, `ai_training_examples`, `automations`, `cadence_templates`, `canned_responses`, `contacts`, `conversation_ratings`, `cs_goals`, `customer_journey_steps`, `delivery_groups`, `email_*` (8 tabelas), `form_*` (4 tabelas), `interactions`, `onboarding_playbooks`, `pipeline_sales_reps`, `pipelines`, `playbook_executions`, `playbook_products`, `profiles`, `quotes`, `sla_alerts`, `stages`, `support_channels`, `tags`, `team_members`, `teams`.

Para policies com condições mistas (ex: `role_based_update_contacts` que tem manager OR sales_rep com assigned_to), o bloco manager é substituído por `is_manager_or_admin()` e a condição específica do role é preservada.

### Policies redundantes a serem removidas

Tabelas que têm AMBAS uma policy `admin_manager_*` E uma policy `support_manager_*` separada para a mesma operação (ex: `support_channels`, `team_members`, `teams`) — a policy unificada com `is_manager_or_admin` substitui ambas.

## Impacto

- **Zero alteração frontend**
- **Upgrade de segurança**: 14 tabelas passam a ser acessíveis por todos os gerentes
- **Manutenibilidade**: 65 policies verbosas → ~40 policies limpas usando o helper centralizado
- **Zero regressão**: Mesmos roles, mesmas permissões, apenas unificados

## Detalhes técnicos

A migration será um único arquivo SQL com ~200 linhas de DROP/CREATE POLICY statements. O helper `is_manager_or_admin()` já existe e inclui todos os 6 roles de gestão.

