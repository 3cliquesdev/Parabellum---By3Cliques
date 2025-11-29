-- ============================================================
-- SECURITY FIX: RLS Policies for interactions, tags, customer_tags
-- ============================================================
-- 
-- ISSUE: Permissive policies allowing ANY authenticated user to CRUD
-- all data regardless of role or assignment.
--
-- SOLUTION: Implement role-based policies with proper data scoping
-- ============================================================

-- ============================================================
-- FASE 2: FIX INTERACTIONS TABLE RLS
-- ============================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can view interactions" ON public.interactions;
DROP POLICY IF EXISTS "Authenticated users can update interactions" ON public.interactions;
DROP POLICY IF EXISTS "Authenticated users can delete interactions" ON public.interactions;
DROP POLICY IF EXISTS "Authenticated users can create interactions" ON public.interactions;

-- Create role-based SELECT policy
CREATE POLICY "interactions_select_policy" ON public.interactions
FOR SELECT
USING (
  -- Admin/Manager: Can see all interactions
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'cs_manager'::app_role)
  OR public.has_role(auth.uid(), 'general_manager'::app_role)
  OR public.has_role(auth.uid(), 'support_manager'::app_role)
  OR public.has_role(auth.uid(), 'financial_manager'::app_role)
  OR
  -- Sales Rep: Only interactions for contacts where they are assigned
  (
    public.has_role(auth.uid(), 'sales_rep'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = interactions.customer_id
      AND c.assigned_to = auth.uid()
    )
  )
  OR
  -- Consultant: Only interactions for clients in their portfolio
  (
    public.has_role(auth.uid(), 'consultant'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = interactions.customer_id
      AND c.consultant_id = auth.uid()
    )
  )
  OR
  -- Support Agent: Can see all interactions for support context
  public.has_role(auth.uid(), 'support_agent'::app_role)
  OR
  -- User who created the interaction
  interactions.created_by = auth.uid()
);

-- Create role-based INSERT policy
CREATE POLICY "interactions_insert_policy" ON public.interactions
FOR INSERT
WITH CHECK (
  -- All authenticated users can create interactions for contacts they have access to
  auth.uid() IS NOT NULL
  AND (
    -- Admin/Manager: Can create for any contact
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'cs_manager'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
    OR public.has_role(auth.uid(), 'support_manager'::app_role)
    OR public.has_role(auth.uid(), 'financial_manager'::app_role)
    OR
    -- Sales Rep: Only for their assigned contacts
    (
      public.has_role(auth.uid(), 'sales_rep'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = interactions.customer_id
        AND c.assigned_to = auth.uid()
      )
    )
    OR
    -- Consultant: Only for their portfolio clients
    (
      public.has_role(auth.uid(), 'consultant'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = interactions.customer_id
        AND c.consultant_id = auth.uid()
      )
    )
    OR
    -- Support Agent: Can create for any contact
    public.has_role(auth.uid(), 'support_agent'::app_role)
  )
);

-- Create role-based UPDATE policy
CREATE POLICY "interactions_update_policy" ON public.interactions
FOR UPDATE
USING (
  -- Admin/Manager: Can update all
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'cs_manager'::app_role)
  OR public.has_role(auth.uid(), 'general_manager'::app_role)
  OR public.has_role(auth.uid(), 'support_manager'::app_role)
  OR public.has_role(auth.uid(), 'financial_manager'::app_role)
  OR
  -- User who created it
  interactions.created_by = auth.uid()
)
WITH CHECK (
  -- Same conditions as USING clause
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'cs_manager'::app_role)
  OR public.has_role(auth.uid(), 'general_manager'::app_role)
  OR public.has_role(auth.uid(), 'support_manager'::app_role)
  OR public.has_role(auth.uid(), 'financial_manager'::app_role)
  OR interactions.created_by = auth.uid()
);

-- Create role-based DELETE policy
CREATE POLICY "interactions_delete_policy" ON public.interactions
FOR DELETE
USING (
  -- Only admin can delete interactions
  public.has_role(auth.uid(), 'admin'::app_role)
  OR
  -- User who created it can delete within 24 hours
  (
    interactions.created_by = auth.uid()
    AND interactions.created_at > NOW() - INTERVAL '24 hours'
  )
);

-- ============================================================
-- FASE 3: FIX TAGS TABLE RLS
-- ============================================================

