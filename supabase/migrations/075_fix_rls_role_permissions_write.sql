-- =============================================================================
-- Migration 075 — Correção de RLS: policies de escrita em role_permissions
--                 e role_template_audit + função is_super_admin()
-- Hotfix v1.5.9 — 27/abr/2026
-- =============================================================================
--
-- CONTEXTO DO PROBLEMA
-- Migration 071 criou role_permissions com RLS ativo mas sem policy de escrita,
-- na premissa de que o endpoint usaria service_role (que bypassa RLS).
-- Migration 074 criou role_template_audit com mesma lacuna + policy SELECT
-- usando auth.jwt() ->> 'role', que é um padrão inconsistente com o restante
-- do projeto.
--
-- Na prática, createAdminClient() (server.ts) usa @supabase/ssr com cookies,
-- o que faz o PostgREST usar o JWT do cookie do usuário (role: authenticated)
-- em vez da service_role key para as queries ao banco. Resultado: upsert em
-- role_permissions falha com 42501 (violação de RLS).
--
-- SOLUÇÃO (AJUSTES APROVADOS)
-- 1. Criar is_super_admin() SECURITY DEFINER — padrão consistente com
--    is_global_viewer() e can_view_meeting() já existentes no projeto.
--    Usa subquery em public.users, não auth.jwt() ->> 'role' (que depende
--    de custom JWT claims e é inconsistente com o padrão do projeto).
-- 2. Adicionar policy ALL em role_permissions usando is_super_admin().
-- 3. Substituir a policy SELECT (auth.jwt()) de role_template_audit por
--    policy ALL usando is_super_admin().
-- 4. NÃO criar policies de escrita em roles/modules — essas tabelas
--    permanecem read-only para usuários (CRUD só via SQL manual).
--
-- Esta migration NÃO altera 071 nem 074 — corrige sem reescrever histórico.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Função is_super_admin()
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin()
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

COMMENT ON FUNCTION public.is_super_admin() IS
  'Retorna true se o usuário autenticado tem role super_admin. '
  'SECURITY DEFINER para resolver RLS circular em public.users. '
  'Padrão consistente com is_global_viewer() e can_view_meeting().';

-- ─────────────────────────────────────────────────────────────
-- Policies em role_permissions
-- ─────────────────────────────────────────────────────────────
-- role_permissions já tem RLS ativo (migration 071) e policy SELECT
-- para authenticated. Adicionamos ALL para super_admin.

DO $$ BEGIN
  CREATE POLICY "super_admin manage role_permissions"
    ON public.role_permissions
    FOR ALL
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());
EXCEPTION WHEN duplicate_object THEN
  NULL; -- idempotente
END $$;

-- ─────────────────────────────────────────────────────────────
-- Policies em role_template_audit
-- ─────────────────────────────────────────────────────────────
-- Substituir policy SELECT com auth.jwt() (074) por policy ALL
-- com is_super_admin() — padrão correto do projeto.

DROP POLICY IF EXISTS "super_admin pode ler audit de templates" ON public.role_template_audit;
DROP POLICY IF EXISTS "super_admin pode inserir audit de templates" ON public.role_template_audit;

DO $$ BEGIN
  CREATE POLICY "super_admin manage role_template_audit"
    ON public.role_template_audit
    FOR ALL
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());
EXCEPTION WHEN duplicate_object THEN
  NULL; -- idempotente
END $$;

COMMIT;
