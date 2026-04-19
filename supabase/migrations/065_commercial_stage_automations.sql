-- ============================================================
-- Migration 065 — Checklist Comercial: Jornada do Negócio (Fase 2)
--
-- Automações que criam commercial_tasks automaticamente quando um
-- deal Ploomes entra em um determinado stage.
--
-- Entregáveis:
--   1. commercial_stage_automations — regras de automação por stage
--   2. ALTER commercial_tasks       — campos automation_*
--   3. Índices de performance       — trigger + idempotência
--   4. RLS em commercial_stage_automations
--   5. trg_stage_automation_fn()    — função do trigger
--   6. Triggers em ploomes_deals    — AFTER INSERT + AFTER UPDATE OF stage_id
--   7. trigger_stage_automation()   — RPC para disparo manual/backfill
--   8. get_ploomes_stages()         — helper para UI (stages distintos)
-- ============================================================

-- ============================================================
-- 1. TABELA commercial_stage_automations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.commercial_stage_automations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     UUID        REFERENCES public.units(id) ON DELETE CASCADE,
  -- NULL = aplica a todas as unidades
  stage_id    BIGINT      NOT NULL,
  stage_name  TEXT,
  -- snapshot denormalizado para exibição na UI (atualizado pelo sync)
  template_id UUID        NOT NULL
                REFERENCES public.commercial_task_templates(id) ON DELETE CASCADE,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by  UUID        REFERENCES public.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evita duplicar a mesma regra para a mesma unidade+stage+template
CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_stage_automations_unit_unique
  ON public.commercial_stage_automations (unit_id, stage_id, template_id)
  WHERE unit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_stage_automations_global_unique
  ON public.commercial_stage_automations (stage_id, template_id)
  WHERE unit_id IS NULL;

-- Índice de performance para o trigger (filtra stage_id + active)
CREATE INDEX IF NOT EXISTS idx_commercial_stage_automations_stage_active
  ON public.commercial_stage_automations (stage_id)
  WHERE active = TRUE;

CREATE TRIGGER trg_commercial_stage_automations_updated_at
  BEFORE UPDATE ON public.commercial_stage_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 2. ALTER commercial_tasks — campos de automação
-- ============================================================

ALTER TABLE public.commercial_tasks
  ADD COLUMN IF NOT EXISTS automation_deal_id   BIGINT,
  ADD COLUMN IF NOT EXISTS automation_stage_id  BIGINT,
  ADD COLUMN IF NOT EXISTS automation_source_id UUID
    REFERENCES public.commercial_stage_automations(id) ON DELETE SET NULL;

-- Índice para a verificação de idempotência no trigger
CREATE INDEX IF NOT EXISTS idx_commercial_tasks_automation_check
  ON public.commercial_tasks (automation_source_id, automation_deal_id)
  WHERE automation_source_id IS NOT NULL AND automation_deal_id IS NOT NULL;

-- ============================================================
-- 3. RLS — commercial_stage_automations
-- ============================================================

ALTER TABLE public.commercial_stage_automations ENABLE ROW LEVEL SECURITY;

-- SELECT: global viewers veem tudo; gerente vê global + sua unidade
CREATE POLICY "commercial_stage_automations_select"
  ON public.commercial_stage_automations FOR SELECT TO authenticated
  USING (
    is_global_viewer()
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'gerente')
      AND (unit_id IS NULL OR unit_id = ANY(get_user_unit_ids()))
    )
  );

-- INSERT: global viewers irrestrito; gerente somente unidade própria (não global)
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

-- UPDATE: mesma regra que INSERT
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

-- DELETE: apenas super_admin e diretor
CREATE POLICY "commercial_stage_automations_delete"
  ON public.commercial_stage_automations FOR DELETE TO authenticated
  USING (is_global_viewer());

-- ============================================================
-- 4. FUNÇÃO DO TRIGGER — trg_stage_automation_fn
--
-- Executada AFTER INSERT e AFTER UPDATE OF stage_id em ploomes_deals.
-- Para cada automação ativa que bate com o novo stage_id do deal:
--   a) Verifica idempotência (skip se task ativa já existe)
--   b) Resolve a vendedora (via sellers.owner_id → users.seller_id)
--   c) Insere uma task por item do template
--   d) Isola erros por automação (EXCEPTION WHEN OTHERS)
--
-- SECURITY DEFINER: auth.uid() retorna NULL em contexto de trigger;
-- a autorização é implícita (apenas o cron/sync escrevem em ploomes_deals).
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_stage_automation_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_automation  RECORD;
  v_assignee_id UUID;
  v_unit_id     UUID;
