-- ============================================================
-- Migration 064 — Checklist Comercial: Fundação (Fase 1)
--
-- Cria infraestrutura completa para o módulo de checklist comercial
-- (paralelo ao checklist operacional /checklists, serve ao módulo Vendas).
--
-- Entregáveis:
--   1. commercial_task_templates   — templates reutilizáveis
--   2. commercial_template_items   — itens de cada template
--   3. commercial_tasks            — tasks atribuídas a vendedoras
--   4. commercial_task_completions — log imutável de conclusões
--   5. Triggers update_updated_at (reusa função da migration 001)
--   6. RPC apply_commercial_template — criação atômica de tasks a partir de template
--   7. can_view_commercial_template / can_view_commercial_task — helpers SECURITY DEFINER
--   8. RLS em todas as 4 tabelas
--   9. Fix dedup notificações: adiciona commercial_task_overdue ao índice parcial
-- ============================================================

-- ============================================================
-- 1. TABELAS
-- ============================================================

-- ── 1.1 commercial_task_templates ────────────────────────────
CREATE TABLE IF NOT EXISTS public.commercial_task_templates (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id              UUID        REFERENCES public.units(id) ON DELETE CASCADE,
  -- NULL = template global (visível a todas as unidades)
  title                TEXT        NOT NULL,
  description          TEXT,
  default_priority     TEXT        NOT NULL DEFAULT 'medium'
                         CHECK (default_priority IN ('low', 'medium', 'high')),
  default_due_in_days  INTEGER,
  active               BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by           UUID        REFERENCES public.users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commercial_task_templates_unit_active
  ON public.commercial_task_templates (unit_id, active);

-- ── 1.2 commercial_template_items ────────────────────────────
CREATE TABLE IF NOT EXISTS public.commercial_template_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  UUID        NOT NULL REFERENCES public.commercial_task_templates(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  description  TEXT,
  priority     TEXT        NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low', 'medium', 'high')),
  due_in_days  INTEGER,
  -- NULL = herda default_due_in_days do template pai
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commercial_template_items_template_sort
  ON public.commercial_template_items (template_id, sort_order);

-- ── 1.3 commercial_tasks ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commercial_tasks (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id             UUID        NOT NULL REFERENCES public.units(id),
  assignee_id         UUID        NOT NULL REFERENCES public.users(id),
  title               TEXT        NOT NULL,
  description         TEXT,
  priority            TEXT        CHECK (priority IN ('low', 'medium', 'high')),
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date            TIMESTAMPTZ,
  source              TEXT        NOT NULL DEFAULT 'manual'
                        CHECK (source IN ('manual', 'template', 'automation')),
  template_id         UUID        REFERENCES public.commercial_task_templates(id) ON DELETE SET NULL,
  -- Campos para Fases 2–5 (não usados na Fase 1, mas presentes para evitar re-migrations)
  linked_entity_type  TEXT        CHECK (linked_entity_type IN (
                                    'deal', 'event', 'contact',
                                    'upsell_opportunity', 'recompra_opportunity'
                                  )),
  linked_entity_id    TEXT,
  -- TEXT polimórfico: UUID de evento OU ID int de deal Ploomes
  notes               TEXT,
  created_by          UUID        REFERENCES public.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commercial_tasks_assignee_status_due
  ON public.commercial_tasks (assignee_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_commercial_tasks_unit_status
  ON public.commercial_tasks (unit_id, status);

CREATE INDEX IF NOT EXISTS idx_commercial_tasks_linked_entity
  ON public.commercial_tasks (linked_entity_type, linked_entity_id)
  WHERE linked_entity_type IS NOT NULL;

-- ── 1.4 commercial_task_completions ──────────────────────────
CREATE TABLE IF NOT EXISTS public.commercial_task_completions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID        NOT NULL REFERENCES public.commercial_tasks(id) ON DELETE CASCADE,
  completed_by    UUID        NOT NULL REFERENCES public.users(id),
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT,
  previous_status TEXT
);

CREATE INDEX IF NOT EXISTS idx_commercial_task_completions_task_date
  ON public.commercial_task_completions (task_id, completed_at DESC);

-- ============================================================
-- 2. TRIGGERS update_updated_at
-- Reutiliza função public.update_updated_at() da migration 001.
-- ============================================================

CREATE TRIGGER trg_commercial_task_templates_updated_at
  BEFORE UPDATE ON public.commercial_task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_commercial_tasks_updated_at
  BEFORE UPDATE ON public.commercial_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 3. HELPERS SECURITY DEFINER
-- ============================================================

-- ── 3.1 can_view_commercial_template ─────────────────────────
-- Retorna true quando o usuário logado pode ler o template:
--   - is_global_viewer() (super_admin / diretor) → acesso irrestrito
--   - template global (unit_id IS NULL) → qualquer usuário autenticado
--   - template de unidade → user_units inclui aquela unit_id
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

-- ── 3.2 can_view_commercial_task ─────────────────────────────
-- Retorna true quando o usuário logado pode ler a task:
--   - is_global_viewer() (super_admin / diretor) → acesso irrestrito
--   - assignee_id = auth.uid() → própria task
--   - gerente da unidade da task → vê todas as tasks da unidade
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
        OR EXISTS (
          SELECT 1 FROM public.user_units uu
          WHERE uu.user_id = auth.uid()
            AND uu.role    = 'gerente'
            AND uu.unit_id = ct.unit_id
        )
      )
  );
$$;

-- ============================================================
-- 4. RPC apply_commercial_template
-- Cria N commercial_tasks a partir dos itens de um template,
-- atribuídas a um assignee com data-base p_base_date.
-- Retorna o número de tasks criadas.
--
-- Authorization checks (SECURITY DEFINER bypassa RLS):
--   a) Caller pode visualizar o template
--   b) Assignee existe em users
--   c) Caller pode criar tasks para esse assignee:
--       - is_global_viewer()  → qualquer assignee
--       - self-assign         → qualquer template visível
--       - gerente             → assignee na mesma unidade
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_commercial_template(
  p_template_id  UUID,
  p_assignee_id  UUID,
  p_base_date    DATE
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
  -- a) Template visível ao caller
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
  SELECT (
    is_global_viewer()
    OR auth.uid() = p_assignee_id
    OR EXISTS (
      SELECT 1
      FROM public.user_units uu_caller
      JOIN public.user_units uu_assignee
        ON uu_assignee.unit_id = uu_caller.unit_id
      WHERE uu_caller.user_id  = auth.uid()
        AND uu_caller.role     = 'gerente'
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

-- ============================================================
-- 5. RLS
-- ============================================================

ALTER TABLE public.commercial_task_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_template_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_task_completions ENABLE ROW LEVEL SECURITY;

-- ── 5.1 commercial_task_templates ────────────────────────────

-- SELECT: todos que podem ver (global viewer irrestrito; demais filtram por unidade/global)
CREATE POLICY "commercial_task_templates_select"
  ON public.commercial_task_templates FOR SELECT TO authenticated
  USING (
    is_global_viewer()
    OR unit_id IS NULL
    OR unit_id = ANY(get_user_unit_ids())
  );

-- INSERT: super_admin/diretor irrestrito; gerente somente para sua(s) unidade(s)
CREATE POLICY "commercial_task_templates_insert"
  ON public.commercial_task_templates FOR INSERT TO authenticated
  WITH CHECK (
    is_global_viewer()
    OR (
      EXISTS (
        SELECT 1 FROM public.user_units uu
        WHERE uu.user_id = auth.uid()
          AND uu.role = 'gerente'
          AND (unit_id IS NULL OR uu.unit_id = unit_id)
      )
    )
  );

-- UPDATE: super_admin/diretor irrestrito; gerente somente sua unidade
CREATE POLICY "commercial_task_templates_update"
  ON public.commercial_task_templates FOR UPDATE TO authenticated
  USING (
    is_global_viewer()
    OR EXISTS (
      SELECT 1 FROM public.user_units uu
      WHERE uu.user_id = auth.uid()
        AND uu.role = 'gerente'
        AND (unit_id IS NULL OR uu.unit_id = unit_id)
    )
  )
  WITH CHECK (
    is_global_viewer()
    OR EXISTS (
      SELECT 1 FROM public.user_units uu
      WHERE uu.user_id = auth.uid()
        AND uu.role = 'gerente'
        AND (unit_id IS NULL OR uu.unit_id = unit_id)
    )
  );

-- DELETE: apenas super_admin e diretor (gerente NÃO deleta templates)
CREATE POLICY "commercial_task_templates_delete"
  ON public.commercial_task_templates FOR DELETE TO authenticated
  USING (is_global_viewer());

-- ── 5.2 commercial_template_items ────────────────────────────

CREATE POLICY "commercial_template_items_select"
  ON public.commercial_template_items FOR SELECT TO authenticated
  USING (can_view_commercial_template(template_id));

CREATE POLICY "commercial_template_items_insert"
  ON public.commercial_template_items FOR INSERT TO authenticated
  WITH CHECK (
    is_global_viewer()
    OR EXISTS (
      SELECT 1
      FROM public.commercial_task_templates t
      JOIN public.user_units uu ON uu.user_id = auth.uid()
        AND uu.role = 'gerente'
        AND (t.unit_id IS NULL OR uu.unit_id = t.unit_id)
      WHERE t.id = template_id
    )
  );

CREATE POLICY "commercial_template_items_update"
  ON public.commercial_template_items FOR UPDATE TO authenticated
  USING (
    is_global_viewer()
    OR EXISTS (
      SELECT 1
      FROM public.commercial_task_templates t
      JOIN public.user_units uu ON uu.user_id = auth.uid()
        AND uu.role = 'gerente'
        AND (t.unit_id IS NULL OR uu.unit_id = t.unit_id)
      WHERE t.id = template_id
    )
  )
  WITH CHECK (
    is_global_viewer()
    OR EXISTS (
      SELECT 1
      FROM public.commercial_task_templates t
      JOIN public.user_units uu ON uu.user_id = auth.uid()
        AND uu.role = 'gerente'
        AND (t.unit_id IS NULL OR uu.unit_id = t.unit_id)
      WHERE t.id = template_id
    )
  );

CREATE POLICY "commercial_template_items_delete"
  ON public.commercial_template_items FOR DELETE TO authenticated
  USING (
    is_global_viewer()
    OR EXISTS (
      SELECT 1
      FROM public.commercial_task_templates t
      JOIN public.user_units uu ON uu.user_id = auth.uid()
        AND uu.role = 'gerente'
        AND (t.unit_id IS NULL OR uu.unit_id = t.unit_id)
      WHERE t.id = template_id
    )
  );

-- ── 5.3 commercial_tasks ─────────────────────────────────────

-- SELECT: vendedora (própria), gerente (unidade), diretor/super_admin (tudo)
CREATE POLICY "commercial_tasks_select"
  ON public.commercial_tasks FOR SELECT TO authenticated
  USING (
    is_global_viewer()
    OR assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_units uu
      WHERE uu.user_id = auth.uid()
        AND uu.role    = 'gerente'
        AND uu.unit_id = unit_id
    )
  );

-- INSERT: vendedora (só própria, source='manual'); gerente (unidade); global viewer (irrestrito)
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
      WHERE uu.user_id = auth.uid()
        AND uu.role    = 'gerente'
        AND uu.unit_id = unit_id
    )
  );

