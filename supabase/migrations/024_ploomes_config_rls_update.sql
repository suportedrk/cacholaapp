-- ============================================================
-- Cachola OS — Migration 024: RLS UPDATE/INSERT para ploomes_config
-- ============================================================
-- A migration 015 criou apenas política SELECT para managers.
-- Sem política UPDATE, somente service_role conseguia atualizar.
-- Esta migration adiciona políticas UPDATE e INSERT para managers.
-- ============================================================
-- Execute com:
--   docker exec supabase-db bash -c "psql -U postgres -d postgres -f /docker-entrypoint-migrations/024_ploomes_config_rls_update.sql"
-- ============================================================

-- UPDATE: super_admin/diretor/gerente podem atualizar config de suas unidades
CREATE POLICY "ploomes_config: managers can update"
  ON public.ploomes_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'diretor', 'gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'diretor', 'gerente')
    )
  );

-- INSERT: super_admin/diretor/gerente podem criar config
CREATE POLICY "ploomes_config: managers can insert"
  ON public.ploomes_config FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'diretor', 'gerente')
    )
  );
