-- ============================================================
-- Migration 117 — Checklist Comercial: RLS molde de ouro (Fase 2)
-- Criado em: 2026-05-26
-- Referência: docs/rbac/proposta-arquitetura-alvo.md
--             + Aprendizado 5 (semânticas de view distintas por tabela)
--
-- Segunda e última migration do módulo checklist_comercial.
-- Substitui a lógica inline users.role='gerente' por check_permission
-- nas 5 tabelas do módulo, e atualiza as funções SECURITY DEFINER
-- correspondentes.
--
-- ── MAPA DE SELECT POR TABELA (Aprendizado 5) ──────────────────
-- view tem semânticas distintas por tabela; um único
-- check_permission('checklist_comercial','view') não distingue.
--
-- commercial_task_templates    → CATÁLOGO  → check_permission(view)
--                                + (is_global_viewer OR NULL OR unit)
-- commercial_template_items    → CATÁLOGO  → via can_view_commercial_template
-- commercial_tasks             → PROPRIEDADE → is_global_viewer OR assignee
--                                (SEM check_permission(view))
-- commercial_task_completions  → PROPRIEDADE → via can_view_commercial_task
-- commercial_stage_automations → ESTRUTURAL → is_global_viewer
--                                (SEM check_permission(view))
--
-- ── DUAS REDUÇÕES APROVADAS ───────────────────────────────────
-- (a) gerente sai do acesso amplo — lógica inline users.role='gerente'
--     é removida. Gerente mantém só as próprias tasks via assignee
--     (igual a qualquer cargo logado).
-- (b) Os 6 cargos sem tela (decoracao, manutencao, financeiro, rh,
--     freelancer, entregador) perdem leitura de templates globais —
--     consequência natural de check_permission(view) + sem backfill
--     para esses cargos.
--
-- Pré-condições:
--   - migration 107 aplicada (permission_controls catalog)
--   - migration 116 aplicada (template + backfill)
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Pré-validação: cobertura do backfill
-- ------------------------------------------------------------
DO $$
DECLARE
  v_diretor_gap   INT;
  v_posvendas_gap INT;
  v_vendedora_gap INT;
BEGIN
  SELECT COUNT(*) INTO v_diretor_gap
  FROM public.users u
  WHERE u.role = 'diretor' AND u.is_active = true
    AND (
      SELECT COUNT(*) FROM public.user_permissions up
      WHERE up.user_id = u.id
        AND up.module = 'checklist_comercial'
        AND up.action IN ('view','create','edit','delete')
        AND up.granted = true
    ) <> 4;

  SELECT COUNT(*) INTO v_posvendas_gap
  FROM public.users u
  WHERE u.role = 'pos_vendas' AND u.is_active = true
    AND (
      SELECT COUNT(*) FROM public.user_permissions up
      WHERE up.user_id = u.id
        AND up.module = 'checklist_comercial'
        AND up.action IN ('view','create','edit','delete')
        AND up.granted = true
    ) <> 4;

  SELECT COUNT(*) INTO v_vendedora_gap
  FROM public.users u
  WHERE u.role = 'vendedora' AND u.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = u.id
        AND up.module = 'checklist_comercial'
        AND up.action = 'view'
        AND up.granted = true
    );

  IF v_diretor_gap + v_posvendas_gap + v_vendedora_gap > 0 THEN
    RAISE EXCEPTION
      'Abortando: backfill incompleto. diretor_gap=%, posvendas_gap=%, vendedora_gap=%. Aplicar migration 116 antes desta.',
      v_diretor_gap, v_posvendas_gap, v_vendedora_gap;
  END IF;
END
$$;

-- ============================================================
-- PARTE 1 — Atualizar funções de visibilidade SECURITY DEFINER
-- ============================================================