-- Drop existing permissive policy
DROP POLICY IF EXISTS "Authenticated users can manage tags" ON public.tags;

-- Create role-based policies for tags
CREATE POLICY "tags_select_policy" ON public.tags
FOR SELECT
USING (auth.uid() IS NOT NULL); -- All authenticated users can view tags

CREATE POLICY "tags_insert_policy" ON public.tags
FOR INSERT
WITH CHECK (
  -- Only admin/manager can create tags
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'cs_manager'::app_role)
  OR public.has_role(auth.uid(), 'general_manager'::app_role)
  OR public.has_role(auth.uid(), 'support_manager'::app_role)
  OR public.has_role(auth.uid(), 'financial_manager'::app_role)
);

CREATE POLICY "tags_update_policy" ON public.tags
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'cs_manager'::app_role)
  OR public.has_role(auth.uid(), 'general_manager'::app_role)
  OR public.has_role(auth.uid(), 'support_manager'::app_role)
  OR public.has_role(auth.uid(), 'financial_manager'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'cs_manager'::app_role)
  OR public.has_role(auth.uid(), 'general_manager'::app_role)
  OR public.has_role(auth.uid(), 'support_manager'::app_role)
  OR public.has_role(auth.uid(), 'financial_manager'::app_role)
);

CREATE POLICY "tags_delete_policy" ON public.tags
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'cs_manager'::app_role)
  OR public.has_role(auth.uid(), 'general_manager'::app_role)
  OR public.has_role(auth.uid(), 'support_manager'::app_role)
  OR public.has_role(auth.uid(), 'financial_manager'::app_role)
);

-- ============================================================
-- FASE 3: FIX CUSTOMER_TAGS TABLE RLS
-- ============================================================

-- Drop existing permissive policy
DROP POLICY IF EXISTS "Authenticated users can manage customer tags" ON public.customer_tags;

-- Create role-based policies for customer_tags
CREATE POLICY "customer_tags_select_policy" ON public.customer_tags
FOR SELECT
USING (
  -- Admin/Manager: Can see all
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'cs_manager'::app_role)
  OR public.has_role(auth.uid(), 'general_manager'::app_role)
  OR public.has_role(auth.uid(), 'support_manager'::app_role)
  OR public.has_role(auth.uid(), 'financial_manager'::app_role)
  OR
  -- Sales Rep: Only for their assigned contacts
  (
    public.has_role(auth.uid(), 'sales_rep'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = customer_tags.customer_id
      AND c.assigned_to = auth.uid()
    )
  )
  OR
  -- Consultant: Only for their portfolio clients
  (
    public.has_role(auth.uid(), 'consultant'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = customer_tags.customer_id
      AND c.consultant_id = auth.uid()
    )
  )
  OR
  -- Support Agent: Can see all
  public.has_role(auth.uid(), 'support_agent'::app_role)
  OR
  -- User who created the tag assignment
  customer_tags.created_by = auth.uid()
);

CREATE POLICY "customer_tags_insert_policy" ON public.customer_tags
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    -- Admin/Manager: Can tag any contact
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'cs_manager'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
    OR public.has_role(auth.uid(), 'support_manager'::app_role)
    OR public.has_role(auth.uid(), 'financial_manager'::app_role)
    OR
    -- Sales Rep: Only their assigned contacts
    (
      public.has_role(auth.uid(), 'sales_rep'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = customer_tags.customer_id
        AND c.assigned_to = auth.uid()
      )
    )
    OR
    -- Consultant: Only their portfolio clients
    (
      public.has_role(auth.uid(), 'consultant'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = customer_tags.customer_id
        AND c.consultant_id = auth.uid()
      )
    )
    OR
    -- Support Agent: Can tag any contact
    public.has_role(auth.uid(), 'support_agent'::app_role)
  )
);

CREATE POLICY "customer_tags_delete_policy" ON public.customer_tags
FOR DELETE
USING (
  -- Admin/Manager: Can delete any
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'cs_manager'::app_role)
  OR public.has_role(auth.uid(), 'general_manager'::app_role)
  OR public.has_role(auth.uid(), 'support_manager'::app_role)
  OR public.has_role(auth.uid(), 'financial_manager'::app_role)
  OR
  -- User who created the tag
  customer_tags.created_by = auth.uid()
);
