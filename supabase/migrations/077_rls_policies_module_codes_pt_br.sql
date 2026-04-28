-- Migration 077 — Atualizar 49 policies RLS: codigos EN → PT-BR em check_permission()
--
-- Contexto: migration 073 renomeou user_permissions.module de EN para PT-BR.
-- Migration 076 adicionou CASE EN→PT-BR dentro de check_permission() como
-- camada defensiva temporaria. Esta migration atualiza as 49 policies que
-- ainda chamavam check_permission() com codigos EN, fazendo-as usar PT-BR
-- diretamente.
--
-- Mapeamento aplicado (somente dentro de check_permission()):
--   'events'     → 'eventos'
--   'providers'  → 'prestadores'
--   'settings'   → 'configuracoes'
--   'users'      → 'usuarios'
--   'audit_logs' → 'logs'
--   'minutes'    → 'atas'
--
-- As 15 policies que ja usavam 'checklists' (codigo identico em EN e PT-BR)
-- NAO foram tocadas.
--
-- O CASE em check_permission() (migration 076) e MANTIDO PERMANENTEMENTE
-- como camada defensiva de custo zero: previne regressao caso uma futura
-- policy seja criada esquecendo de usar PT-BR.
--
-- Tabelas afetadas (22): audit_logs, checklist_categories, event_providers,
-- event_staff, events, meeting_minutes, ploomes_unit_mapping,
-- provider_contacts, provider_documents, provider_ratings, provider_services,
-- service_categories, service_providers, system_config, user_permissions,
-- user_units, users.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- GRUPO 1: 'audit_logs' → 'logs'  (1 policy)
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "audit_logs: view" ON public.audit_logs;
CREATE POLICY "audit_logs: view" ON public.audit_logs
  AS PERMISSIVE FOR SELECT TO public
  USING (check_permission(auth_user_id(), 'logs'::text, 'view'::text));

-- ─────────────────────────────────────────────────────────────
-- GRUPO 2: 'settings' → 'configuracoes'  (6 policies)
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "checklist_categories: create" ON public.checklist_categories;
CREATE POLICY "checklist_categories: create" ON public.checklist_categories
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((check_permission(auth.uid(), 'configuracoes'::text, 'edit'::text) AND (unit_id = ANY (get_user_unit_ids()))));

