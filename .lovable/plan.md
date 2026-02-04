

# Plano Definitivo: Otimização de Performance RLS + Frontend

## Diagnóstico Completo

### Políticas com `has_role()` (PROBLEMA CRÍTICO)
| Tabela | Policies com has_role | Impacto |
|--------|----------------------|---------|
| tickets | 20 | CRÍTICO |
| conversations | 17 | CRÍTICO |
| inbox_view | 8 | CRÍTICO |
| deals | 6 | ALTO |
| activities | 5 | MÉDIO |
| contacts | 5 | MÉDIO |

### Estado Atual das Policies de `deals`
```text
SELECT policies (5 - 4 REDUNDANTES):
├── optimized_select_deals ✅ (EXISTS - correta)
├── cs_manager_can_view_all_deals ❌ (has_role por linha)
├── financial_manager_can_view_deals ❌ (has_role por linha)
├── support_manager_can_view_deals ❌ (has_role por linha)
└── role_based_select_deals (já removida)

UPDATE policy (1 - USA has_role):
└── role_based_update_deals ❌ (has_role por linha)

INSERT policy (1 - OK):
└── role_based_insert_deals ✅
```

### Por que a otimização anterior não funcionou 100%
O Postgres avalia TODAS as SELECT policies com `OR`. Mesmo tendo a `optimized_select_deals` correta, as 3 policies redundantes (`cs_manager`, `financial_manager`, `support_manager`) ainda executam `has_role()` para cada linha.

---

## Solução em 3 Fases

### Fase 1: SQL - Limpar Deals (Crítico)

```sql
BEGIN;

-- 1.1) Índices para RLS (se não existem)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
  ON public.user_roles(user_id, role);

CREATE INDEX IF NOT EXISTS idx_deals_assigned_updated
  ON public.deals(assigned_to, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_deals_pipeline_assigned_updated
  ON public.deals(pipeline_id, assigned_to, updated_at DESC);

-- 1.2) Remover SELECT policies redundantes (has_role)
DROP POLICY IF EXISTS cs_manager_can_view_all_deals ON public.deals;
DROP POLICY IF EXISTS financial_manager_can_view_deals ON public.deals;
DROP POLICY IF EXISTS support_manager_can_view_deals ON public.deals;
DROP POLICY IF EXISTS role_based_select_deals ON public.deals;

-- 1.3) Garantir 1 única SELECT policy canônica
DROP POLICY IF EXISTS optimized_select_deals ON public.deals;
CREATE POLICY optimized_select_deals
ON public.deals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'admin','manager','general_manager',
        'support_manager','cs_manager','financial_manager'
      )
  )
  OR
  (
    assigned_to = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('sales_rep','user','consultant')
    )
  )
);

-- 1.4) Reescrever UPDATE sem has_role
DROP POLICY IF EXISTS role_based_update_deals ON public.deals;
CREATE POLICY role_based_update_deals
ON public.deals
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin','manager','general_manager')
  )
  OR
  (
    assigned_to = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('sales_rep','user')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin','manager','general_manager','sales_rep','user')
  )
);

-- 1.5) Reescrever INSERT sem has_role
DROP POLICY IF EXISTS role_based_insert_deals ON public.deals;
CREATE POLICY role_based_insert_deals
ON public.deals
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin','manager','general_manager','sales_rep','user')
  )
);

COMMIT;
```

### Fase 2: SQL - Limpar Conversations e Inbox (Alto Impacto)

