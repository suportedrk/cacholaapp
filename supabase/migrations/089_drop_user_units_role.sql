-- 089_drop_user_units_role.sql
-- Deprecation de user_units.role apos RBAC overhaul (v1.5.x).
-- users.role e source of truth desde a serie v1.5.x (Decision 4).
-- Esta migration:
--   1. Reescreve as 4 funcoes SQL que liam user_units.role para
--      lerrem de users.role (via JOIN onde filtro de unit_id e necessario)
--   2. Reescreve 19 policies RLS em 7 tabelas que referenciavam
--      user_units.role inline (substituindo por JOIN com public.users)
--   3. Dropa a coluna user_units.role
-- Tudo em uma unica transacao para atomicidade total.
--
-- Aprendizado 2 N/A: assinaturas identicas -- CREATE OR REPLACE e suficiente.
-- DROP FUNCTION antes de CREATE OR REPLACE seria necessario apenas se a assinatura
-- (parametros ou tipo de retorno) mudasse. Aqui apenas o corpo muda.
-- Aprendizado 4 aplicado: NOTIFY pgrst ao final para recarregar schema cache.

BEGIN;

-- ============================================================
-- 1. is_global_viewer()
--    Funcao base da autorizacao RLS em todo o sistema.
--    MUDANCA: leia users.role diretamente em vez de user_units.role.
--    Semantica equivalente porque users.role e source of truth e
--    divergencia entre os dois campos era zero (verificado antes
--    desta migration).
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_global_viewer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor', 'pos_vendas')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_global_viewer() TO authenticated, anon;

COMMENT ON FUNCTION public.is_global_viewer() IS
  'Retorna true se o usuario autenticado tem role global (super_admin, diretor, pos_vendas). '
  'Usada em policies RLS de multiplas tabelas. '
  'Migrada de user_units.role para users.role na migration 089 (RBAC overhaul).';

