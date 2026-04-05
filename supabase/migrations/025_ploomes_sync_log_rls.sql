-- ============================================================
-- Cachola OS — Migration 025: RLS INSERT/UPDATE para ploomes_sync_log
-- ============================================================
-- A migration 014 criou apenas política SELECT para managers.
-- Sem políticas INSERT/UPDATE, o sistema não conseguia registrar
-- logs de sincronização nem atualizar o status de syncs em andamento.
--
-- Estas policies foram aplicadas manualmente na VPS durante debugging
-- da integração Ploomes. Esta migration as captura formalmente.
-- ============================================================
-- Execute com:
--   docker exec supabase-db bash -c "psql -U postgres -d postgres -f /docker-entrypoint-migrations/025_ploomes_sync_log_rls.sql"
-- ============================================================

-- INSERT: qualquer usuário autenticado pode criar registros de log de sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ploomes_sync_log'
      AND cmd = 'INSERT'
  ) THEN
    CREATE POLICY "synclog_insert"
      ON public.ploomes_sync_log
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- UPDATE: qualquer usuário autenticado pode atualizar logs (ex: marcar sync como concluído)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ploomes_sync_log'
      AND cmd = 'UPDATE'
  ) THEN
    CREATE POLICY "synclog_update"
      ON public.ploomes_sync_log
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
