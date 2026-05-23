-- ============================================================
-- Migration 101 — Módulo Decoração: vínculo OS ↔ Festa
--
-- Pedaço 2: permite que uma Ordem de Serviço de balões seja
-- associada a uma festa existente (tabela `events`). O vínculo
-- é opcional — OS sem event_id continua funcionando normalmente.
--
-- Quando vinculada:
--   • data_festa, hora_festa e unit_id são copiados da festa
--     (fonte da verdade fica na festa; OS guarda a cópia)
--   • A FK event_id é mantida para navegação e aviso de duplicata
--   • ON DELETE SET NULL: se a festa for excluída, a OS sobrevive
--     com os dados copiados e event_id vira NULL
--
-- Rollback: 101_decoracao_os_link_event_rollback.sql
-- ============================================================

BEGIN;

-- ── 1. NOVA COLUNA ────────────────────────────────────────────
ALTER TABLE public.decoracao_os
  ADD COLUMN IF NOT EXISTS event_id uuid
    REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_decoracao_os_event
  ON public.decoracao_os (event_id)
  WHERE event_id IS NOT NULL;

-- ── 2. RPC: buscar festas para vínculo ───────────────────────
-- Retorna eventos visíveis ao usuário (RLS em events aplica via
-- SECURITY INVOKER). Exclui status='lost'. Filtros: janela de
-- data, texto livre em client_name/birthday_person/theme.
-- Sem p_date_from/to retorna janela padrão (-30 / +90 dias).
DROP FUNCTION IF EXISTS public.search_events_for_os_link(text, date, date);

