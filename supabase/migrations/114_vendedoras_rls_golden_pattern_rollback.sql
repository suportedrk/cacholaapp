-- ============================================================
-- Rollback da Migration 114 — Vendedoras RLS golden pattern
--
-- Restaura as policies originais (053) de INSERT/UPDATE/DELETE em
-- public.sellers. SELECT não foi tocado pela 114, então não precisa
-- restauração.
--
-- Idempotente.
-- ============================================================

BEGIN;

-- DROP policies novas
DROP POLICY IF EXISTS "vendedoras: create" ON public.sellers;
DROP POLICY IF EXISTS "vendedoras: edit"   ON public.sellers;
DROP POLICY IF EXISTS "vendedoras: delete" ON public.sellers;

-- RESTORE policies originais da 053 (idempotente)
DROP POLICY IF EXISTS "sellers_insert_admin_diretor" ON public.sellers;
DROP POLICY IF EXISTS "sellers_update_admin_diretor" ON public.sellers;
DROP POLICY IF EXISTS "sellers_delete_super_admin"   ON public.sellers;

CREATE POLICY "sellers_insert_admin_diretor" ON public.sellers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'diretor')
    )
  );

CREATE POLICY "sellers_update_admin_diretor" ON public.sellers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'diretor')
    )
  );

CREATE POLICY "sellers_delete_super_admin" ON public.sellers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'super_admin'
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
