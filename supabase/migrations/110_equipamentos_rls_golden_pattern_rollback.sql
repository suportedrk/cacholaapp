-- ============================================================
-- Rollback da Migration 110 — Equipamentos RLS golden pattern
--
-- Restaura as policies originais (unit-only) de public.equipment
-- (vindas da migration 012) e public.equipment_categories
-- (vindas da migration 013).
--
-- Idempotente.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- DROP policies novas (golden pattern)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "equipment: view"   ON public.equipment;
DROP POLICY IF EXISTS "equipment: create" ON public.equipment;
DROP POLICY IF EXISTS "equipment: edit"   ON public.equipment;
DROP POLICY IF EXISTS "equipment: delete" ON public.equipment;
DROP POLICY IF EXISTS "equipment_categories: view"   ON public.equipment_categories;
DROP POLICY IF EXISTS "equipment_categories: create" ON public.equipment_categories;
DROP POLICY IF EXISTS "equipment_categories: edit"   ON public.equipment_categories;
DROP POLICY IF EXISTS "equipment_categories: delete" ON public.equipment_categories;

-- ------------------------------------------------------------
-- RESTORE policies originais (idempotente)
-- ------------------------------------------------------------

-- public.equipment (originais da 012)
CREATE POLICY equipment_select ON public.equipment
  FOR SELECT USING (
    is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY equipment_insert ON public.equipment
  FOR INSERT WITH CHECK (
    unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY equipment_update ON public.equipment
  FOR UPDATE USING (
    unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY equipment_delete ON public.equipment
  FOR DELETE USING (
    is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
  );

-- public.equipment_categories (originais da 013)
CREATE POLICY "equip_cat_select" ON public.equipment_categories
  FOR SELECT USING (
    is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "equip_cat_insert" ON public.equipment_categories
  FOR INSERT WITH CHECK (
    unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "equip_cat_update" ON public.equipment_categories
  FOR UPDATE USING (
    unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "equip_cat_delete" ON public.equipment_categories
  FOR DELETE USING (
    unit_id = ANY(get_user_unit_ids())
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