-- UPDATE: vendedora (própria task); gerente (unidade); global viewer (irrestrito)
CREATE POLICY "commercial_tasks_update"
  ON public.commercial_tasks FOR UPDATE TO authenticated
  USING (
    is_global_viewer()
    OR assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_units uu
      WHERE uu.user_id = auth.uid()
        AND uu.role    = 'gerente'
        AND uu.unit_id = unit_id
    )
  )
  WITH CHECK (
    is_global_viewer()
    OR assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_units uu
      WHERE uu.user_id = auth.uid()
        AND uu.role    = 'gerente'
        AND uu.unit_id = unit_id
    )
  );

-- DELETE: super_admin, diretor, gerente da unidade
CREATE POLICY "commercial_tasks_delete"
  ON public.commercial_tasks FOR DELETE TO authenticated
  USING (
    is_global_viewer()
    OR EXISTS (
      SELECT 1 FROM public.user_units uu
      WHERE uu.user_id = auth.uid()
        AND uu.role    = 'gerente'
        AND uu.unit_id = unit_id
    )
  );

-- ── 5.4 commercial_task_completions ──────────────────────────

-- SELECT: via can_view_commercial_task (mesma visibilidade da task)
CREATE POLICY "commercial_task_completions_select"
  ON public.commercial_task_completions FOR SELECT TO authenticated
  USING (can_view_commercial_task(task_id));

