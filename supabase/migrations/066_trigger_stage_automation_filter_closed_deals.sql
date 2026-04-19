-- ============================================================
-- Migration 066 — Fase 2.6: Filtrar deals ganhos/perdidos
--                            nas automações de stage
--
-- Problema: trg_stage_automation_fn e trigger_stage_automation
-- não filtravam status_id, criando tasks para deals já fechados
-- (Ganho=2, Perdido=3) quando o sync atualizava stage_id.
--
-- Fix: adicionar early-exit IF status_id IN (2, 3) em ambas as
-- funções, imediatamente após os guards de NULL existentes e
-- antes do loop de automações.
--
-- Semântica Ploomes:
--   1 = Em aberto → dispara automação normalmente
--   2 = Ganho      → skip (RETURN NEW / RETURN 0)
--   3 = Perdido    → skip (RETURN NEW / RETURN 0)
-- ============================================================

-- ============================================================
-- 1. trg_stage_automation_fn — trigger Postgres
--    (caminho primário: AFTER INSERT + AFTER UPDATE OF stage_id
--     em ploomes_deals, disparado pelo sync)
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

  -- Deal ganho ou perdido → sem nova automação
  IF NEW.status_id IN (2, 3) THEN
    RAISE NOTICE 'trg_stage_automation_fn: skip ploomes_deal_id=% status_id=% (ganho/perdido)',
      NEW.ploomes_deal_id, NEW.status_id;
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
-- 2. trigger_stage_automation — RPC manual / backfill
--    (caminho secundário: chamado por gestores via Supabase RPC)
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

  -- Deal ganho ou perdido → sem nova automação
  IF v_deal.status_id IN (2, 3) THEN
    RAISE NOTICE 'trigger_stage_automation: skip ploomes_deal_id=% status_id=% (ganho/perdido)',
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
