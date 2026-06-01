-- supabase/migrations/135_manutencao_bloco_a_remover_items_rollback.sql
-- Rollback da migration 135_manutencao_bloco_a_remover_items.sql

BEGIN;

-- 1. Recriar tabela maintenance_items (schema original da migration 031)
CREATE TABLE IF NOT EXISTS public.maintenance_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     uuid        NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  sector_id   uuid        REFERENCES public.maintenance_sectors(id) ON DELETE SET NULL,
  name        text        NOT NULL,
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mitems_unit_id   ON public.maintenance_items (unit_id);
CREATE INDEX IF NOT EXISTS idx_mitems_sector_id ON public.maintenance_items (sector_id);

-- 2. Reativar RLS
ALTER TABLE public.maintenance_items ENABLE ROW LEVEL SECURITY;

-- 3. Recriar trigger de updated_at
CREATE TRIGGER maintenance_items_updated_at
  BEFORE UPDATE ON public.maintenance_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. Recriar policies RLS com padrão dourado (migration 094)
CREATE POLICY "maintenance_items: view" ON public.maintenance_items
  FOR SELECT USING (
    check_permission(auth.uid(), 'manutencao'::text, 'view'::text)
    AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))
  );

CREATE POLICY "maintenance_items: create" ON public.maintenance_items
  FOR INSERT WITH CHECK (
    check_permission(auth.uid(), 'manutencao'::text, 'create'::text)
    AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))
  );

CREATE POLICY "maintenance_items: edit" ON public.maintenance_items
  FOR UPDATE
  USING (
    check_permission(auth.uid(), 'manutencao'::text, 'edit'::text)
    AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))
  )
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao'::text, 'edit'::text)
    AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))
  );

CREATE POLICY "maintenance_items: delete" ON public.maintenance_items
  FOR DELETE USING (
    check_permission(auth.uid(), 'manutencao'::text, 'delete'::text)
    AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))
  );

-- 5. Readicionar coluna item_id em maintenance_tickets com FK original
ALTER TABLE public.maintenance_tickets
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.maintenance_items(id) ON DELETE SET NULL;

COMMIT;