-- INSERT: mesmas roles que podem UPDATE a task
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
            WHERE uu.user_id = auth.uid()
              AND uu.role    = 'gerente'
              AND uu.unit_id = ct.unit_id
          )
        )
    )
  );

-- UPDATE e DELETE: BLOQUEADOS — log imutável
-- (sem policy = ninguém pode; via service_role ainda é possível em emergências)

-- ============================================================
-- 6. FIX DEDUP NOTIFICAÇÕES
-- Adiciona 'commercial_task_overdue' ao índice parcial e à RPC
-- create_notification. Reusa padrão da migration 047.
-- ============================================================

-- Remover índice antigo (era de 2 tipos)
DROP INDEX IF EXISTS public.idx_notifications_no_daily_dup;

-- Recriar com os 3 tipos (texto literal deve bater com o ON CONFLICT abaixo)
CREATE UNIQUE INDEX idx_notifications_no_daily_dup
  ON public.notifications (user_id, type, link, (timezone('UTC', created_at)::date))
  WHERE type IN ('maintenance_overdue', 'checklist_overdue', 'commercial_task_overdue');

-- Atualizar RPC create_notification (mesma assinatura, adiciona 3º tipo ao WHERE)
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type    TEXT,
  p_title   TEXT,
  p_body    TEXT,
  p_link    TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, is_read)
  VALUES (p_user_id, p_type, p_title, p_body, p_link, FALSE)
  ON CONFLICT (user_id, type, link, (timezone('UTC', created_at)::date))
    WHERE type IN ('maintenance_overdue', 'checklist_overdue', 'commercial_task_overdue')
  DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.create_notification IS
  'Cria notificação. Para tipos overdue (maintenance_overdue, checklist_overdue, commercial_task_overdue), '
  'usa ON CONFLICT DO NOTHING para garantir no máximo 1 por (user, type, link) por dia. '
  'Para demais tipos sempre insere.';
