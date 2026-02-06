-- ============ 1. TABELA PRINCIPAL ============
CREATE TABLE IF NOT EXISTS agent_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, department_id)
);

-- ============ 2. ÍNDICES ============
CREATE UNIQUE INDEX IF NOT EXISTS ux_agent_departments_one_primary
ON agent_departments (profile_id)
WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_agent_departments_profile_id 
ON agent_departments(profile_id);

CREATE INDEX IF NOT EXISTS idx_agent_departments_department_id 
ON agent_departments(department_id);

CREATE INDEX IF NOT EXISTS idx_agent_departments_dept_profile 
ON agent_departments(department_id, profile_id);

-- ============ 3. RLS ============
ALTER TABLE agent_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can read own departments" ON agent_departments;
CREATE POLICY "Agents can read own departments"
ON agent_departments FOR SELECT
USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Managers can manage agent_departments" ON agent_departments;
CREATE POLICY "Managers can manage agent_departments"
ON agent_departments FOR ALL
USING (is_manager_or_admin(auth.uid()))
WITH CHECK (is_manager_or_admin(auth.uid()));

-- ============ 4. BACKFILL: Migrar dados existentes ============
INSERT INTO agent_departments (profile_id, department_id, is_primary)
SELECT id, department, true
FROM profiles
WHERE department IS NOT NULL
ON CONFLICT (profile_id, department_id) DO UPDATE
SET is_primary = EXCLUDED.is_primary;

-- ============ 5. TRIGGER 1: agent_departments → profiles.department ============
CREATE OR REPLACE FUNCTION sync_profiles_department_from_agent_departments()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  pid UUID;
  new_primary_dept UUID;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  pid := COALESCE(NEW.profile_id, OLD.profile_id);

  SELECT department_id INTO new_primary_dept
  FROM agent_departments
  WHERE profile_id = pid
    AND is_primary = true
  LIMIT 1;

  UPDATE profiles
  SET department = new_primary_dept
  WHERE id = pid;

  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_sync_profiles_from_agent_depts ON agent_departments;

CREATE TRIGGER trg_sync_profiles_from_agent_depts
AFTER INSERT OR UPDATE OF is_primary OR DELETE
ON agent_departments
FOR EACH ROW
EXECUTE FUNCTION sync_profiles_department_from_agent_departments();

-- ============ 6. TRIGGER 2: profiles.department → agent_departments (ORDEM SEGURA) ============
CREATE OR REPLACE FUNCTION sync_agent_departments_from_profiles()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.department IS NULL THEN
    UPDATE agent_departments
      SET is_primary = false
    WHERE profile_id = NEW.id
      AND is_primary = true;
    RETURN NEW;
  END IF;

  -- PASSO 1: ZERA primário atual (evita UNIQUE INDEX violation)
  UPDATE agent_departments
    SET is_primary = false
  WHERE profile_id = NEW.id
    AND is_primary = true;

  -- PASSO 2: INSERE/ATUALIZA novo primário (agora seguro)
  INSERT INTO agent_departments (profile_id, department_id, is_primary)
  VALUES (NEW.id, NEW.department, true)
  ON CONFLICT (profile_id, department_id)
  DO UPDATE SET is_primary = true;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_agent_depts_from_profiles ON profiles;

CREATE TRIGGER trg_sync_agent_depts_from_profiles
AFTER UPDATE OF department
ON profiles
FOR EACH ROW
EXECUTE FUNCTION sync_agent_departments_from_profiles();

-- ============ 7. RPC TRANSACIONAL (✅ CORRIGIDO: unnest correto) ============
CREATE OR REPLACE FUNCTION set_agent_departments(
  p_profile_id UUID,
  p_primary_department_id UUID,
  p_additional_department_ids UUID[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_all UUID[];
  v_count INT;
BEGIN
  -- Validação: apenas managers podem executar
  IF NOT is_manager_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada: apenas gerentes podem alterar departamentos';
  END IF;

  -- Validar profile existe
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  -- Validar departamento primário existe
  IF p_primary_department_id IS NOT NULL AND 
     NOT EXISTS (SELECT 1 FROM departments WHERE id = p_primary_department_id) THEN
    RAISE EXCEPTION 'Departamento primário não encontrado';
  END IF;

  -- PASSO 0: Montar array único de todos os departamentos (primário + extras)
  v_all := ARRAY(
    SELECT DISTINCT x
    FROM unnest(
      CASE 
        WHEN p_primary_department_id IS NULL THEN p_additional_department_ids
        ELSE array_prepend(p_primary_department_id, p_additional_department_ids)
      END
    ) AS x
  );

  -- PASSO 1: Zera primário atual
  UPDATE agent_departments
  SET is_primary = false
  WHERE profile_id = p_profile_id
    AND is_primary = true;

  -- PASSO 2: UPSERT todos (✅ CORRIGIDO: FROM unnest + single SELECT)
  INSERT INTO agent_departments (profile_id, department_id, is_primary)
  SELECT
    p_profile_id,
    d,
    (d = p_primary_department_id)
  FROM unnest(v_all) AS d
  ON CONFLICT (profile_id, department_id)
  DO UPDATE SET is_primary = (EXCLUDED.department_id = p_primary_department_id);

  -- PASSO 3: Remove vínculos não selecionados
  DELETE FROM agent_departments
  WHERE profile_id = p_profile_id
    AND department_id <> ALL(v_all);

  SELECT COUNT(*) INTO v_count FROM agent_departments
  WHERE profile_id = p_profile_id;

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', p_profile_id,
    'primary_department_id', p_primary_department_id,
    'total_departments', v_count
  );
END; $$;

GRANT EXECUTE ON FUNCTION set_agent_departments TO authenticated;