DROP POLICY IF EXISTS "checklist_categories: delete" ON public.checklist_categories;
CREATE POLICY "checklist_categories: delete" ON public.checklist_categories
  AS PERMISSIVE FOR DELETE TO public
  USING ((check_permission(auth.uid(), 'configuracoes'::text, 'delete'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "checklist_categories: update" ON public.checklist_categories;
CREATE POLICY "checklist_categories: update" ON public.checklist_categories
  AS PERMISSIVE FOR UPDATE TO public
  USING ((check_permission(auth.uid(), 'configuracoes'::text, 'edit'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "ploomes_unit_mapping_manage" ON public.ploomes_unit_mapping;
CREATE POLICY "ploomes_unit_mapping_manage" ON public.ploomes_unit_mapping
  AS PERMISSIVE FOR ALL TO public
  USING (check_permission(auth.uid(), 'configuracoes'::text, 'edit'::text));

DROP POLICY IF EXISTS "ploomes_unit_mapping_select" ON public.ploomes_unit_mapping;
CREATE POLICY "ploomes_unit_mapping_select" ON public.ploomes_unit_mapping
  AS PERMISSIVE FOR SELECT TO public
  USING (check_permission(auth.uid(), 'configuracoes'::text, 'view'::text));

DROP POLICY IF EXISTS "system_config: admin manage" ON public.system_config;
CREATE POLICY "system_config: admin manage" ON public.system_config
  AS PERMISSIVE FOR ALL TO public
  USING (check_permission(auth_user_id(), 'configuracoes'::text, 'edit'::text));

-- ─────────────────────────────────────────────────────────────
-- GRUPO 3: 'providers' → 'prestadores'  (28 policies)
-- ─────────────────────────────────────────────────────────────

-- event_providers (4)
DROP POLICY IF EXISTS "event_providers_delete" ON public.event_providers;
CREATE POLICY "event_providers_delete" ON public.event_providers
  AS PERMISSIVE FOR DELETE TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'delete'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "event_providers_insert" ON public.event_providers;
CREATE POLICY "event_providers_insert" ON public.event_providers
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((check_permission(auth.uid(), 'prestadores'::text, 'create'::text) AND (unit_id = ANY (get_user_unit_ids()))));

DROP POLICY IF EXISTS "event_providers_select" ON public.event_providers;
CREATE POLICY "event_providers_select" ON public.event_providers
  AS PERMISSIVE FOR SELECT TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'view'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "event_providers_update" ON public.event_providers;
CREATE POLICY "event_providers_update" ON public.event_providers
  AS PERMISSIVE FOR UPDATE TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'edit'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

-- provider_contacts (4)
DROP POLICY IF EXISTS "provider_contacts_delete" ON public.provider_contacts;
CREATE POLICY "provider_contacts_delete" ON public.provider_contacts
  AS PERMISSIVE FOR DELETE TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'delete'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "provider_contacts_insert" ON public.provider_contacts;
CREATE POLICY "provider_contacts_insert" ON public.provider_contacts
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((check_permission(auth.uid(), 'prestadores'::text, 'create'::text) AND (unit_id = ANY (get_user_unit_ids()))));

DROP POLICY IF EXISTS "provider_contacts_select" ON public.provider_contacts;
CREATE POLICY "provider_contacts_select" ON public.provider_contacts
  AS PERMISSIVE FOR SELECT TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'view'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "provider_contacts_update" ON public.provider_contacts;
CREATE POLICY "provider_contacts_update" ON public.provider_contacts
  AS PERMISSIVE FOR UPDATE TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'edit'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

-- provider_documents (4)
DROP POLICY IF EXISTS "provider_documents_delete" ON public.provider_documents;
CREATE POLICY "provider_documents_delete" ON public.provider_documents
  AS PERMISSIVE FOR DELETE TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'delete'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "provider_documents_insert" ON public.provider_documents;
CREATE POLICY "provider_documents_insert" ON public.provider_documents
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((check_permission(auth.uid(), 'prestadores'::text, 'create'::text) AND (unit_id = ANY (get_user_unit_ids()))));

DROP POLICY IF EXISTS "provider_documents_select" ON public.provider_documents;
CREATE POLICY "provider_documents_select" ON public.provider_documents
  AS PERMISSIVE FOR SELECT TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'view'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "provider_documents_update" ON public.provider_documents;
CREATE POLICY "provider_documents_update" ON public.provider_documents
  AS PERMISSIVE FOR UPDATE TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'edit'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

-- provider_ratings (4)
DROP POLICY IF EXISTS "provider_ratings_delete" ON public.provider_ratings;
CREATE POLICY "provider_ratings_delete" ON public.provider_ratings
  AS PERMISSIVE FOR DELETE TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'delete'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "provider_ratings_insert" ON public.provider_ratings;
CREATE POLICY "provider_ratings_insert" ON public.provider_ratings
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((check_permission(auth.uid(), 'prestadores'::text, 'create'::text) AND (unit_id = ANY (get_user_unit_ids()))));

DROP POLICY IF EXISTS "provider_ratings_select" ON public.provider_ratings;
CREATE POLICY "provider_ratings_select" ON public.provider_ratings
  AS PERMISSIVE FOR SELECT TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'view'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "provider_ratings_update" ON public.provider_ratings;
CREATE POLICY "provider_ratings_update" ON public.provider_ratings
  AS PERMISSIVE FOR UPDATE TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'edit'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

-- provider_services (4)
DROP POLICY IF EXISTS "provider_services_delete" ON public.provider_services;
CREATE POLICY "provider_services_delete" ON public.provider_services
  AS PERMISSIVE FOR DELETE TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'delete'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "provider_services_insert" ON public.provider_services;
CREATE POLICY "provider_services_insert" ON public.provider_services
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((check_permission(auth.uid(), 'prestadores'::text, 'create'::text) AND (unit_id = ANY (get_user_unit_ids()))));

DROP POLICY IF EXISTS "provider_services_select" ON public.provider_services;
CREATE POLICY "provider_services_select" ON public.provider_services
  AS PERMISSIVE FOR SELECT TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'view'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "provider_services_update" ON public.provider_services;
CREATE POLICY "provider_services_update" ON public.provider_services
  AS PERMISSIVE FOR UPDATE TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'edit'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

-- service_categories (4)
DROP POLICY IF EXISTS "service_categories_delete" ON public.service_categories;
CREATE POLICY "service_categories_delete" ON public.service_categories
  AS PERMISSIVE FOR DELETE TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'delete'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "service_categories_insert" ON public.service_categories;
CREATE POLICY "service_categories_insert" ON public.service_categories
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((check_permission(auth.uid(), 'prestadores'::text, 'create'::text) AND (unit_id = ANY (get_user_unit_ids()))));

DROP POLICY IF EXISTS "service_categories_select" ON public.service_categories;
CREATE POLICY "service_categories_select" ON public.service_categories
  AS PERMISSIVE FOR SELECT TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'view'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "service_categories_update" ON public.service_categories;
CREATE POLICY "service_categories_update" ON public.service_categories
  AS PERMISSIVE FOR UPDATE TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'edit'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

-- service_providers (4)
DROP POLICY IF EXISTS "service_providers_delete" ON public.service_providers;
CREATE POLICY "service_providers_delete" ON public.service_providers
  AS PERMISSIVE FOR DELETE TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'delete'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "service_providers_insert" ON public.service_providers;
CREATE POLICY "service_providers_insert" ON public.service_providers
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((check_permission(auth.uid(), 'prestadores'::text, 'create'::text) AND (unit_id = ANY (get_user_unit_ids()))));

DROP POLICY IF EXISTS "service_providers_select" ON public.service_providers;
CREATE POLICY "service_providers_select" ON public.service_providers
  AS PERMISSIVE FOR SELECT TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'view'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "service_providers_update" ON public.service_providers;
CREATE POLICY "service_providers_update" ON public.service_providers
  AS PERMISSIVE FOR UPDATE TO public
  USING ((check_permission(auth.uid(), 'prestadores'::text, 'edit'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

-- ─────────────────────────────────────────────────────────────
-- GRUPO 4: 'events' → 'eventos'  (6 policies)
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "event_staff: manage" ON public.event_staff;
CREATE POLICY "event_staff: manage" ON public.event_staff
  AS PERMISSIVE FOR ALL TO public
  USING (check_permission(auth.uid(), 'eventos'::text, 'edit'::text));

DROP POLICY IF EXISTS "event_staff: view" ON public.event_staff;
CREATE POLICY "event_staff: view" ON public.event_staff
  AS PERMISSIVE FOR SELECT TO public
  USING ((check_permission(auth.uid(), 'eventos'::text, 'view'::text) OR (user_id = auth.uid())));

DROP POLICY IF EXISTS "events: create" ON public.events;
CREATE POLICY "events: create" ON public.events
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((check_permission(auth.uid(), 'eventos'::text, 'create'::text) AND (unit_id = ANY (get_user_unit_ids()))));

DROP POLICY IF EXISTS "events: delete" ON public.events;
CREATE POLICY "events: delete" ON public.events
  AS PERMISSIVE FOR DELETE TO public
  USING ((check_permission(auth.uid(), 'eventos'::text, 'delete'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "events: update" ON public.events;
CREATE POLICY "events: update" ON public.events
  AS PERMISSIVE FOR UPDATE TO public
  USING ((check_permission(auth.uid(), 'eventos'::text, 'edit'::text) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

DROP POLICY IF EXISTS "events: view" ON public.events;
CREATE POLICY "events: view" ON public.events
  AS PERMISSIVE FOR SELECT TO public
  USING (((check_permission(auth.uid(), 'eventos'::text, 'view'::text) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
     FROM event_staff
    WHERE ((event_staff.event_id = events.id) AND (event_staff.user_id = auth.uid()))))) AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))));

-- ─────────────────────────────────────────────────────────────
-- GRUPO 5: 'minutes' → 'atas'  (1 policy)
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "meeting_minutes_insert" ON public.meeting_minutes;
CREATE POLICY "meeting_minutes_insert" ON public.meeting_minutes
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((check_permission(auth.uid(), 'atas'::text, 'create'::text) AND (unit_id = ANY (get_user_unit_ids())) AND (created_by = auth.uid())));

-- ─────────────────────────────────────────────────────────────
-- GRUPO 6: 'users' → 'usuarios'  (7 policies)
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "user_permissions: admin manage" ON public.user_permissions;
CREATE POLICY "user_permissions: admin manage" ON public.user_permissions
  AS PERMISSIVE FOR ALL TO public
  USING (check_permission(auth_user_id(), 'usuarios'::text, 'edit'::text));

DROP POLICY IF EXISTS "user_units: admin manage" ON public.user_units;
CREATE POLICY "user_units: admin manage" ON public.user_units
  AS PERMISSIVE FOR ALL TO public
  USING (check_permission(auth.uid(), 'usuarios'::text, 'edit'::text));

DROP POLICY IF EXISTS "user_units: admin view" ON public.user_units;
CREATE POLICY "user_units: admin view" ON public.user_units
  AS PERMISSIVE FOR SELECT TO public
  USING (check_permission(auth.uid(), 'usuarios'::text, 'view'::text));

DROP POLICY IF EXISTS "users: admin create" ON public.users;
CREATE POLICY "users: admin create" ON public.users
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (check_permission(auth_user_id(), 'usuarios'::text, 'create'::text));

DROP POLICY IF EXISTS "users: admin delete" ON public.users;
CREATE POLICY "users: admin delete" ON public.users
  AS PERMISSIVE FOR DELETE TO public
  USING (check_permission(auth_user_id(), 'usuarios'::text, 'delete'::text));

DROP POLICY IF EXISTS "users: admin update" ON public.users;
CREATE POLICY "users: admin update" ON public.users
  AS PERMISSIVE FOR UPDATE TO public
  USING (check_permission(auth_user_id(), 'usuarios'::text, 'edit'::text));

DROP POLICY IF EXISTS "users: admin view all" ON public.users;
CREATE POLICY "users: admin view all" ON public.users
  AS PERMISSIVE FOR SELECT TO public
  USING (check_permission(auth_user_id(), 'usuarios'::text, 'view'::text));

-- ─────────────────────────────────────────────────────────────
-- VERIFICACAO: zero policies com codigos EN restantes
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      qual ~ 'check_permission.*''(events|providers|settings|users|audit_logs|minutes)'''
      OR with_check ~ 'check_permission.*''(events|providers|settings|users|audit_logs|minutes)'''
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Migration 077 incompleta: ainda existem % policies com codigos EN', v_count;
  END IF;

  RAISE NOTICE 'Migration 077 OK: 0 policies com codigos EN';
END $$;

-- NOTA: o CASE EN→PT-BR em check_permission() (migration 076) e MANTIDO
-- permanentemente como camada defensiva de custo zero. Previne regressao
-- caso uma futura policy seja criada esquecendo de usar codigo PT-BR.

COMMIT;