CREATE OR REPLACE FUNCTION public.search_events_for_os_link(
  p_search    text    DEFAULT NULL,
  p_date_from date    DEFAULT NULL,
  p_date_to   date    DEFAULT NULL
)
RETURNS TABLE (
  id              uuid,
  date            date,
  start_time      time,
  end_time        time,
  client_name     text,
  birthday_person text,
  theme           text,
  status          text,
  unit_id         uuid,
  unit_slug       text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    e.id,
    e.date,
    e.start_time,
    e.end_time,
    e.client_name,
    e.birthday_person,
    e.theme,
    e.status::text,
    e.unit_id,
    u.slug AS unit_slug
  FROM public.events e
  LEFT JOIN public.units u ON u.id = e.unit_id
  WHERE e.status::text <> 'lost'
    AND e.date >= COALESCE(p_date_from, CURRENT_DATE - INTERVAL '30 days')
    AND e.date <= COALESCE(p_date_to,   CURRENT_DATE + INTERVAL '90 days')
    AND (
      p_search IS NULL
      OR p_search = ''
      OR e.client_name      ILIKE '%' || p_search || '%'
      OR e.birthday_person  ILIKE '%' || p_search || '%'
      OR e.theme            ILIKE '%' || p_search || '%'
    )
  ORDER BY e.date ASC, e.start_time ASC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.search_events_for_os_link(text, date, date) TO authenticated;

-- ── 3. RPC: contar OS para uma festa ─────────────────────────
-- Usada para exibir aviso "essa festa já tem OS" ao vincular.
-- SECURITY INVOKER: conta só OS visíveis ao usuário.
DROP FUNCTION IF EXISTS public.get_os_count_for_event(uuid);

CREATE OR REPLACE FUNCTION public.get_os_count_for_event(
  p_event_id uuid
)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.decoracao_os
  WHERE event_id = p_event_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_os_count_for_event(uuid) TO authenticated;

-- ── 4. Atualiza create_decoracao_os_with_items ────────────────
-- Acrescenta p_event_id UUID DEFAULT NULL. A assinatura mudou
-- (DROP IF EXISTS + CREATE para evitar erro de assinatura).
DROP FUNCTION IF EXISTS public.create_decoracao_os_with_items(uuid, date, time, text, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.create_decoracao_os_with_items(
  p_unit_id    uuid,
  p_data_festa date,
  p_hora_festa time,
  p_tema       text,
  p_tema_id    uuid,
  p_itens      jsonb,
  p_event_id   uuid    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_os_id uuid;
  v_item  jsonb;
BEGIN
  IF p_tema IS NULL OR length(trim(p_tema)) = 0 THEN
    RAISE EXCEPTION 'tema_obrigatorio' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.decoracao_os (unit_id, data_festa, hora_festa, tema, tema_id, event_id, created_by)
  VALUES (p_unit_id, p_data_festa, p_hora_festa, trim(p_tema), p_tema_id, p_event_id, auth.uid())
  RETURNING id INTO v_os_id;

  IF p_itens IS NOT NULL AND jsonb_typeof(p_itens) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      INSERT INTO public.decoracao_os_itens (
        os_id, balao_modelo_id, quantidade, observacoes, status, ordem
      )
      VALUES (
        v_os_id,
        NULLIF(v_item->>'balao_modelo_id', '')::uuid,
        COALESCE((v_item->>'quantidade')::int, 1),
        NULLIF(v_item->>'observacoes', ''),
        COALESCE(v_item->>'status', 'aguardando_prova'),
        COALESCE((v_item->>'ordem')::int, 0)
      );
    END LOOP;
  END IF;

  RETURN v_os_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_decoracao_os_with_items(uuid, date, time, text, uuid, jsonb, uuid) TO authenticated;

-- ── 5. Atualiza update_decoracao_os_with_items ────────────────
DROP FUNCTION IF EXISTS public.update_decoracao_os_with_items(uuid, uuid, date, time, text, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.update_decoracao_os_with_items(
  p_os_id      uuid,
  p_unit_id    uuid,
  p_data_festa date,
  p_hora_festa time,
  p_tema       text,
  p_tema_id    uuid,
  p_itens      jsonb,
  p_event_id   uuid    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item     jsonb;
  v_item_id  uuid;
  v_kept_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_tema IS NULL OR length(trim(p_tema)) = 0 THEN
    RAISE EXCEPTION 'tema_obrigatorio' USING ERRCODE = '22023';
  END IF;

  UPDATE public.decoracao_os
  SET unit_id    = p_unit_id,
      data_festa = p_data_festa,
      hora_festa = p_hora_festa,
      tema       = trim(p_tema),
      tema_id    = p_tema_id,
      event_id   = p_event_id
  WHERE id = p_os_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ordem_nao_encontrada_ou_sem_permissao' USING ERRCODE = '42501';
  END IF;

  IF p_itens IS NOT NULL AND jsonb_typeof(p_itens) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      v_item_id := NULLIF(v_item->>'id', '')::uuid;

      IF v_item_id IS NULL THEN
        INSERT INTO public.decoracao_os_itens (
          os_id, balao_modelo_id, quantidade, observacoes, status, ordem
        )
        VALUES (
          p_os_id,
          NULLIF(v_item->>'balao_modelo_id', '')::uuid,
          COALESCE((v_item->>'quantidade')::int, 1),
          NULLIF(v_item->>'observacoes', ''),
          COALESCE(v_item->>'status', 'aguardando_prova'),
          COALESCE((v_item->>'ordem')::int, 0)
        )
        RETURNING id INTO v_item_id;
      ELSE
        UPDATE public.decoracao_os_itens
        SET balao_modelo_id = NULLIF(v_item->>'balao_modelo_id', '')::uuid,
            quantidade      = COALESCE((v_item->>'quantidade')::int, 1),
            observacoes     = NULLIF(v_item->>'observacoes', ''),
            status          = COALESCE(v_item->>'status', 'aguardando_prova'),
            ordem           = COALESCE((v_item->>'ordem')::int, 0)
        WHERE id = v_item_id AND os_id = p_os_id;
      END IF;

      v_kept_ids := v_kept_ids || v_item_id;
    END LOOP;
  END IF;

  DELETE FROM public.decoracao_os_itens
  WHERE os_id = p_os_id
    AND id <> ALL (v_kept_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_decoracao_os_with_items(uuid, uuid, date, time, text, uuid, jsonb, uuid) TO authenticated;

-- ── 6. Recarregar schema do PostgREST ────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;