-- ============================================================
-- 2. can_view_meeting(p_meeting_id uuid)
--    MUDANCA: substitui leitura de uu.role pelo JOIN com public.users,
--    mantendo o filtro de unit_id (gerente da unidade da ata).
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_view_meeting(p_meeting_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meeting_minutes mm
    WHERE mm.id = p_meeting_id
      AND (
        -- Criador sempre pode ver
        mm.created_by = auth.uid()
        -- Participante pode ver
        OR EXISTS (
          SELECT 1
          FROM public.meeting_participants mp
          WHERE mp.meeting_id = mm.id
            AND mp.user_id = auth.uid()
        )
        -- super_admin, diretor e pos_vendas veem tudo (is_global_viewer)
        OR is_global_viewer()
        -- Gerente da unidade da ata tambem ve tudo
        OR EXISTS (
          SELECT 1
          FROM public.user_units uu
          JOIN public.users u ON u.id = uu.user_id
          WHERE uu.user_id = auth.uid()
            AND uu.unit_id = mm.unit_id
            AND u.role     = 'gerente'
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_meeting(uuid) TO authenticated, anon;

COMMENT ON FUNCTION public.can_view_meeting(uuid) IS
  'Retorna true se o usuario autenticado pode ver a ata p_meeting_id. '
  'Criador, participantes, global viewers e gerente da unidade da ata. '
  'Migrada de user_units.role para users.role (JOIN) na migration 089.';

-- ============================================================
-- 3. can_view_commercial_task(p_task_id uuid)
--    MUDANCA: substitui leitura de uu.role pelo JOIN com public.users,
--    mantendo o filtro de unit_id.
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_view_commercial_task(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.commercial_tasks ct
    WHERE ct.id = p_task_id
      AND (
        is_global_viewer()
        OR ct.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.user_units uu
          JOIN public.users u ON u.id = uu.user_id
          WHERE uu.user_id = auth.uid()
            AND u.role     = 'gerente'
            AND uu.unit_id = ct.unit_id
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_commercial_task(uuid) TO authenticated, anon;

COMMENT ON FUNCTION public.can_view_commercial_task(uuid) IS
  'Retorna true se o usuario autenticado pode ver a task comercial p_task_id. '
  'Migrada de user_units.role para users.role (JOIN) na migration 089.';

-- ============================================================
-- 4. apply_commercial_template(p_template_id uuid, p_assignee_id uuid, p_base_date date)
--    MUDANCA: na checagem de autorizacao do caller (v_can_create),
--    substitui uu_caller.role = 'gerente' por JOIN com public.users.
--    O SELECT unit_id de user_units para o assignee NAO muda (nao usa role).
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_commercial_template(
  p_template_id uuid,
  p_assignee_id uuid,
  p_base_date   date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template        RECORD;
  v_assignee_exists BOOLEAN;
  v_can_create      BOOLEAN;
  v_inserted        INTEGER := 0;
BEGIN
  -- a) Template visivel ao caller
  IF NOT can_view_commercial_template(p_template_id) THEN
    RAISE EXCEPTION 'template not found or access denied';
  END IF;

  -- Carrega template (garante que esta ativo)
  SELECT id, unit_id, default_priority, default_due_in_days
  INTO v_template
  FROM public.commercial_task_templates
  WHERE id = p_template_id AND active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'template is inactive or not found';
  END IF;

  -- b) Assignee existe
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_assignee_id)
  INTO v_assignee_exists;

  IF NOT v_assignee_exists THEN
    RAISE EXCEPTION 'assignee not found';
  END IF;

  -- c) Caller pode criar tasks para esse assignee
  SELECT (
    is_global_viewer()
    OR auth.uid() = p_assignee_id
    OR EXISTS (
      SELECT 1
      FROM public.user_units uu_caller
      JOIN public.users u_caller ON u_caller.id = uu_caller.user_id
      JOIN public.user_units uu_assignee
        ON uu_assignee.unit_id = uu_caller.unit_id
      WHERE uu_caller.user_id   = auth.uid()
        AND u_caller.role       = 'gerente'
        AND uu_assignee.user_id = p_assignee_id
    )
  ) INTO v_can_create;

  IF NOT v_can_create THEN
    RAISE EXCEPTION 'not authorized to assign tasks to this user';
  END IF;

  -- Determina unit_id da task: usa unit do template; se global, usa primeira unidade do assignee
  -- (gestores sempre criam tasks em unidades concretas)
  INSERT INTO public.commercial_tasks (
    unit_id,
    assignee_id,
    title,
    description,
    priority,
    status,
    due_date,
    source,
    template_id,
    created_by
  )
  SELECT
    COALESCE(
      v_template.unit_id,
      (SELECT unit_id FROM public.user_units WHERE user_id = p_assignee_id LIMIT 1)
    ),
    p_assignee_id,
    ti.title,
    ti.description,
    ti.priority,
    'pending',
    CASE
      WHEN COALESCE(ti.due_in_days, v_template.default_due_in_days) IS NOT NULL
      THEN (p_base_date + COALESCE(ti.due_in_days, v_template.default_due_in_days) * INTERVAL '1 day')
      ELSE NULL
    END,
    'template',
    p_template_id,
    auth.uid()
  FROM public.commercial_template_items ti
  WHERE ti.template_id = p_template_id
  ORDER BY ti.sort_order;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_commercial_template(uuid, uuid, date) TO authenticated, anon;

COMMENT ON FUNCTION public.apply_commercial_template(uuid, uuid, date) IS
  'Aplica um template de checklist comercial criando commercial_tasks para o assignee. '
  'Migrada de user_units.role para users.role (JOIN em uu_caller) na migration 089.';

-- ============================================================
-- 5. Reescrever policies RLS que referenciam user_units.role inline
--    19 policies em 7 tabelas (migrations 044 e 064) contém
--    uu.role = 'gerente' diretamente. PostgreSQL recusa DROP COLUMN
--    enquanto existirem policies referenciando a coluna.
--    Substituicao: JOIN com public.users u ON u.id = uu.user_id
--    e u.role = 'gerente' em vez de uu.role = 'gerente'.
-- ============================================================

-- ── meeting_minutes (3 policies) ──────────────────────────────

DROP POLICY IF EXISTS "meeting_minutes_select" ON public.meeting_minutes;
CREATE POLICY "meeting_minutes_select" ON public.meeting_minutes
  FOR SELECT TO authenticated
  USING (
    (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.meeting_participants mp
        WHERE mp.meeting_id = meeting_minutes.id
          AND mp.user_id = auth.uid()
      )
      OR is_global_viewer()
      OR EXISTS (
        SELECT 1 FROM public.user_units uu
        JOIN public.users u ON u.id = uu.user_id
        WHERE uu.user_id = auth.uid()
          AND uu.unit_id = meeting_minutes.unit_id
          AND u.role     = 'gerente'
      )
    )
  );

DROP POLICY IF EXISTS "meeting_minutes_update" ON public.meeting_minutes;
CREATE POLICY "meeting_minutes_update" ON public.meeting_minutes
  FOR UPDATE TO authenticated
  USING (
    (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
    AND (
      created_by = auth.uid()
      OR is_global_viewer()
      OR EXISTS (
        SELECT 1 FROM public.user_units uu
        JOIN public.users u ON u.id = uu.user_id
        WHERE uu.user_id = auth.uid()
          AND uu.unit_id = meeting_minutes.unit_id
          AND u.role     = 'gerente'
      )
    )
  )
  WITH CHECK (
    unit_id = ANY(get_user_unit_ids())
  );

DROP POLICY IF EXISTS "meeting_minutes_delete" ON public.meeting_minutes;
CREATE POLICY "meeting_minutes_delete" ON public.meeting_minutes
  FOR DELETE TO authenticated
  USING (
    (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
    AND (
      created_by = auth.uid()
      OR is_global_viewer()
      OR EXISTS (
        SELECT 1 FROM public.user_units uu
        JOIN public.users u ON u.id = uu.user_id
        WHERE uu.user_id = auth.uid()
          AND uu.unit_id = meeting_minutes.unit_id
          AND u.role     = 'gerente'
      )
    )
  );

-- ── meeting_participants (3 policies) ─────────────────────────

DROP POLICY IF EXISTS "meeting_participants_insert" ON public.meeting_participants;
CREATE POLICY "meeting_participants_insert" ON public.meeting_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            JOIN public.users u ON u.id = uu.user_id
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND u.role     = 'gerente'
          )
        )
    )
  );

