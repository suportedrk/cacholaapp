-- ============================================================
-- Rollback 101 — Remove vínculo OS ↔ Festa
-- ============================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_os_count_for_event(uuid);
DROP FUNCTION IF EXISTS public.search_events_for_os_link(text, date, date);
DROP FUNCTION IF EXISTS public.update_decoracao_os_with_items(uuid, uuid, date, time, text, uuid, jsonb, uuid);
DROP FUNCTION IF EXISTS public.create_decoracao_os_with_items(uuid, date, time, text, uuid, jsonb, uuid);

-- Recriar RPCs originais (sem p_event_id)
CREATE OR REPLACE FUNCTION public.create_decoracao_os_with_items(
  p_unit_id    uuid,
  p_data_festa date,
  p_hora_festa time,
  p_tema       text,
  p_tema_id    uuid,
  p_itens      jsonb
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
  INSERT INTO public.decoracao_os (unit_id, data_festa, hora_festa, tema, tema_id, created_by)
  VALUES (p_unit_id, p_data_festa, p_hora_festa, trim(p_tema), p_tema_id, auth.uid())
  RETURNING id INTO v_os_id;
  IF p_itens IS NOT NULL AND jsonb_typeof(p_itens) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      INSERT INTO public.decoracao_os_itens (os_id, balao_modelo_id, quantidade, observacoes, status, ordem)
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

CREATE OR REPLACE FUNCTION public.update_decoracao_os_with_items(
  p_os_id      uuid,
  p_unit_id    uuid,
  p_data_festa date,
  p_hora_festa time,
  p_tema       text,
  p_tema_id    uuid,
  p_itens      jsonb
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
      tema_id    = p_tema_id
  WHERE id = p_os_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ordem_nao_encontrada_ou_sem_permissao' USING ERRCODE = '42501';
  END IF;
  IF p_itens IS NOT NULL AND jsonb_typeof(p_itens) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      v_item_id := NULLIF(v_item->>'id', '')::uuid;
      IF v_item_id IS NULL THEN
        INSERT INTO public.decoracao_os_itens (os_id, balao_modelo_id, quantidade, observacoes, status, ordem)
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
  DELETE FROM public.decoracao_os_itens WHERE os_id = p_os_id AND id <> ALL (v_kept_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_decoracao_os_with_items(uuid, date, time, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_decoracao_os_with_items(uuid, uuid, date, time, text, uuid, jsonb) TO authenticated;

DROP INDEX IF EXISTS public.idx_decoracao_os_event;

ALTER TABLE public.decoracao_os DROP COLUMN IF EXISTS event_id;

NOTIFY pgrst, 'reload schema';

COMMIT;
