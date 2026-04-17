-- =============================================================
-- Migration 053: Tabela mestra de vendedoras
-- Fonte da verdade para status ativo/inativo usado em BI
-- =============================================================

-- Tabela
CREATE TABLE IF NOT EXISTS sellers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          INT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  email             TEXT,
  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'inactive')),
  hire_date         DATE,
  termination_date  DATE,
  primary_unit_id   UUID REFERENCES units(id) ON DELETE SET NULL,
  notes             TEXT,
  photo_url         TEXT,
  is_system_account BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sellers IS
  'Cadastro mestre de vendedoras. Fonte da verdade para filtros ativo/inativo no BI.';
COMMENT ON COLUMN sellers.owner_id IS
  'OwnerId do Ploomes. Chave de junção com ploomes_orders.owner_id e ploomes_deals.owner_id.';
COMMENT ON COLUMN sellers.hire_date IS
  'Data de contratação. Seed usa MIN(ploomes_create_date) da primeira order como proxy.';
COMMENT ON COLUMN sellers.termination_date IS
  'Data de desligamento. Usado para normalizar receita mensal média no ranking.';
COMMENT ON COLUMN sellers.is_system_account IS
  'Flag para contas que nunca são vendedoras reais (bots, automações, integrações Ploomes). Se TRUE, ignorada em rankings de BI mesmo que status=active. Sync futuro com /Users do Ploomes respeita esta flag.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sellers_status   ON sellers(status);
CREATE INDEX IF NOT EXISTS idx_sellers_owner_id ON sellers(owner_id);

-- Trigger updated_at (reusa função padrão)
DROP TRIGGER IF EXISTS sellers_updated_at ON sellers;
CREATE TRIGGER sellers_updated_at
  BEFORE UPDATE ON sellers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- Row Level Security
-- =============================================================
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer autenticado (BI, dropdowns, joins)
DROP POLICY IF EXISTS "sellers_select_authenticated" ON sellers;
CREATE POLICY "sellers_select_authenticated" ON sellers
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: super_admin + diretor
DROP POLICY IF EXISTS "sellers_insert_admin_diretor" ON sellers;
CREATE POLICY "sellers_insert_admin_diretor" ON sellers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'diretor')
    )
  );

-- UPDATE: super_admin + diretor
DROP POLICY IF EXISTS "sellers_update_admin_diretor" ON sellers;
CREATE POLICY "sellers_update_admin_diretor" ON sellers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'diretor')
    )
  );

-- DELETE: apenas super_admin (mais restritivo — delete perde histórico)
DROP POLICY IF EXISTS "sellers_delete_super_admin" ON sellers;
CREATE POLICY "sellers_delete_super_admin" ON sellers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = 'super_admin'
    )
  );

-- =============================================================
-- Seed inicial: todos os owner_id distintos em ploomes_orders
-- hire_date = primeira order do owner no Ploomes (proxy)
-- =============================================================
INSERT INTO sellers (owner_id, name, status, hire_date)
SELECT DISTINCT ON (po.owner_id)
  po.owner_id,
  po.owner_name,
  'active',
  (
    SELECT MIN(DATE(po2.ploomes_create_date))
    FROM ploomes_orders po2
    WHERE po2.owner_id = po.owner_id
  )
FROM ploomes_orders po
WHERE po.owner_id IS NOT NULL
  AND po.owner_name IS NOT NULL
  AND TRIM(po.owner_name) <> ''
ON CONFLICT (owner_id) DO NOTHING;

-- Marcar Bruno Motta como inativo (ex-gerente Pinheiros, saiu dez/2025)
UPDATE sellers
SET
  status           = 'inactive',
  termination_date = '2025-12-31',
  notes            = 'Ex-gerente Pinheiros. Desligamento em dezembro/2025.'
WHERE name ILIKE '%bruno%motta%';

-- Marcar Contador de negócios como conta de sistema (automação de roleta Ploomes)
-- Ativo no Ploomes mas não é vendedor real. Nunca aparece em ranking de BI.
UPDATE sellers
SET
  status            = 'inactive',
  is_system_account = TRUE,
  notes             = 'Conta de automação Ploomes (roleta de distribuição de deals). Não é vendedora real.'
WHERE owner_id = 10045234;