```sql
BEGIN;

-- 2.1) Remover SELECT policies redundantes de conversations
DROP POLICY IF EXISTS admin_manager_full_access_conversations ON public.conversations;
DROP POLICY IF EXISTS cs_manager_can_view_all_conversations ON public.conversations;
DROP POLICY IF EXISTS financial_manager_can_view_all_conversations ON public.conversations;
DROP POLICY IF EXISTS general_manager_can_view_all_conversations ON public.conversations;
DROP POLICY IF EXISTS support_manager_can_view_all_support_conversations ON public.conversations;
DROP POLICY IF EXISTS consultant_can_view_assigned_conversations ON public.conversations;

-- 2.2) Criar SELECT policy unificada para conversations
CREATE POLICY optimized_select_conversations
ON public.conversations
FOR SELECT
TO authenticated
USING (
  -- Managers: acesso total
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'admin','manager','general_manager',
        'support_manager','cs_manager','financial_manager'
      )
  )
  OR
  -- Consultants/Agentes: apenas assigned
  (assigned_to = auth.uid())
  OR
  -- Sales_rep: departamento comercial
  (
    status = 'open' AND assigned_to IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'sales_rep'
    )
    AND department IN (SELECT id FROM departments WHERE name IN ('Comercial','Vendas'))
  )
  OR
  -- Support_agent: departamento suporte
  (
    status = 'open' AND assigned_to IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'support_agent'
    )
    AND department IN (SELECT id FROM departments WHERE name = 'Suporte')
  )
  OR
  -- Financial_agent: departamentos financeiros
  (
    status = 'open' AND assigned_to IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'financial_agent'
    )
    AND department IN (SELECT id FROM departments WHERE name ILIKE ANY(ARRAY['Financeiro','Finance','Financial']))
  )
  OR
  -- User role: mesmo departamento
  (
    status = 'open' AND assigned_to IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'user'
    )
    AND department = (SELECT department FROM profiles WHERE id = auth.uid())
  )
  OR
  -- Web chat anon (manter funcionalidade existente)
  (
    channel = 'web_chat' AND session_token IS NOT NULL
    AND session_token = ((current_setting('request.headers', true))::json->>'x-session-token')
  )
);

-- 2.3) Simplificar inbox_view
DROP POLICY IF EXISTS admin_manager_full_access_inbox_view ON public.inbox_view;
DROP POLICY IF EXISTS optimized_admin_manager_inbox ON public.inbox_view;

CREATE POLICY optimized_inbox_select
ON public.inbox_view
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'admin','manager','general_manager',
        'support_manager','cs_manager','financial_manager'
      )
  )
  OR assigned_to = auth.uid()
);

COMMIT;
```

### Fase 3: Frontend - Otimizar useDeals

**Arquivo:** `src/hooks/useDeals.tsx`

Mudanças:
1. Remover `select('*')` - buscar apenas colunas necessárias
2. Reduzir limit para 50 com paginação
3. Lazy-load relacionamentos pesados

```typescript
// Query leve para listagem
const query = supabase
  .from("deals")
  .select(`
    id,
    title,
    pipeline_id,
    stage_id,
    status,
    value,
    probability,
    updated_at,
    created_at,
    assigned_to,
    contact_id,
    organization_id,
    expected_close_date,
    contacts (id, first_name, last_name, phone),
    organizations (name),
    assigned_user:profiles!deals_assigned_to_fkey (id, full_name, avatar_url)
  `, { count: "estimated" })
  .limit(50);
```

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| SELECT deals p95 | >8s (timeout) | <300ms |
| Policies avaliadas | 5 SELECT | 1 SELECT |
| has_role calls | 18.110 x 5 | 0 |
| Inbox visibility | Intermitente | Estável |

## Checklist de Validação Pós-Deploy

```sql
-- 1. Confirmar só 1 SELECT policy em deals
SELECT policyname FROM pg_policies 
WHERE schemaname='public' AND tablename='deals' AND cmd='SELECT';
-- Esperado: optimized_select_deals

-- 2. Confirmar ZERO has_role em deals
SELECT policyname, qual FROM pg_policies 
WHERE schemaname='public' AND tablename='deals' 
  AND (qual ILIKE '%has_role%');
-- Esperado: 0 linhas

-- 3. Testar query de listagem
EXPLAIN ANALYZE SELECT id, title FROM deals LIMIT 50;
-- Esperado: <100ms, Index Scan
```

---

## Seção Técnica

### Por que EXISTS é mais rápido que has_role()

A função `has_role()` é declarada como `SECURITY DEFINER` e retorna `boolean`. O Postgres não consegue otimizar porque:
1. Funções podem ter efeitos colaterais
2. O resultado pode variar por linha (volatility não é IMMUTABLE)
3. Cada chamada executa uma subquery completa

Com `EXISTS`:
1. Postgres detecta que a subquery não depende de colunas da tabela principal
2. Avalia UMA vez no início da query
3. Usa o resultado como filtro constante (não por linha)

### Índice Crítico
```sql
idx_user_roles_user_role ON (user_id, role)
```
Permite que o EXISTS resolva em Index Only Scan ao invés de Seq Scan.

## Rollback (se necessário)

```sql
-- Recriar policies originais
CREATE POLICY "cs_manager_can_view_all_deals" ON public.deals
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'cs_manager'::app_role));
-- ... outras
```

