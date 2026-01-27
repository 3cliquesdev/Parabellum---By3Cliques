
## Plano: Liberar Acesso Total para cs_manager (Marco Cruz)

### Diagnostico Completo

Identifiquei **Marco Cruz** como o usuario com role `cs_manager`:
- **User ID**: ce6150bb-c88b-4fc1-bce2-f09b4f51ef1d
- **Role**: cs_manager

### Tabelas que JA Permitem cs_manager (OK)

| Tabela | Status |
|--------|--------|
| chat_flows | OK - cs_manager incluido |
| onboarding_playbooks | OK - cs_manager incluido |
| email_templates | OK - cs_manager incluido |
| email_templates_v2 | OK - cs_manager incluido |
| email_branding | OK - cs_manager incluido |
| email_senders | OK - cs_manager incluido |
| email_layout_library | OK - cs_manager incluido |
| email_template_blocks | OK - cs_manager incluido |
| email_template_translations | OK - cs_manager incluido |
| email_template_variants | OK - cs_manager incluido |
| email_tracking_events | OK - cs_manager pode visualizar |
| playbook_executions | OK - cs_manager pode ver e atualizar |
| playbook_execution_queue | OK - cs_manager pode visualizar |

### Tabelas que BLOQUEIAM cs_manager (CORRIGIR)

| Tabela | Problema | Acoes Bloqueadas |
|--------|----------|-----------------|
| ai_message_templates | Apenas admin/manager | INSERT, UPDATE, DELETE |
| ai_personas | Apenas admin/manager | INSERT, UPDATE, DELETE |
| ai_tools | Apenas admin/manager | INSERT, UPDATE, DELETE |
| ai_persona_tools | Apenas admin/manager | INSERT, UPDATE, DELETE |
| ai_routing_rules | Apenas admin/manager | INSERT, UPDATE, DELETE |
| ai_scenario_configs | Apenas admin/manager | ALL |
| ai_training_examples | Apenas admin/manager | ALL |
| cadence_templates | Apenas admin | ALL |
| automations | Apenas admin/manager | ALL |
| email_block_conditions | Apenas admin/manager/gm | ALL |
| email_events | Apenas admin/manager/gm | SELECT |
| email_sends | Apenas admin/manager/gm/fm | SELECT |
| email_variable_definitions | Apenas admin | ALL |

---

### Migration SQL para Corrigir

Criar migration com DROP e CREATE de todas as policies necessarias:

