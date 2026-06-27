-- ============================================================
-- Migration 177 — Read-only do "Ver como" nas RPCs SECURITY DEFINER alcançáveis
-- ============================================================
-- As migrations 175/176 cobrem escritas via RLS. Funcoes SECURITY DEFINER rodam como o
-- OWNER e FURAM a RLS -> as policies restritivas da 176 nao as alcancam. A maioria das
-- RPCs de escrita secdef ja esta coberta porque (a) chamam check_permission (gated pela
-- 175) ou (b) tem o chamador-pai bloqueado (a mutacao principal e barrada antes). Sobram
-- 2 RPCs standalone de escrita que o frontend chama direto e que NAO passam por nenhuma
-- das duas: set_my_action_item_status (toggle de tarefa de ata) e mark_all_notifications_read.
--
-- Esta migration gateia as duas com `is_impersonating()`. Corpos = VERBATIM do git
-- (mig 157 e 003 respectivamente) + o guard no topo. Idempotente. Sem BEGIN/COMMIT nem
-- NOTIFY pgrst (a esteira cuida). GRANTs preservados pelo CREATE OR REPLACE.
-- ============================================================

-- 1) set_my_action_item_status (mig 157 verbatim + guard).
CREATE OR REPLACE FUNCTION public.set_my_action_item_status(
  p_item_id UUID,
  p_status  TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  -- Modo "Ver como": somente leitura.
  IF public.is_impersonating() THEN
    RAISE EXCEPTION 'Modo "Ver como" e somente leitura.' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('pending', 'in_progress', 'done') THEN
    RAISE EXCEPTION 'invalid_status: %', p_status
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.meeting_action_items
  SET status       = p_status,
      completed_at = CASE WHEN p_status = 'done' THEN now() ELSE NULL END,
      updated_at   = now()
  WHERE id = p_item_id
    AND assigned_to = auth.uid();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- 2) mark_all_notifications_read (mig 003 verbatim, convertida p/ plpgsql para o guard;
--    de quebra ganha SET search_path = public, que faltava na versao SQL original).
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Modo "Ver como": somente leitura.
  IF public.is_impersonating() THEN
    RAISE EXCEPTION 'Modo "Ver como" e somente leitura.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.notifications
  SET is_read = TRUE
  WHERE user_id = p_user_id AND is_read = FALSE;
END;
$$;
