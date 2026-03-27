-- =============================================================
-- MIGRATION 012 — Fase 3 Bloco 2: Equipamentos/Ativos
-- =============================================================
-- Criado em: 2026-03-27
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- TABELA equipment
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.equipment (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id        UUID        NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  category       TEXT,
  location       TEXT,
  serial_number  TEXT,
  purchase_date  DATE,
  warranty_until DATE,
  status         TEXT        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active','inactive','in_repair','retired')),
  notes          TEXT,
  photo_url      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER equipment_updated_at
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_equipment_unit_id  ON public.equipment(unit_id);
CREATE INDEX idx_equipment_status   ON public.equipment(status);
CREATE INDEX idx_equipment_category ON public.equipment(category);

-- ─────────────────────────────────────────────────────────────
-- RLS — equipment
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

-- Leitura: acesso à unidade
CREATE POLICY equipment_select ON public.equipment
  FOR SELECT USING (
    is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
  );

-- Escrita: acesso à unidade + auth
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

-- ─────────────────────────────────────────────────────────────
-- STORAGE — bucket equipment-photos (privado, signed URLs)
-- ─────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'equipment-photos',
  'equipment-photos',
  false,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "equipment_photos_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'equipment-photos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "equipment_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'equipment-photos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "equipment_photos_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'equipment-photos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "equipment_photos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'equipment-photos'
    AND auth.role() = 'authenticated'
  );

-- ─────────────────────────────────────────────────────────────
-- ALTERAR maintenance_orders: equipment TEXT → equipment_id UUID FK
-- ─────────────────────────────────────────────────────────────

-- Remove o campo texto livre (dados históricos perdidos — campo era opcional)
ALTER TABLE public.maintenance_orders
  DROP COLUMN IF EXISTS equipment;

-- Adiciona FK para a nova tabela
ALTER TABLE public.maintenance_orders
  ADD COLUMN IF NOT EXISTS equipment_id UUID
    REFERENCES public.equipment(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_equipment_id
  ON public.maintenance_orders(equipment_id);

-- NOTA: role_default_perms tem CHECK constraint no módulo (sem 'equipment').
-- Acesso ao módulo de equipamentos é controlado pela RLS (unit_id).
-- A expansão do CHECK constraint e seed de permissões granulares
-- será feita na Migration 013 (Bloco 3 — Configurações Avançadas).