BEGIN
  -- Sem owner → impossível atribuir a vendedora → retorna sem ação
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sem stage → nada a fazer
  IF NEW.stage_id IS NULL THEN
    RETURN NEW;
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
    WHERE csa.stage_id = NEW.stage_id
      AND csa.active   = TRUE
      AND (csa.unit_id IS NULL OR csa.unit_id = NEW.unit_id)
  LOOP
    -- Idempotência: pula se já existe qualquer task ativa desta automação+deal
    IF EXISTS (
      SELECT 1
      FROM public.commercial_tasks ct
      WHERE ct.automation_source_id = v_automation.automation_id
        AND ct.automation_deal_id   = NEW.ploomes_deal_id
        AND ct.status NOT IN ('completed', 'cancelled')
    ) THEN
      CONTINUE;
    END IF;

    -- Resolve a vendedora vinculada ao owner do deal
    SELECT u.id INTO v_assignee_id
    FROM public.sellers s
    JOIN public.users u ON u.seller_id = s.id
    WHERE s.owner_id         = NEW.owner_id
      AND s.status           = 'active'
      AND s.is_system_account = FALSE
    LIMIT 1;

    -- Sem vendedora cadastrada ou sem usuário vinculado → pula
    IF v_assignee_id IS NULL THEN
      CONTINUE;
    END IF;

    -- unit_id da task: usa unidade da automação, depois a do deal
    v_unit_id := COALESCE(v_automation.automation_unit_id, NEW.unit_id);

    -- Deal sem unidade → pula
    IF v_unit_id IS NULL THEN
      CONTINUE;
    END IF;

    BEGIN
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
        NEW.ploomes_deal_id::TEXT,
        NEW.ploomes_deal_id,
        NEW.stage_id,
        v_automation.automation_id
      FROM public.commercial_template_items ti
      WHERE ti.template_id = v_automation.template_id
      ORDER BY ti.sort_order;

    EXCEPTION WHEN OTHERS THEN
      -- Isola falhas: 1 automação com erro não cancela as demais
      RAISE WARNING
        'trg_stage_automation_fn: erro ao criar tasks (automation=%, deal=%, stage=%): %',
        v_automation.automation_id, NEW.ploomes_deal_id, NEW.stage_id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. TRIGGERS em ploomes_deals
-- ============================================================

-- Dispara quando stage_id muda em um deal existente
CREATE TRIGGER trg_stage_automation_update
  AFTER UPDATE OF stage_id ON public.ploomes_deals
  FOR EACH ROW
  WHEN (NEW.stage_id IS DISTINCT FROM OLD.stage_id)
  EXECUTE FUNCTION public.trg_stage_automation_fn();

-- Dispara quando um novo deal é inserido
CREATE TRIGGER trg_stage_automation_insert
  AFTER INSERT ON public.ploomes_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_stage_automation_fn();

-- ============================================================
-- 6. RPC trigger_stage_automation — disparo manual / backfill
--
-- Permite que gestores forcem a avaliação de automações para um
-- deal específico (útil para backfill de deals que já passaram
-- por stages antes das automações serem criadas).
-- ============================================================

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
  -- Apenas MANAGE_ROLES podem disparar manualmente
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

-- ============================================================
-- 7. get_ploomes_stages — helper para UI
--
-- Retorna os stages distintos presentes em ploomes_deals,
-- ordenados por nome. Usado no dropdown de criação de automações.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_ploomes_stages()
RETURNS TABLE(stage_id BIGINT, stage_name TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ON (pd.stage_id)
    pd.stage_id,
    pd.stage_name
  FROM public.ploomes_deals pd
  WHERE pd.stage_id IS NOT NULL
    AND pd.stage_name IS NOT NULL
  ORDER BY pd.stage_id, pd.stage_name;
$$;
