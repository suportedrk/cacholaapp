-- =============================================================================
-- Migration 074 — Tabela role_template_audit
-- PR 4b v1.5.8 — 27/abr/2026
-- =============================================================================
--
-- Registra histórico de mudanças em role_permissions.
-- O endpoint POST /api/admin/role-permissions escreve explicitamente nesta
-- tabela em transação — NÃO há trigger automático em role_permissions.
--
-- RLS: SELECT restrito a super_admin via jwt claim 'role'.
--      INSERT bloqueado para usuários (apenas service_role via endpoint).
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Tabela principal
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.role_template_audit (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code    TEXT        NOT NULL REFERENCES public.roles(code)   ON DELETE CASCADE,
  module_code  TEXT        NOT NULL REFERENCES public.modules(code) ON DELETE CASCADE,
  action       TEXT        NOT NULL CHECK (action IN ('view','create','edit','delete','export')),
  old_granted  BOOLEAN     NOT NULL,
  new_granted  BOOLEAN     NOT NULL,
  changed_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- Índices
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_role_template_audit_role_changed
  ON public.role_template_audit (role_code, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_role_template_audit_changed_by
  ON public.role_template_audit (changed_by);

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.role_template_audit ENABLE ROW LEVEL SECURITY;

-- SELECT: apenas super_admin
CREATE POLICY "super_admin pode ler audit de templates"
  ON public.role_template_audit
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- INSERT/UPDATE/DELETE: bloqueado para usuários autenticados;
-- endpoint usa service_role que bypassa RLS.

COMMIT;
