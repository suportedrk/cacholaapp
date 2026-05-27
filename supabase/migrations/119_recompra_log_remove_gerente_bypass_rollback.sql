-- ============================================================
-- Migration 119 — ROLLBACK
-- Restaura o bypass de SELECT em recompra_contact_log para
-- incluir gerente (estado pré-decisão de 2026-05-26).
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS recompra_log_select ON public.recompra_contact_log;

CREATE POLICY recompra_log_select
  ON public.recompra_contact_log
  FOR SELECT
  USING (
    contacted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'diretor', 'gerente')
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
