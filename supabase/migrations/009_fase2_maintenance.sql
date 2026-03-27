-- ============================================================
-- Migration 009 — Fase 2: Módulo de Manutenção
-- Ajusta schema de maintenance_orders + cria tabela sectors
-- ============================================================

-- ── 1. Tabela de Setores ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS sectors (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT        NOT NULL,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sectors: view"
  ON sectors FOR SELECT
  USING (TRUE);  -- qualquer usuário autenticado pode ver setores

CREATE POLICY "sectors: manage"
  ON sectors FOR ALL
  USING (check_permission(auth_user_id(), 'settings', 'edit'));

-- Seed dos setores
INSERT INTO sectors (name, sort_order) VALUES
  ('Salão Principal',      1),
  ('Salão 2',              2),
  ('Área Externa',         3),
  ('Cozinha',              4),
  ('Banheiros',            5),
  ('Área de Brinquedos',   6),
  ('Estacionamento',       7),
  ('Depósito',             8)
ON CONFLICT DO NOTHING;

-- ── 2. Ajustar maintenance_orders ────────────────────────────

-- 2a. Dropar CHECK de type antigo
ALTER TABLE maintenance_orders
  DROP CONSTRAINT IF EXISTS maintenance_orders_type_check;

-- 2b. Zerar dados existentes (banco de dev — sem dados reais)
TRUNCATE maintenance_orders CASCADE;

-- 2c. Trocar coluna sector (TEXT) por sector_id (UUID FK)
ALTER TABLE maintenance_orders
  DROP COLUMN IF EXISTS sector;

ALTER TABLE maintenance_orders
  ADD COLUMN sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL;

-- 2d. Alterar recurrence_rule de TEXT para JSONB
ALTER TABLE maintenance_orders
  ALTER COLUMN recurrence_rule TYPE JSONB
  USING NULL;  -- todos eram NULL, conversão segura

-- 2e. Recriar CHECK de type com novos valores
ALTER TABLE maintenance_orders
  ADD CONSTRAINT maintenance_orders_type_check
  CHECK (type IN ('emergency', 'punctual', 'recurring'));

-- 2f. Atualizar valor padrão do type
ALTER TABLE maintenance_orders
  ALTER COLUMN type SET DEFAULT 'punctual';

-- ── 3. Índice no novo campo sector_id ────────────────────────
CREATE INDEX IF NOT EXISTS idx_maintenance_orders_sector_id
  ON maintenance_orders(sector_id);

-- ── 4. Buckets de Storage ─────────────────────────────────────

-- 4a. Bucket maintenance-photos (privado)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'maintenance-photos',
  'maintenance-photos',
  FALSE,                         -- privado: acesso por signed URL
  5242880,                       -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 4b. Bucket user-avatars (privado)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  FALSE,
  2097152,                       -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── 5. RLS para Storage ───────────────────────────────────────

-- maintenance-photos: autenticados podem ler e inserir
CREATE POLICY "maintenance-photos: authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'maintenance-photos');

CREATE POLICY "maintenance-photos: authenticated insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'maintenance-photos');

CREATE POLICY "maintenance-photos: owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'maintenance-photos' AND auth.uid()::text = owner_id::text);

-- user-avatars: cada usuário gerencia seu próprio avatar
CREATE POLICY "user-avatars: owner all"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Qualquer autenticado pode ler avatares de outros usuários
CREATE POLICY "user-avatars: authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'user-avatars');
