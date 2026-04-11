-- Migration 038: Vincula equipamentos aos chamados de manutenção
-- Adiciona FK opcional equipment_id em maintenance_tickets

ALTER TABLE public.maintenance_tickets
  ADD COLUMN IF NOT EXISTS equipment_id uuid
  REFERENCES public.equipment(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mtickets_equipment_id
  ON public.maintenance_tickets(equipment_id)
  WHERE equipment_id IS NOT NULL;

-- Permitir que authenticated leia equipment via FK
GRANT SELECT ON public.equipment TO authenticated;
GRANT SELECT ON public.equipment_categories TO authenticated;
