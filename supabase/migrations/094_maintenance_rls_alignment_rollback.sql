-- ============================================================
-- ROLLBACK da Migration 094 — Alinhamento de RLS de Manutencao
-- ============================================================
-- Reverte 094_maintenance_rls_alignment.sql: remove as 28 policies
-- role-gated criadas pela 094 e recria as 16 policies ORIGINAIS da
-- migration 031 (unit-based, sem check_permission), restaurando o
-- estado de RLS exatamente como estava antes da 094.
--
-- O QUE NAO E REVERTIDO -- e por que e seguro:
--   O backfill de user_permissions da 094 NAO e desfeito. A 094 usou
--   INSERT ... ON CONFLICT DO NOTHING -- nao removeu nem alterou
--   nenhuma linha existente, apenas inseriu linhas de template para
--   diretor/gerente/manutencao. Manter essas linhas e inocuo: sem as
--   policies da 094 chamando check_permission(), elas simplesmente
--   nao sao consultadas. Apagar linhas de permissao num rollback
--   seria mais arriscado do que deixa-las.
--
-- USO: aplicar manualmente via psql se a 094 precisar ser revertida.
--   docker exec -i supabase-db psql -U postgres -d postgres \
--     < supabase/migrations/094_maintenance_rls_alignment_rollback.sql
-- Idempotente: todos os DROP usam IF EXISTS.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. DROP das policies criadas pela 094 (28 + tickets:delete de
--    versoes intermediarias, todas IF EXISTS para idempotencia)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "maintenance_sectors: view"          ON public.maintenance_sectors;
DROP POLICY IF EXISTS "maintenance_sectors: create"        ON public.maintenance_sectors;
DROP POLICY IF EXISTS "maintenance_sectors: edit"          ON public.maintenance_sectors;
DROP POLICY IF EXISTS "maintenance_sectors: delete"        ON public.maintenance_sectors;
DROP POLICY IF EXISTS "maintenance_categories: view"       ON public.maintenance_categories;
DROP POLICY IF EXISTS "maintenance_categories: create"     ON public.maintenance_categories;
DROP POLICY IF EXISTS "maintenance_categories: edit"       ON public.maintenance_categories;
DROP POLICY IF EXISTS "maintenance_categories: delete"     ON public.maintenance_categories;
DROP POLICY IF EXISTS "maintenance_items: view"            ON public.maintenance_items;
DROP POLICY IF EXISTS "maintenance_items: create"          ON public.maintenance_items;
DROP POLICY IF EXISTS "maintenance_items: edit"            ON public.maintenance_items;
DROP POLICY IF EXISTS "maintenance_items: delete"          ON public.maintenance_items;
DROP POLICY IF EXISTS "maintenance_sla: view"              ON public.maintenance_sla;
DROP POLICY IF EXISTS "maintenance_sla: create"            ON public.maintenance_sla;
DROP POLICY IF EXISTS "maintenance_sla: edit"              ON public.maintenance_sla;
DROP POLICY IF EXISTS "maintenance_sla: delete"            ON public.maintenance_sla;
DROP POLICY IF EXISTS "maintenance_tickets: view"          ON public.maintenance_tickets;
DROP POLICY IF EXISTS "maintenance_tickets: create"        ON public.maintenance_tickets;
DROP POLICY IF EXISTS "maintenance_tickets: edit"          ON public.maintenance_tickets;
DROP POLICY IF EXISTS "maintenance_tickets: delete"        ON public.maintenance_tickets;
DROP POLICY IF EXISTS "maintenance_executions: view"       ON public.maintenance_executions;
DROP POLICY IF EXISTS "maintenance_executions: create"     ON public.maintenance_executions;
DROP POLICY IF EXISTS "maintenance_executions: edit"       ON public.maintenance_executions;
DROP POLICY IF EXISTS "maintenance_executions: delete"     ON public.maintenance_executions;
DROP POLICY IF EXISTS "maintenance_ticket_photos: view"    ON public.maintenance_ticket_photos;
DROP POLICY IF EXISTS "maintenance_ticket_photos: create"  ON public.maintenance_ticket_photos;
DROP POLICY IF EXISTS "maintenance_ticket_photos: edit"    ON public.maintenance_ticket_photos;
DROP POLICY IF EXISTS "maintenance_ticket_photos: delete"  ON public.maintenance_ticket_photos;
DROP POLICY IF EXISTS "maintenance_status_history: view"   ON public.maintenance_status_history;