DROP POLICY IF EXISTS "meeting_participants_update" ON public.meeting_participants;
CREATE POLICY "meeting_participants_update" ON public.meeting_participants
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            JOIN public.users u ON u.id = uu.user_id
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND u.role     = 'gerente'
          )
        )
    )
  );

DROP POLICY IF EXISTS "meeting_participants_delete" ON public.meeting_participants;
CREATE POLICY "meeting_participants_delete" ON public.meeting_participants
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            JOIN public.users u ON u.id = uu.user_id
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND u.role     = 'gerente'
          )
        )
    )
  );

-- ── meeting_action_items (3 policies) ─────────────────────────

DROP POLICY IF EXISTS "meeting_action_items_insert" ON public.meeting_action_items;
CREATE POLICY "meeting_action_items_insert" ON public.meeting_action_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            JOIN public.users u ON u.id = uu.user_id
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND u.role     = 'gerente'
          )
        )
    )
  );

DROP POLICY IF EXISTS "meeting_action_items_update" ON public.meeting_action_items;
CREATE POLICY "meeting_action_items_update" ON public.meeting_action_items
  FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            JOIN public.users u ON u.id = uu.user_id
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND u.role     = 'gerente'
          )
        )
    )
  );

DROP POLICY IF EXISTS "meeting_action_items_delete" ON public.meeting_action_items;
CREATE POLICY "meeting_action_items_delete" ON public.meeting_action_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            JOIN public.users u ON u.id = uu.user_id
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND u.role     = 'gerente'
          )
        )
    )
  );

