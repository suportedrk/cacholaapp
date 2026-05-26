-- ============================================================
-- Rollback da Migration 117 — Checklist Comercial RLS golden pattern
--
-- Restaura as 18 policies anteriores (estado pós-089 + 064 + 065) e
-- restaura as 2 funções de visibilidade e as 2 RPCs ao estado anterior.
--
-- ⚠ Aplicar este rollback restaura o acesso amplo de gerente (que foi
-- a redução aprovada na migration 117). Use apenas se a 117 precisar
-- ser revertida por incidente.
--
-- Idempotente.
-- ============================================================

BEGIN;

-- ============================================================
-- PARTE 1 — Restaurar policies anteriores
-- ============================================================

-- ── commercial_task_templates ────────────────────────────────

DROP POLICY IF EXISTS "commercial_task_templates_select" ON public.commercial_task_templates;
CREATE POLICY "commercial_task_templates_select"
  ON public.commercial_task_templates FOR SELECT TO authenticated
  USING (
    is_global_viewer()
    OR unit_id IS NULL
    OR unit_id = ANY(get_user_unit_ids())
  );

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

DROP POLICY IF EXISTS "commercial_task_templates_delete" ON public.commercial_task_templates;
CREATE POLICY "commercial_task_templates_delete"
  ON public.commercial_task_templates FOR DELETE TO authenticated
  USING (is_global_viewer());

-- ── commercial_template_items ────────────────────────────────

DROP POLICY IF EXISTS "commercial_template_items_select" ON public.commercial_template_items;
CREATE POLICY "commercial_template_items_select"
  ON public.commercial_template_items FOR SELECT TO authenticated
  USING (can_view_commercial_template(template_id));

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

-- ── commercial_tasks ────────────────────────────────────────

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

-- ── commercial_task_completions ─────────────────────────────

DROP POLICY IF EXISTS "commercial_task_completions_select" ON public.commercial_task_completions;
CREATE POLICY "commercial_task_completions_select"
  ON public.commercial_task_completions FOR SELECT TO authenticated
  USING (can_view_commercial_task(task_id));

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

-- ── commercial_stage_automations ────────────────────────────

DROP POLICY IF EXISTS "commercial_stage_automations_select" ON public.commercial_stage_automations;
CREATE POLICY "commercial_stage_automations_select"
  ON public.commercial_stage_automations FOR SELECT TO authenticated
  USING (
    is_global_viewer()
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'gerente')
      AND (unit_id IS NULL OR unit_id = ANY(get_user_unit_ids()))
    )
  );

DROP POLICY IF EXISTS "commercial_stage_automations_insert" ON public.commercial_stage_automations;
CREATE POLICY "commercial_stage_automations_insert"
  ON public.commercial_stage_automations FOR INSERT TO authenticated
  WITH CHECK (
    is_global_viewer()
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'gerente')
      AND unit_id IS NOT NULL
      AND unit_id = ANY(get_user_unit_ids())
    )
  );

DROP POLICY IF EXISTS "commercial_stage_automations_update" ON public.commercial_stage_automations;
CREATE POLICY "commercial_stage_automations_update"
  ON public.commercial_stage_automations FOR UPDATE TO authenticated
  USING (
    is_global_viewer()
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'gerente')
      AND (unit_id IS NULL OR unit_id = ANY(get_user_unit_ids()))
    )
  )
  WITH CHECK (
    is_global_viewer()
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'gerente')
      AND unit_id IS NOT NULL
      AND unit_id = ANY(get_user_unit_ids())
    )
  );

DROP POLICY IF EXISTS "commercial_stage_automations_delete" ON public.commercial_stage_automations;
CREATE POLICY "commercial_stage_automations_delete"
  ON public.commercial_stage_automations FOR DELETE TO authenticated
  USING (is_global_viewer());

-- ============================================================
-- PARTE 2 — Restaurar funções
-- ============================================================

-- can_view_commercial_template (estado pós-064)
CREATE OR REPLACE FUNCTION public.can_view_commercial_template(p_template_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.commercial_task_templates t
    WHERE t.id = p_template_id
      AND (
        is_global_viewer()
        OR t.unit_id IS NULL
        OR t.unit_id = ANY(get_user_unit_ids())
      )
  );
$$;

-- can_view_commercial_task (estado pós-089)
CREATE OR REPLACE FUNCTION public.can_view_commercial_task(p_task_id UUID)
RETURNS BOOLEAN
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

