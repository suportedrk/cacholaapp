-- ============================================================
-- 013_fase3_settings.sql
-- Unit Settings (JSONB) + Equipment Categories table
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- UNIT SETTINGS
-- Armazena configurações por unidade em JSONB flexível:
-- timezone, date_format, business_hours, event_defaults
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS unit_settings (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id    uuid        NOT NULL UNIQUE REFERENCES units(id) ON DELETE CASCADE,
  settings   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION set_unit_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unit_settings_updated_at ON unit_settings;
CREATE TRIGGER trg_unit_settings_updated_at
  BEFORE UPDATE ON unit_settings
  FOR EACH ROW EXECUTE FUNCTION set_unit_settings_updated_at();

-- RLS
ALTER TABLE unit_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unit_settings_select" ON unit_settings
  FOR SELECT USING (
    is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "unit_settings_insert" ON unit_settings
  FOR INSERT WITH CHECK (
    unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "unit_settings_update" ON unit_settings
  FOR UPDATE USING (
    unit_id = ANY(get_user_unit_ids())
  );

-- ─────────────────────────────────────────────────────────────
-- EQUIPMENT CATEGORIES
-- Categorias gerenciáveis por unidade — alimentam o select de
-- equipamentos em vez de uma lista hardcoded no frontend
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_categories (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id    uuid        NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  is_active  boolean     NOT NULL DEFAULT true,
  sort_order int         NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(name, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_equip_cat_unit ON equipment_categories(unit_id, sort_order);

-- RLS
ALTER TABLE equipment_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equip_cat_select" ON equipment_categories
  FOR SELECT USING (
    is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "equip_cat_insert" ON equipment_categories
  FOR INSERT WITH CHECK (
    unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "equip_cat_update" ON equipment_categories
  FOR UPDATE USING (
    unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "equip_cat_delete" ON equipment_categories
  FOR DELETE USING (
    unit_id = ANY(get_user_unit_ids())
  );

-- ─────────────────────────────────────────────────────────────
-- SEED: categorias padrão para unidade Pinheiros
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_unit_id uuid;
BEGIN
  SELECT id INTO v_unit_id FROM units WHERE slug = 'pinheiros' LIMIT 1;
  IF v_unit_id IS NOT NULL THEN
    INSERT INTO equipment_categories (unit_id, name, sort_order) VALUES
      (v_unit_id, 'Brinquedo',    0),
      (v_unit_id, 'Mobília',      1),
      (v_unit_id, 'Cozinha',      2),
      (v_unit_id, 'Elétrica',     3),
      (v_unit_id, 'Hidráulica',   4),
      (v_unit_id, 'Decoração',    5),
      (v_unit_id, 'Audiovisual',  6),
      (v_unit_id, 'Climatização', 7),
      (v_unit_id, 'Outro',        8)
    ON CONFLICT (name, unit_id) DO NOTHING;
  END IF;
END;
$$;