-- ------------------------------------------------------------
-- 2. DROP das policies originais da 031 (IF EXISTS) antes do
--    re-CREATE -- torna o rollback re-executavel sem erro
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "unit_read_sectors"      ON public.maintenance_sectors;
DROP POLICY IF EXISTS "unit_manage_sectors"    ON public.maintenance_sectors;
DROP POLICY IF EXISTS "unit_read_categories"   ON public.maintenance_categories;
DROP POLICY IF EXISTS "unit_manage_categories" ON public.maintenance_categories;
DROP POLICY IF EXISTS "unit_read_items"        ON public.maintenance_items;
DROP POLICY IF EXISTS "unit_manage_items"      ON public.maintenance_items;
DROP POLICY IF EXISTS "unit_read_sla"          ON public.maintenance_sla;
DROP POLICY IF EXISTS "unit_manage_sla"        ON public.maintenance_sla;
DROP POLICY IF EXISTS "unit_read_tickets"      ON public.maintenance_tickets;
DROP POLICY IF EXISTS "unit_insert_tickets"    ON public.maintenance_tickets;
DROP POLICY IF EXISTS "unit_update_tickets"    ON public.maintenance_tickets;
DROP POLICY IF EXISTS "unit_read_executions"   ON public.maintenance_executions;
DROP POLICY IF EXISTS "unit_manage_executions" ON public.maintenance_executions;
DROP POLICY IF EXISTS "unit_read_photos"       ON public.maintenance_ticket_photos;
DROP POLICY IF EXISTS "unit_manage_photos"     ON public.maintenance_ticket_photos;
DROP POLICY IF EXISTS "unit_read_history"      ON public.maintenance_status_history;

-- ------------------------------------------------------------
-- 3. RE-CREATE das 16 policies originais da migration 031
--    (definicoes copiadas verbatim de 031_maintenance_module_tables.sql)
-- ------------------------------------------------------------
CREATE POLICY "unit_read_sectors" ON public.maintenance_sectors
  FOR SELECT TO authenticated USING (unit_id = ANY(get_user_unit_ids()));
CREATE POLICY "unit_manage_sectors" ON public.maintenance_sectors
  FOR ALL TO authenticated USING (unit_id = ANY(get_user_unit_ids()));

CREATE POLICY "unit_read_categories" ON public.maintenance_categories
  FOR SELECT TO authenticated USING (unit_id = ANY(get_user_unit_ids()));
CREATE POLICY "unit_manage_categories" ON public.maintenance_categories
  FOR ALL TO authenticated USING (unit_id = ANY(get_user_unit_ids()));

CREATE POLICY "unit_read_items" ON public.maintenance_items
  FOR SELECT TO authenticated USING (unit_id = ANY(get_user_unit_ids()));
CREATE POLICY "unit_manage_items" ON public.maintenance_items
  FOR ALL TO authenticated USING (unit_id = ANY(get_user_unit_ids()));

CREATE POLICY "unit_read_sla" ON public.maintenance_sla
  FOR SELECT TO authenticated USING (unit_id = ANY(get_user_unit_ids()));
CREATE POLICY "unit_manage_sla" ON public.maintenance_sla
  FOR ALL TO authenticated USING (unit_id = ANY(get_user_unit_ids()));

CREATE POLICY "unit_read_tickets" ON public.maintenance_tickets
  FOR SELECT TO authenticated USING (unit_id = ANY(get_user_unit_ids()));
CREATE POLICY "unit_insert_tickets" ON public.maintenance_tickets
  FOR INSERT TO authenticated WITH CHECK (unit_id = ANY(get_user_unit_ids()));
CREATE POLICY "unit_update_tickets" ON public.maintenance_tickets
  FOR UPDATE TO authenticated USING (unit_id = ANY(get_user_unit_ids()));

CREATE POLICY "unit_read_executions" ON public.maintenance_executions
  FOR SELECT TO authenticated
  USING (ticket_id IN (
    SELECT id FROM public.maintenance_tickets WHERE unit_id = ANY(get_user_unit_ids())
  ));
CREATE POLICY "unit_manage_executions" ON public.maintenance_executions
  FOR ALL TO authenticated
  USING (ticket_id IN (
    SELECT id FROM public.maintenance_tickets WHERE unit_id = ANY(get_user_unit_ids())
  ));

CREATE POLICY "unit_read_photos" ON public.maintenance_ticket_photos
  FOR SELECT TO authenticated
  USING (ticket_id IN (
    SELECT id FROM public.maintenance_tickets WHERE unit_id = ANY(get_user_unit_ids())
  ));
CREATE POLICY "unit_manage_photos" ON public.maintenance_ticket_photos
  FOR ALL TO authenticated
  USING (ticket_id IN (
    SELECT id FROM public.maintenance_tickets WHERE unit_id = ANY(get_user_unit_ids())
  ));

CREATE POLICY "unit_read_history" ON public.maintenance_status_history
  FOR SELECT TO authenticated
  USING (ticket_id IN (
    SELECT id FROM public.maintenance_tickets WHERE unit_id = ANY(get_user_unit_ids())
  ));

COMMIT;