-- can_view_commercial_template
-- Eixo: CATÁLOGO. Quem tem view granted enxerga templates globais
-- (unit_id IS NULL) e templates das próprias unidades.
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
      AND check_permission(auth.uid(), 'checklist_comercial', 'view')
      AND (
        is_global_viewer()
        OR t.unit_id IS NULL
        OR t.unit_id = ANY(get_user_unit_ids())
      )
  );
$$;

COMMENT ON FUNCTION public.can_view_commercial_template(UUID) IS
  'Retorna true se o usuário pode ver o template p_template_id. '
  'Eixo CATÁLOGO (Aprendizado 5): exige check_permission(view) granted '
  'e unidade compatível ou template global. '
  'Migrada para check_permission na migration 117.';

-- can_view_commercial_task
-- Eixo: PROPRIEDADE. Sem check_permission(view) — usar isso aqui
-- expandiria a visão de quem tem view granted (vendedora) para
-- tasks de outros assignees na mesma unidade.
CREATE OR REPLACE FUNCTION public.can_view_commercial_task(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.commercial_tasks ct
    WHERE ct.id = p_task_id
      AND (
        is_global_viewer()
        OR ct.assignee_id = auth.uid()
      )
  );
$$;

COMMENT ON FUNCTION public.can_view_commercial_task(UUID) IS
  'Retorna true se o usuário pode ver a task comercial p_task_id. '
  'Eixo PROPRIEDADE (Aprendizado 5): is_global_viewer OR assignee. '
  'NÃO usa check_permission(view) — isso expandiria acesso de cargos '
  'com view granted (vendedora) que devem só ver as próprias tasks. '
  'Reescrita na migration 117 — gerente perde a visão por unidade.';

-- ============================================================
-- PARTE 2 — DROP + CREATE de policies (5 tabelas × N policies)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 2.1 commercial_task_templates (CATÁLOGO)
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "commercial_task_templates_select" ON public.commercial_task_templates;
CREATE POLICY "commercial_task_templates_select"
  ON public.commercial_task_templates FOR SELECT TO authenticated
  USING (
    check_permission(auth.uid(), 'checklist_comercial', 'view')
    AND (
      is_global_viewer()
      OR unit_id IS NULL
      OR unit_id = ANY(get_user_unit_ids())
    )
  );

DROP POLICY IF EXISTS "commercial_task_templates_insert" ON public.commercial_task_templates;
CREATE POLICY "commercial_task_templates_insert"
  ON public.commercial_task_templates FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'checklist_comercial', 'create')
    AND (
      is_global_viewer()
      OR unit_id = ANY(get_user_unit_ids())
    )
  );

DROP POLICY IF EXISTS "commercial_task_templates_update" ON public.commercial_task_templates;
CREATE POLICY "commercial_task_templates_update"
  ON public.commercial_task_templates FOR UPDATE TO authenticated
  USING (
    check_permission(auth.uid(), 'checklist_comercial', 'edit')
    AND (
      is_global_viewer()
      OR unit_id = ANY(get_user_unit_ids())
    )
  )
  WITH CHECK (
    check_permission(auth.uid(), 'checklist_comercial', 'edit')
    AND (
      is_global_viewer()
      OR unit_id = ANY(get_user_unit_ids())
    )
  );

DROP POLICY IF EXISTS "commercial_task_templates_delete" ON public.commercial_task_templates;
CREATE POLICY "commercial_task_templates_delete"
  ON public.commercial_task_templates FOR DELETE TO authenticated
  USING (
    check_permission(auth.uid(), 'checklist_comercial', 'delete')
    AND (
      is_global_viewer()
      OR unit_id = ANY(get_user_unit_ids())
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2.2 commercial_template_items (CATÁLOGO via can_view_commercial_template)
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "commercial_template_items_select" ON public.commercial_template_items;
CREATE POLICY "commercial_template_items_select"
  ON public.commercial_template_items FOR SELECT TO authenticated
  USING (can_view_commercial_template(template_id));

DROP POLICY IF EXISTS "commercial_template_items_insert" ON public.commercial_template_items;
CREATE POLICY "commercial_template_items_insert"
  ON public.commercial_template_items FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'checklist_comercial', 'create')
    AND EXISTS (
      SELECT 1 FROM public.commercial_task_templates t
      WHERE t.id = template_id
        AND (
          is_global_viewer()
          OR t.unit_id = ANY(get_user_unit_ids())
        )
    )
  );