-- apply_commercial_template (estado pós-089)
CREATE OR REPLACE FUNCTION public.apply_commercial_template(
  p_template_id UUID,
  p_assignee_id UUID,
  p_base_date   DATE
)
RETURNS INTEGER
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
  IF NOT can_view_commercial_template(p_template_id) THEN
    RAISE EXCEPTION 'template not found or access denied';
  END IF;

  SELECT id, unit_id, default_priority, default_due_in_days
  INTO v_template
  FROM public.commercial_task_templates
  WHERE id = p_template_id AND active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'template is inactive or not found';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_assignee_id)
  INTO v_assignee_exists;

  IF NOT v_assignee_exists THEN
    RAISE EXCEPTION 'assignee not found';
  END IF;

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

  INSERT INTO public.commercial_tasks (
    unit_id, assignee_id, title, description, priority, status,
    due_date, source, template_id, created_by
  )
  SELECT
    COALESCE(
      v_template.unit_id,
      (SELECT unit_id FROM public.user_units WHERE user_id = p_assignee_id LIMIT 1)
    ),
    p_assignee_id, ti.title, ti.description, ti.priority, 'pending',
    CASE
      WHEN COALESCE(ti.due_in_days, v_template.default_due_in_days) IS NOT NULL
      THEN (p_base_date + COALESCE(ti.due_in_days, v_template.default_due_in_days) * INTERVAL '1 day')
      ELSE NULL
    END,
    'template', p_template_id, auth.uid()
  FROM public.commercial_template_items ti
  WHERE ti.template_id = p_template_id
  ORDER BY ti.sort_order;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- trigger_stage_automation (estado pós-066: gerente reincluído)
CREATE OR REPLACE FUNCTION public.trigger_stage_automation(p_ploomes_deal_id BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal        RECORD;
  v_automation  RECORD;
  v_assignee_id UUID;
  v_unit_id     UUID;
  v_inserted    INTEGER := 0;
  v_this_run    INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id   = auth.uid()
      AND role IN ('super_admin', 'diretor', 'gerente')
  ) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  SELECT * INTO v_deal
  FROM public.ploomes_deals
  WHERE ploomes_deal_id = p_ploomes_deal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deal não encontrado: %', p_ploomes_deal_id;
  END IF;

  IF v_deal.owner_id IS NULL OR v_deal.stage_id IS NULL THEN
    RETURN 0;
  END IF;

  IF v_deal.status_id IN (2, 3) THEN
    RAISE NOTICE 'trigger_stage_automation: skip deal % com status_id=%',
      p_ploomes_deal_id, v_deal.status_id;
    RETURN 0;
  END IF;

  FOR v_automation IN
    SELECT
      csa.id                   AS automation_id,
      csa.unit_id              AS automation_unit_id,
      csa.template_id,
      ctt.default_due_in_days,
      ctt.default_priority
    FROM public.commercial_stage_automations csa
    JOIN public.commercial_task_templates ctt
      ON ctt.id     = csa.template_id
     AND ctt.active = TRUE
    WHERE csa.stage_id = v_deal.stage_id
      AND csa.active   = TRUE
      AND (csa.unit_id IS NULL OR csa.unit_id = v_deal.unit_id)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.commercial_tasks ct
      WHERE ct.automation_source_id = v_automation.automation_id
        AND ct.automation_deal_id   = p_ploomes_deal_id
        AND ct.status NOT IN ('completed', 'cancelled')
    ) THEN
      CONTINUE;
    END IF;

    SELECT u.id INTO v_assignee_id
    FROM public.sellers s
    JOIN public.users u ON u.seller_id = s.id
    WHERE s.owner_id         = v_deal.owner_id
      AND s.status           = 'active'
      AND s.is_system_account = FALSE
    LIMIT 1;

    IF v_assignee_id IS NULL THEN
      CONTINUE;
    END IF;

    v_unit_id := COALESCE(v_automation.automation_unit_id, v_deal.unit_id);
    IF v_unit_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.commercial_tasks (
      unit_id, assignee_id, title, description, priority, status,
      due_date, source, template_id, linked_entity_type, linked_entity_id,
      automation_deal_id, automation_stage_id, automation_source_id
    )
    SELECT
      v_unit_id, v_assignee_id, ti.title, ti.description,
      COALESCE(ti.priority, v_automation.default_priority, 'medium'),
      'pending',
      CASE
        WHEN COALESCE(ti.due_in_days, v_automation.default_due_in_days) IS NOT NULL
        THEN NOW() + COALESCE(ti.due_in_days, v_automation.default_due_in_days) * INTERVAL '1 day'
        ELSE NULL
      END,
      'automation', v_automation.template_id, 'deal',
      p_ploomes_deal_id::TEXT, p_ploomes_deal_id, v_deal.stage_id,
      v_automation.automation_id
    FROM public.commercial_template_items ti
    WHERE ti.template_id = v_automation.template_id
    ORDER BY ti.sort_order;

    GET DIAGNOSTICS v_this_run = ROW_COUNT;
    v_inserted := v_inserted + v_this_run;
  END LOOP;

  RETURN v_inserted;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