```sql
-- =====================================================
-- 1. ai_message_templates
-- =====================================================
DROP POLICY IF EXISTS "admin_manager_can_delete_ai_message_templates" ON ai_message_templates;
DROP POLICY IF EXISTS "admin_manager_can_insert_ai_message_templates" ON ai_message_templates;
DROP POLICY IF EXISTS "admin_manager_can_update_ai_message_templates" ON ai_message_templates;

CREATE POLICY "managers_can_delete_ai_message_templates"
ON ai_message_templates FOR DELETE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_insert_ai_message_templates"
ON ai_message_templates FOR INSERT TO public
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_update_ai_message_templates"
ON ai_message_templates FOR UPDATE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 2. ai_personas
-- =====================================================
DROP POLICY IF EXISTS "admins_managers_can_delete_personas" ON ai_personas;
DROP POLICY IF EXISTS "admins_managers_can_insert_personas" ON ai_personas;
DROP POLICY IF EXISTS "admins_managers_can_update_personas" ON ai_personas;

CREATE POLICY "managers_can_delete_personas"
ON ai_personas FOR DELETE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_insert_personas"
ON ai_personas FOR INSERT TO public
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_update_personas"
ON ai_personas FOR UPDATE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 3. ai_tools
-- =====================================================
DROP POLICY IF EXISTS "admins_managers_can_delete_tools" ON ai_tools;
DROP POLICY IF EXISTS "admins_managers_can_insert_tools" ON ai_tools;
DROP POLICY IF EXISTS "admins_managers_can_update_tools" ON ai_tools;

CREATE POLICY "managers_can_delete_tools"
ON ai_tools FOR DELETE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_insert_tools"
ON ai_tools FOR INSERT TO public
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_update_tools"
ON ai_tools FOR UPDATE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 4. ai_persona_tools
-- =====================================================
DROP POLICY IF EXISTS "admins_managers_can_delete_persona_tools" ON ai_persona_tools;
DROP POLICY IF EXISTS "admins_managers_can_insert_persona_tools" ON ai_persona_tools;
DROP POLICY IF EXISTS "admins_managers_can_update_persona_tools" ON ai_persona_tools;

CREATE POLICY "managers_can_delete_persona_tools"
ON ai_persona_tools FOR DELETE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_insert_persona_tools"
ON ai_persona_tools FOR INSERT TO public
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_update_persona_tools"
ON ai_persona_tools FOR UPDATE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 5. ai_routing_rules
-- =====================================================
DROP POLICY IF EXISTS "admins_managers_can_delete_routing_rules" ON ai_routing_rules;
DROP POLICY IF EXISTS "admins_managers_can_insert_routing_rules" ON ai_routing_rules;
DROP POLICY IF EXISTS "admins_managers_can_update_routing_rules" ON ai_routing_rules;

CREATE POLICY "managers_can_delete_routing_rules"
ON ai_routing_rules FOR DELETE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_insert_routing_rules"
ON ai_routing_rules FOR INSERT TO public
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_update_routing_rules"
ON ai_routing_rules FOR UPDATE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 6. ai_scenario_configs
-- =====================================================
DROP POLICY IF EXISTS "Admin e Manager podem gerenciar cenários" ON ai_scenario_configs;

CREATE POLICY "managers_can_manage_scenarios"
ON ai_scenario_configs FOR ALL TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 7. ai_training_examples
-- =====================================================
DROP POLICY IF EXISTS "Admin e Manager podem gerenciar exemplos de treinamento" ON ai_training_examples;

CREATE POLICY "managers_can_manage_training_examples"
ON ai_training_examples FOR ALL TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 8. cadence_templates
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage cadence templates" ON cadence_templates;

CREATE POLICY "managers_can_manage_cadence_templates"
ON cadence_templates FOR ALL TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 9. automations
-- =====================================================
DROP POLICY IF EXISTS "admins_managers_can_manage_automations" ON automations;

CREATE POLICY "managers_can_manage_automations"
ON automations FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 10. email_block_conditions
-- =====================================================
DROP POLICY IF EXISTS "admin_manager_full_access_conditions" ON email_block_conditions;

CREATE POLICY "managers_full_access_conditions"
ON email_block_conditions FOR ALL TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 11. email_events (apenas SELECT)
-- =====================================================
DROP POLICY IF EXISTS "admin_manager_view_all_events" ON email_events;

CREATE POLICY "managers_view_all_events"
ON email_events FOR SELECT TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 12. email_sends (apenas SELECT)
-- =====================================================
DROP POLICY IF EXISTS "admin_manager_view_all_sends" ON email_sends;

CREATE POLICY "managers_view_all_sends"
ON email_sends FOR SELECT TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role) OR
  has_role(auth.uid(), 'financial_manager'::app_role)
);

-- =====================================================
-- 13. email_variable_definitions
-- =====================================================
DROP POLICY IF EXISTS "admin_manage_variables" ON email_variable_definitions;

CREATE POLICY "managers_manage_variables"
ON email_variable_definitions FOR ALL TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);
```

---

### Resumo das Alteracoes

| Tabela | Antes | Depois |
|--------|-------|--------|
| ai_message_templates | admin, manager | + cs_manager, gm, sm |
| ai_personas | admin, manager | + cs_manager, gm, sm |
| ai_tools | admin, manager | + cs_manager, gm, sm |
| ai_persona_tools | admin, manager | + cs_manager, gm, sm |
| ai_routing_rules | admin, manager | + cs_manager, gm, sm |
| ai_scenario_configs | admin, manager | + cs_manager, gm, sm |
| ai_training_examples | admin, manager | + cs_manager, gm, sm |
| cadence_templates | admin only | + manager, cs_manager, gm, sm |
| automations | admin, manager | + cs_manager, gm, sm |
| email_block_conditions | admin, manager, gm | + cs_manager, sm |
| email_events | admin, manager, gm | + cs_manager, sm |
| email_sends | admin, manager, gm, fm | + cs_manager, sm |
| email_variable_definitions | admin only | + manager, cs_manager, gm, sm |

**Legenda:**
- gm = general_manager
- sm = support_manager
- fm = financial_manager

---

### Resultado Esperado

Apos a migration, Marco Cruz (cs_manager) tera acesso total para:

1. **Emails**: Criar, editar, excluir templates, branding, senders
2. **AI**: Gerenciar personas, tools, routing rules, cenarios, exemplos de treinamento
3. **Playbooks**: Criar, editar, executar playbooks (ja funciona)
4. **Chat Flows**: Criar, editar, ativar/desativar fluxos (ja funciona)
5. **Automacoes**: Criar e gerenciar automacoes
6. **Cadencias**: Gerenciar templates de cadencia

Todos os gerentes (cs_manager, general_manager, support_manager, financial_manager) terao permissoes equivalentes para gestao de conteudo.