DROP POLICY IF EXISTS "commercial_template_items_update" ON public.commercial_template_items;
CREATE POLICY "commercial_template_items_update"
  ON public.commercial_template_items FOR UPDATE TO authenticated
  USING (
    check_permission(auth.uid(), 'checklist_comercial', 'edit')
    AND EXISTS (
      SELECT 1 FROM public.commercial_task_templates t
      WHERE t.id = template_id
        AND (
          is_global_viewer()
          OR t.unit_id = ANY(get_user_unit_ids())
        )
    )
  )
  WITH CHECK (
    check_permission(auth.uid(), 'checklist_comercial', 'edit')
    AND EXISTS (
      SELECT 1 FROM public.commercial_task_templates t
      WHERE t.id = template_id
        AND (
          is_global_viewer()
          OR t.unit_id = ANY(get_user_unit_ids())
        )
    )
  );

DROP POLICY IF EXISTS "commercial_template_items_delete" ON public.commercial_template_items;
CREATE POLICY "commercial_template_items_delete"
  ON public.commercial_template_items FOR DELETE TO authenticated
  USING (
    check_permission(auth.uid(), 'checklist_comercial', 'delete')
    AND EXISTS (
      SELECT 1 FROM public.commercial_task_templates t
      WHERE t.id = template_id
        AND (
          is_global_viewer()
          OR t.unit_id = ANY(get_user_unit_ids())
        )
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2.3 commercial_tasks (PROPRIEDADE)
-- ─────────────────────────────────────────────────────────────

-- SELECT: PROPRIEDADE pura — sem check_permission(view) (Aprendizado 5).
DROP POLICY IF EXISTS "commercial_tasks_select" ON public.commercial_tasks;
CREATE POLICY "commercial_tasks_select"
  ON public.commercial_tasks FOR SELECT TO authenticated
  USING (
    is_global_viewer()
    OR assignee_id = auth.uid()
  );

-- INSERT: golden + exceção de assignee self+manual (preserva ANTES).
DROP POLICY IF EXISTS "commercial_tasks_insert" ON public.commercial_tasks;
CREATE POLICY "commercial_tasks_insert"
  ON public.commercial_tasks FOR INSERT TO authenticated
  WITH CHECK (
    (
      check_permission(auth.uid(), 'checklist_comercial', 'create')
      AND (
        is_global_viewer()
        OR unit_id = ANY(get_user_unit_ids())
      )
    )
    OR (
      assignee_id = auth.uid()
      AND source = 'manual'
    )
  );

-- UPDATE: golden + exceção de assignee (qualquer source).
DROP POLICY IF EXISTS "commercial_tasks_update" ON public.commercial_tasks;
CREATE POLICY "commercial_tasks_update"
  ON public.commercial_tasks FOR UPDATE TO authenticated
  USING (
    (
      check_permission(auth.uid(), 'checklist_comercial', 'edit')
      AND (
        is_global_viewer()
        OR unit_id = ANY(get_user_unit_ids())
      )
    )
    OR assignee_id = auth.uid()
  )
  WITH CHECK (
    (
      check_permission(auth.uid(), 'checklist_comercial', 'edit')
      AND (
        is_global_viewer()
        OR unit_id = ANY(get_user_unit_ids())
      )
    )
    OR assignee_id = auth.uid()
  );

-- DELETE: golden SEM exceção de assignee (ANTES o dono não deletava própria task).
DROP POLICY IF EXISTS "commercial_tasks_delete" ON public.commercial_tasks;
CREATE POLICY "commercial_tasks_delete"
  ON public.commercial_tasks FOR DELETE TO authenticated
  USING (
    check_permission(auth.uid(), 'checklist_comercial', 'delete')
    AND (
      is_global_viewer()
      OR unit_id = ANY(get_user_unit_ids())
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2.4 commercial_task_completions (PROPRIEDADE via can_view_commercial_task)
-- ─────────────────────────────────────────────────────────────

-- SELECT: herda regra de PROPRIEDADE da task subjacente.
DROP POLICY IF EXISTS "commercial_task_completions_select" ON public.commercial_task_completions;
CREATE POLICY "commercial_task_completions_select"
  ON public.commercial_task_completions FOR SELECT TO authenticated
  USING (can_view_commercial_task(task_id));

-- INSERT: permitida para quem pode AGIR na task subjacente.
-- "Agir" = is_global_viewer ou ser o assignee — mesma regra do
-- can_view_commercial_task. Reduz gerente (era da unit).
DROP POLICY IF EXISTS "commercial_task_completions_insert" ON public.commercial_task_completions;
CREATE POLICY "commercial_task_completions_insert"
  ON public.commercial_task_completions FOR INSERT TO authenticated
  WITH CHECK (can_view_commercial_task(task_id));

-- UPDATE e DELETE: continuam BLOQUEADAS (log imutável).

-- ─────────────────────────────────────────────────────────────
-- 2.5 commercial_stage_automations (ESTRUTURAL)
-- ─────────────────────────────────────────────────────────────

-- SELECT: ESTRUTURAL — só is_global_viewer (Aprendizado 5).
DROP POLICY IF EXISTS "commercial_stage_automations_select" ON public.commercial_stage_automations;
CREATE POLICY "commercial_stage_automations_select"
  ON public.commercial_stage_automations FOR SELECT TO authenticated
  USING (is_global_viewer());

-- INSERT: golden — check_permission(create) + unit-match (NULL exige is_global_viewer).
DROP POLICY IF EXISTS "commercial_stage_automations_insert" ON public.commercial_stage_automations;
CREATE POLICY "commercial_stage_automations_insert"
  ON public.commercial_stage_automations FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'checklist_comercial', 'create')
    AND (
      is_global_viewer()
      OR unit_id = ANY(get_user_unit_ids())
    )
  );

DROP POLICY IF EXISTS "commercial_stage_automations_update" ON public.commercial_stage_automations;
CREATE POLICY "commercial_stage_automations_update"
  ON public.commercial_stage_automations FOR UPDATE TO authenticated
  USING (
    check_permission(auth.uid(), 'checklist_comercial', 'edit')
    AND (
      is_global_viewer()
      OR unit_id = ANY(get_user_unit_ids())
    )
  )
  WITH CHECK (
    check_permission(auth.uid(), 'checklist_comercial', 'edit')
    AND (
      is_global_viewer()
      OR unit_id = ANY(get_user_unit_ids())
    )
  );

DROP POLICY IF EXISTS "commercial_stage_automations_delete" ON public.commercial_stage_automations;
CREATE POLICY "commercial_stage_automations_delete"
  ON public.commercial_stage_automations FOR DELETE TO authenticated
  USING (
    check_permission(auth.uid(), 'checklist_comercial', 'delete')
    AND (
      is_global_viewer()
      OR unit_id = ANY(get_user_unit_ids())
    )
  );

-- ============================================================
-- PARTE 3 — RPCs SECURITY DEFINER
-- ============================================================

-- 3.1 apply_commercial_template
-- Guard de criação migra para check_permission(create).
-- Self-assign (auth.uid() = p_assignee_id) PRESERVADO como exceção —
-- mantém quem cria hoje, exceto a redução do gerente.
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
  -- a) Template visível ao caller (reflete novo can_view_commercial_template)
  IF NOT can_view_commercial_template(p_template_id) THEN
    RAISE EXCEPTION 'template not found or access denied';
  END IF;

  -- Carrega template (garante que está ativo)
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
  --    check_permission(create) — quem tem permissão configurável
  --    OR auth.uid() = p_assignee_id — self-assign preservado
  v_can_create := (
    check_permission(auth.uid(), 'checklist_comercial', 'create')
    OR auth.uid() = p_assignee_id
  );

  IF NOT v_can_create THEN
    RAISE EXCEPTION 'not authorized to assign tasks to this user';
  END IF;

  -- Determina unit_id da task: usa unit do template; se global, usa primeira unidade do assignee
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

COMMENT ON FUNCTION public.apply_commercial_template(UUID, UUID, DATE) IS
  'Aplica template criando commercial_tasks para o assignee. '
  'Guard de criação via check_permission(checklist_comercial, create) — '
  'gerente perde acesso, demais cargos com create preservados. '
  'Self-assign mantido como exceção. Reescrita na migration 117.';

-- 3.2 trigger_stage_automation
-- Guard role-based, MENOS gerente. NÃO migra para check_permission
-- aqui porque check_permission(create) incluiria pos_vendas — que
-- hoje não dispara. Manter role-based preserva exatamente quem
-- dispara hoje, menos o gerente.
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
  -- Apenas super_admin e diretor podem disparar manualmente
  -- (gerente removido na migration 117 — Q4 aprovado)
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id   = auth.uid()
      AND role IN ('super_admin', 'diretor')
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

  -- Filtro status_id (Migration 066): pula deals ganhos/perdidos
  IF v_deal.status_id IN (2, 3) THEN
    RAISE NOTICE 'trigger_stage_automation: skip deal % com status_id=% (ganho/perdido)',
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
      unit_id,
      assignee_id,
      title,
      description,
      priority,
      status,
      due_date,
      source,
      template_id,
      linked_entity_type,
      linked_entity_id,
      automation_deal_id,
      automation_stage_id,
      automation_source_id
    )
    SELECT
      v_unit_id,
      v_assignee_id,
      ti.title,
      ti.description,
      COALESCE(ti.priority, v_automation.default_priority, 'medium'),
      'pending',
      CASE
        WHEN COALESCE(ti.due_in_days, v_automation.default_due_in_days) IS NOT NULL
        THEN NOW() + COALESCE(ti.due_in_days, v_automation.default_due_in_days)
                     * INTERVAL '1 day'
        ELSE NULL
      END,
      'automation',
      v_automation.template_id,
      'deal',
      p_ploomes_deal_id::TEXT,
      p_ploomes_deal_id,
      v_deal.stage_id,
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

COMMENT ON FUNCTION public.trigger_stage_automation(BIGINT) IS
  'Dispara avaliação de automações para um deal. Guard role-based: '
  'apenas super_admin e diretor (gerente removido na migration 117 — Q4). '
  'Mantém role-based em vez de check_permission para preservar exatamente '
  'quem dispara hoje (não incluir pos_vendas que tem create granted mas '
  'nunca disparou esta RPC).';

-- 3.3 trg_stage_automation_fn — NÃO ALTERADA (trigger interno, sem auth.uid)

-- ============================================================
-- PARTE 4 — Pós-validação: estado das policies
-- ============================================================

DO $$
DECLARE
  v_total INT;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'commercial_task_templates',
      'commercial_template_items',
      'commercial_tasks',
      'commercial_task_completions',
      'commercial_stage_automations'
    );

  -- Esperado: 4 + 4 + 4 + 2 + 4 = 18 policies
  IF v_total <> 18 THEN
    RAISE EXCEPTION
      'Pós-condição falhou: esperava 18 policies no módulo, encontrei %.',
      v_total;
  END IF;

  RAISE NOTICE 'OK: 18 policies criadas (4+4+4+2+4) nas 5 tabelas do checklist_comercial.';
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