-- ── commercial_task_templates (2 policies) ────────────────────

DROP POLICY IF EXISTS "commercial_task_templates_insert" ON public.commercial_task_templates;
CREATE POLICY "commercial_task_templates_insert"
  ON public.commercial_task_templates FOR INSERT TO authenticated
  WITH CHECK (
    is_global_viewer()
    OR (
      EXISTS (
        SELECT 1 FROM public.user_units uu
        JOIN public.users u ON u.id = uu.user_id
        WHERE uu.user_id = auth.uid()
          AND u.role = 'gerente'
          AND (unit_id IS NULL OR uu.unit_id = unit_id)
      )
    )
  );

DROP POLICY IF EXISTS "commercial_task_templates_update" ON public.commercial_task_templates;
CREATE POLICY "commercial_task_templates_update"
  ON public.commercial_task_templates FOR UPDATE TO authenticated
  USING (
    is_global_viewer()
    OR EXISTS (
      SELECT 1 FROM public.user_units uu
      JOIN public.users u ON u.id = uu.user_id
      WHERE uu.user_id = auth.uid()
        AND u.role = 'gerente'
        AND (unit_id IS NULL OR uu.unit_id = unit_id)
    )
  )
  WITH CHECK (
    is_global_viewer()
    OR EXISTS (
      SELECT 1 FROM public.user_units uu
      JOIN public.users u ON u.id = uu.user_id
      WHERE uu.user_id = auth.uid()
        AND u.role = 'gerente'
        AND (unit_id IS NULL OR uu.unit_id = unit_id)
    )
  );

-- ── commercial_template_items (3 policies) ────────────────────

DROP POLICY IF EXISTS "commercial_template_items_insert" ON public.commercial_template_items;
CREATE POLICY "commercial_template_items_insert"
  ON public.commercial_template_items FOR INSERT TO authenticated
  WITH CHECK (
    is_global_viewer()
    OR EXISTS (
      SELECT 1
      FROM public.commercial_task_templates t
      JOIN public.user_units uu ON uu.user_id = auth.uid()
      JOIN public.users u ON u.id = uu.user_id
      WHERE t.id = template_id
        AND u.role = 'gerente'
        AND (t.unit_id IS NULL OR uu.unit_id = t.unit_id)
    )
  );

DROP POLICY IF EXISTS "commercial_template_items_update" ON public.commercial_template_items;
CREATE POLICY "commercial_template_items_update"
  ON public.commercial_template_items FOR UPDATE TO authenticated
  USING (
    is_global_viewer()
    OR EXISTS (
      SELECT 1
      FROM public.commercial_task_templates t
      JOIN public.user_units uu ON uu.user_id = auth.uid()
      JOIN public.users u ON u.id = uu.user_id
      WHERE t.id = template_id
        AND u.role = 'gerente'
        AND (t.unit_id IS NULL OR uu.unit_id = t.unit_id)
    )
  )
  WITH CHECK (
    is_global_viewer()
    OR EXISTS (
      SELECT 1
      FROM public.commercial_task_templates t
      JOIN public.user_units uu ON uu.user_id = auth.uid()
      JOIN public.users u ON u.id = uu.user_id
      WHERE t.id = template_id
        AND u.role = 'gerente'
        AND (t.unit_id IS NULL OR uu.unit_id = t.unit_id)
    )
  );

