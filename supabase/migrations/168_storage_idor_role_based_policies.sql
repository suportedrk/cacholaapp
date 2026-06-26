-- ============================================================
-- Migration 168 — IDOR de storage: policies role-based
-- ============================================================
-- Contexto (Segurança/LGPD, OWASP A01 — IDOR de arquivo):
--   Os buckets privados `provider-documents`, `equipment-photos` e
--   `checklist-comment-photos` tinham policies que checavam apenas
--   `auth.role() = 'authenticated'` → QUALQUER usuário logado lia/sobrescrevia/
--   deletava arquivo de qualquer unidade (incl. documentos .doc de prestador).
--
-- Decisão de design (ver docs/DIVIDAS_TECNICAS.md — Segurança/LGPD):
--   O acesso de ESCRITA desses 3 módulos é controlado por CARGO na camada de
--   app (PRESTADORES_ACCESS_ROLES / MAINTENANCE_MODULE_ROLES /
--   OPERATIONAL_CHECKLIST_ROLES), NÃO por check_permission. Por isso as policies
--   gateiam por CARGO (subquery em public.users), e não pelo motor de permissões.
--   Os role-sets abaixo espelham src/config/roles.ts — manter em sincronia.
--
-- Sem efeito no app: as 3 telas já leem via signed URL e gravam path; nenhuma
-- mudança de frontend é necessária.
--
-- Idempotente (DROP POLICY IF EXISTS + CREATE OR REPLACE FUNCTION). Sem
-- BEGIN/COMMIT nem NOTIFY pgrst (a esteira migrate-prod cuida da transação e do
-- reload — regra para migrations 160+).
-- ============================================================

-- ── Helper genérico role-based (mesmo molde de is_global_viewer, mig 089) ────
-- SECURITY DEFINER p/ ler public.users sem depender da RLS da própria tabela
-- (evita recursão e garante avaliação consistente dentro das policies).
CREATE OR REPLACE FUNCTION public.auth_user_has_role(p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = ANY(p_roles)
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_user_has_role(text[]) TO authenticated;

COMMENT ON FUNCTION public.auth_user_has_role(text[]) IS
  'Retorna true se o usuario autenticado tem um dos cargos informados. '
  'Usada em policies de storage (mig 168) para gatear acesso a buckets por cargo. '
  'Espelha os role-sets de src/config/roles.ts — manter em sincronia.';

-- ============================================================
-- provider-documents → PRESTADORES_ACCESS_ROLES
-- ============================================================
DROP POLICY IF EXISTS "provider_docs_select" ON storage.objects;
DROP POLICY IF EXISTS "provider_docs_insert" ON storage.objects;
DROP POLICY IF EXISTS "provider_docs_update" ON storage.objects;
DROP POLICY IF EXISTS "provider_docs_delete" ON storage.objects;

CREATE POLICY "provider_docs_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'provider-documents'
    AND public.auth_user_has_role(ARRAY[
      'super_admin','diretor','gerente','financeiro','manutencao','vendedora','pos_vendas','decoracao'
    ])
  );

CREATE POLICY "provider_docs_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'provider-documents'
    AND public.auth_user_has_role(ARRAY[
      'super_admin','diretor','gerente','financeiro','manutencao','vendedora','pos_vendas','decoracao'
    ])
  );

CREATE POLICY "provider_docs_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'provider-documents'
    AND public.auth_user_has_role(ARRAY[
      'super_admin','diretor','gerente','financeiro','manutencao','vendedora','pos_vendas','decoracao'
    ])
  );

CREATE POLICY "provider_docs_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'provider-documents'
    AND public.auth_user_has_role(ARRAY[
      'super_admin','diretor','gerente','financeiro','manutencao','vendedora','pos_vendas','decoracao'
    ])
  );

-- ============================================================
-- equipment-photos → MAINTENANCE_MODULE_ROLES
-- ============================================================
DROP POLICY IF EXISTS "equipment_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "equipment_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "equipment_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "equipment_photos_delete" ON storage.objects;

CREATE POLICY "equipment_photos_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'equipment-photos'
    AND public.auth_user_has_role(ARRAY[
      'super_admin','diretor','gerente','manutencao','operacional','operacional_eventos'
    ])
  );

CREATE POLICY "equipment_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'equipment-photos'
    AND public.auth_user_has_role(ARRAY[
      'super_admin','diretor','gerente','manutencao','operacional','operacional_eventos'
    ])
  );

CREATE POLICY "equipment_photos_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'equipment-photos'
    AND public.auth_user_has_role(ARRAY[
      'super_admin','diretor','gerente','manutencao','operacional','operacional_eventos'
    ])
  );

CREATE POLICY "equipment_photos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'equipment-photos'
    AND public.auth_user_has_role(ARRAY[
      'super_admin','diretor','gerente','manutencao','operacional','operacional_eventos'
    ])
  );

-- ============================================================
-- checklist-comment-photos → OPERATIONAL_CHECKLIST_ROLES
-- ============================================================
DROP POLICY IF EXISTS "checklist_comment_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "checklist_comment_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "checklist_comment_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "checklist_comment_photos_delete" ON storage.objects;

CREATE POLICY "checklist_comment_photos_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'checklist-comment-photos'
    AND public.auth_user_has_role(ARRAY[
      'super_admin','diretor','gerente','decoracao','freelancer','entregador','operacional','operacional_eventos'
    ])
  );

CREATE POLICY "checklist_comment_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'checklist-comment-photos'
    AND public.auth_user_has_role(ARRAY[
      'super_admin','diretor','gerente','decoracao','freelancer','entregador','operacional','operacional_eventos'
    ])
  );

CREATE POLICY "checklist_comment_photos_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'checklist-comment-photos'
    AND public.auth_user_has_role(ARRAY[
      'super_admin','diretor','gerente','decoracao','freelancer','entregador','operacional','operacional_eventos'
    ])
  );

CREATE POLICY "checklist_comment_photos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'checklist-comment-photos'
    AND public.auth_user_has_role(ARRAY[
      'super_admin','diretor','gerente','decoracao','freelancer','entregador','operacional','operacional_eventos'
    ])
  );
