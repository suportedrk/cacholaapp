-- ============================================================
-- Cachola OS — Migration 014: Integração Ploomes CRM
-- ============================================================
-- 1. Adiciona UNIQUE constraint em events.ploomes_deal_id
-- 2. Adiciona coluna ploomes_url em events (link direto ao deal)
-- 3. Cria tabela ploomes_sync_log (histórico de sincronizações)
-- 4. RLS em ploomes_sync_log
-- ============================================================
-- Execute com:
--   docker exec cacholaos-db bash -c "psql -U postgres -d postgres -f /docker-entrypoint-migrations/014_ploomes_integration.sql"
-- ============================================================

-- ============================================================
-- 1. events: UNIQUE constraint em ploomes_deal_id
-- ============================================================
-- A coluna já existe como TEXT nullable (migration 001).
-- PostgreSQL permite múltiplos NULLs em colunas UNIQUE — seguro para
-- eventos manuais (sem deal_id). O UNIQUE garante upsert limpo via ON CONFLICT.
ALTER TABLE public.events
  ADD CONSTRAINT events_ploomes_deal_id_unique UNIQUE (ploomes_deal_id);

-- ============================================================
-- 2. events: coluna ploomes_url
-- ============================================================
-- URL direta para o Deal no Ploomes CRM.
-- Formato: https://app.ploomes.com/negocios/{deal_id}
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ploomes_url TEXT;

-- ============================================================
-- 3. TABELA: ploomes_sync_log
-- ============================================================
-- Registra cada execução de sincronização (manual ou cron).
CREATE TABLE IF NOT EXISTS public.ploomes_sync_log (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  status          TEXT        NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'success', 'error')),
  deals_found     INTEGER     NOT NULL DEFAULT 0,
  deals_created   INTEGER     NOT NULL DEFAULT 0,
  deals_updated   INTEGER     NOT NULL DEFAULT 0,
  deals_errors    INTEGER     NOT NULL DEFAULT 0,
  venues_created  INTEGER     NOT NULL DEFAULT 0,  -- venues criados automaticamente
  types_created   INTEGER     NOT NULL DEFAULT 0,  -- event_types criados automaticamente
  error_message   TEXT,
  triggered_by    TEXT        NOT NULL DEFAULT 'cron'
                    CHECK (triggered_by IN ('cron', 'manual', 'webhook')),
  triggered_by_user_id UUID  REFERENCES public.users(id) ON DELETE SET NULL,
  unit_id         UUID        REFERENCES public.units(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ploomes_sync_log_started_at  ON public.ploomes_sync_log(started_at DESC);
CREATE INDEX idx_ploomes_sync_log_status       ON public.ploomes_sync_log(status);
CREATE INDEX idx_ploomes_sync_log_unit_id      ON public.ploomes_sync_log(unit_id);

-- ============================================================
-- 4. RLS em ploomes_sync_log
-- ============================================================
ALTER TABLE public.ploomes_sync_log ENABLE ROW LEVEL SECURITY;

-- Apenas super_admin, diretor e gerente podem ver os logs
CREATE POLICY "ploomes_sync_log: managers can view"
  ON public.ploomes_sync_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'diretor', 'gerente')
    )
  );

-- Apenas SERVICE ROLE pode inserir/atualizar (via sync server-side)
-- Nenhuma policy de INSERT/UPDATE/DELETE = apenas service_role bypassa RLS