DROP POLICY IF EXISTS "commercial_template_items_delete" ON public.commercial_template_items;
CREATE POLICY "commercial_template_items_delete"
  ON public.commercial_template_items FOR DELETE TO authenticated
  USING (
    is_global_viewer()
    OR EXISTS (
      SELECT 1
      FROM public.commercial_task_templates t
      JOIN public.user_units uu ON uu.user_id = auth.uid()
      JOIN public.users u ON u.id = uu.user_id
      WHERE t.id = template_id
        AND u.role = 'gerente'
        AND (t.unit_id IS NULL OR uu.unit_id = t.unit_id)
    )
  );

-- ── commercial_tasks (4 policies) ─────────────────────────────

DROP POLICY IF EXISTS "commercial_tasks_select" ON public.commercial_tasks;
CREATE POLICY "commercial_tasks_select"
  ON public.commercial_tasks FOR SELECT TO authenticated
  USING (
    is_global_viewer()
    OR assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_units uu
      JOIN public.users u ON u.id = uu.user_id
      WHERE uu.user_id = auth.uid()
        AND u.role     = 'gerente'
        AND uu.unit_id = unit_id
    )
  );

DROP POLICY IF EXISTS "commercial_tasks_insert" ON public.commercial_tasks;
CREATE POLICY "commercial_tasks_insert"
  ON public.commercial_tasks FOR INSERT TO authenticated
  WITH CHECK (
    is_global_viewer()
    OR (
      assignee_id = auth.uid()
      AND source = 'manual'
    )
    OR EXISTS (
      SELECT 1 FROM public.user_units uu
      JOIN public.users u ON u.id = uu.user_id
      WHERE uu.user_id = auth.uid()
        AND u.role     = 'gerente'
        AND uu.unit_id = unit_id
    )
  );

DROP POLICY IF EXISTS "commercial_tasks_update" ON public.commercial_tasks;
CREATE POLICY "commercial_tasks_update"
  ON public.commercial_tasks FOR UPDATE TO authenticated
  USING (
    is_global_viewer()
    OR assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_units uu
      JOIN public.users u ON u.id = uu.user_id
      WHERE uu.user_id = auth.uid()
        AND u.role     = 'gerente'
        AND uu.unit_id = unit_id
    )
  )
  WITH CHECK (
    is_global_viewer()
    OR assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_units uu
      JOIN public.users u ON u.id = uu.user_id
      WHERE uu.user_id = auth.uid()
        AND u.role     = 'gerente'
        AND uu.unit_id = unit_id
    )
  );

DROP POLICY IF EXISTS "commercial_tasks_delete" ON public.commercial_tasks;
CREATE POLICY "commercial_tasks_delete"
  ON public.commercial_tasks FOR DELETE TO authenticated
  USING (
    is_global_viewer()
    OR EXISTS (
      SELECT 1 FROM public.user_units uu
      JOIN public.users u ON u.id = uu.user_id
      WHERE uu.user_id = auth.uid()
        AND u.role     = 'gerente'
        AND uu.unit_id = unit_id
    )
  );

-- ── commercial_task_completions (1 policy) ────────────────────

DROP POLICY IF EXISTS "commercial_task_completions_insert" ON public.commercial_task_completions;
CREATE POLICY "commercial_task_completions_insert"
  ON public.commercial_task_completions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.commercial_tasks ct
      WHERE ct.id = task_id
        AND (
          is_global_viewer()
          OR ct.assignee_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            JOIN public.users u ON u.id = uu.user_id
            WHERE uu.user_id = auth.uid()
              AND u.role     = 'gerente'
              AND uu.unit_id = ct.unit_id
          )
        )
    )
  );

-- ============================================================
-- 6. Drop da coluna user_units.role
--    O CHECK constraint user_units_role_check e dropado automaticamente
--    pelo PostgreSQL junto com a coluna (nao precisa de step separado).
-- ============================================================

ALTER TABLE public.user_units DROP COLUMN role;

-- ============================================================
-- 7. Reload do schema cache do PostgREST
-- ============================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
