-- ============================================================
-- ROLLBACK da Migration 177 — restaura as 2 RPCs sem o guard de impersonation
-- ============================================================
-- Restaura set_my_action_item_status (mig 157 verbatim) e mark_all_notifications_read
-- (mig 003 verbatim, voltando a LANGUAGE sql). Idempotente. Sem BEGIN/COMMIT nem NOTIFY.
-- ============================================================

-- 1) set_my_action_item_status — mig 157 verbatim (sem guard).
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

-- 2) mark_all_notifications_read — mig 003 verbatim (LANGUAGE sql, sem guard).
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id UUID)
RETURNS VOID AS $$
  UPDATE public.notifications
  SET is_read = TRUE
  WHERE user_id = p_user_id AND is_read = FALSE;
$$ LANGUAGE sql SECURITY DEFINER;
