-- ============================================================
-- Migration 022 — Mapeamento Ploomes → Unidade
-- ============================================================
-- Tabela para mapear o valor do campo "Unidade Escolhida" do
-- Ploomes (ObjectValueName) para o unit_id correspondente no
-- Cachola OS. Configurável sem necessidade de redeploy.

CREATE TABLE IF NOT EXISTS ploomes_unit_mapping (
  id               UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  ploomes_value    TEXT          NOT NULL UNIQUE,   -- Ex: "Cachola PINHEIROS"
  ploomes_object_id INTEGER,                         -- Ex: 609551206 (backup opcional)
  unit_id          UUID          NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Trigger updated_at
CREATE TRIGGER update_ploomes_unit_mapping_updated_at
  BEFORE UPDATE ON ploomes_unit_mapping
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Índice para lookup rápido (o campo mais consultado)
CREATE INDEX IF NOT EXISTS idx_ploomes_unit_mapping_value
  ON ploomes_unit_mapping (ploomes_value)
  WHERE is_active = TRUE;

-- RLS: apenas super_admin e gerentes podem ver/editar
ALTER TABLE ploomes_unit_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ploomes_unit_mapping_select"
  ON ploomes_unit_mapping FOR SELECT
  USING (
    check_permission(auth.uid(), 'settings', 'view')
  );

CREATE POLICY "ploomes_unit_mapping_manage"
  ON ploomes_unit_mapping FOR ALL
  USING (
    check_permission(auth.uid(), 'settings', 'edit')
  );

-- Seed: mapeamentos iniciais
-- Pinheiros
INSERT INTO ploomes_unit_mapping (ploomes_value, ploomes_object_id, unit_id)
SELECT
  'Cachola PINHEIROS',
  609551206,
  id
FROM units
WHERE slug = 'pinheiros'
ON CONFLICT (ploomes_value) DO NOTHING;

-- Moema
INSERT INTO ploomes_unit_mapping (ploomes_value, ploomes_object_id, unit_id)
SELECT
  'Cachola MOEMA',
  NULL,
  id
FROM units
WHERE slug = 'moema'
ON CONFLICT (ploomes_value) DO NOTHING;
