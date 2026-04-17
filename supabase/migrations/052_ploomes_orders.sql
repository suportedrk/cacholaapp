BEGIN;

-- =============================================================
-- Migration 052 — Ploomes Orders (Vendas)
-- Tabelas: ploomes_orders + ploomes_order_products
-- Fonte de verdade para comissão e BI de vendedoras.
-- Owner = comissionado real (não Creator, que é quem digitou).
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- Tabela: ploomes_orders (cabeçalho da Venda)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ploomes_orders (
  ploomes_order_id     BIGINT PRIMARY KEY,
  order_number         INTEGER,
  deal_id              BIGINT,
  unit_id              UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  date                 DATE NOT NULL,
  amount               NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount             NUMERIC(12,2) DEFAULT 0,
  owner_id             INTEGER,
  owner_name           TEXT,
  owner_email          TEXT,
  creator_id           INTEGER,
  creator_name         TEXT,
  stage_id             INTEGER,
  contact_id           BIGINT,
  contact_name         TEXT,
  origin_quote_id      BIGINT,
  document_url         TEXT,
  ploomes_create_date  TIMESTAMPTZ,
  ploomes_last_update  TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE ploomes_orders IS
  'Vendas (Orders) importadas do Ploomes. Fonte de verdade para comissão e BI de vendedoras. Owner = comissionado real. Creator = quem digitou (rastreabilidade apenas).';

COMMENT ON COLUMN ploomes_orders.owner_name IS
  'Vendedora comissionada (OwnerId expandido). Usada em BI. NÃO confundir com creator_name (apenas quem digitou o documento no Ploomes).';

COMMENT ON COLUMN ploomes_orders.deal_id IS
  'DealId do Ploomes (bigint) — FK lógica para ploomes_deals.ploomes_deal_id. Sempre preenchido na API.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_ploomes_orders_owner_date
  ON ploomes_orders (owner_name, date DESC)
  WHERE owner_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ploomes_orders_deal
  ON ploomes_orders (deal_id)
  WHERE deal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ploomes_orders_unit_date
  ON ploomes_orders (unit_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_ploomes_orders_last_update
  ON ploomes_orders (ploomes_last_update DESC);

-- RLS
ALTER TABLE ploomes_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY ploomes_orders_select ON ploomes_orders
  FOR SELECT TO authenticated
  USING (
    is_global_viewer()
    OR unit_id = ANY(get_user_unit_ids())
  );

-- Trigger updated_at
CREATE TRIGGER trg_ploomes_orders_updated_at
  BEFORE UPDATE ON ploomes_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────────────────────
-- Tabela: ploomes_order_products (breakdown por produto)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ploomes_order_products (
  ploomes_product_id   BIGINT PRIMARY KEY,
  order_id             BIGINT NOT NULL REFERENCES ploomes_orders(ploomes_order_id) ON DELETE CASCADE,
  deal_id              BIGINT,
  unit_id              UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  product_id           INTEGER,
  product_name         TEXT,
  product_code         TEXT,
  group_name           TEXT,
  family_name          TEXT,
  quantity             NUMERIC(10,2) DEFAULT 1,
  unit_price           NUMERIC(12,2) DEFAULT 0,
  discount             NUMERIC(12,2) DEFAULT 0,
  total                NUMERIC(12,2) DEFAULT 0,
  bonus                BOOLEAN DEFAULT false,
  owner_id             INTEGER,
  owner_name           TEXT,
  order_date           DATE,
  created_at           TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE ploomes_order_products IS
  'Breakdown de produtos por Venda. Denormaliza unit_id, owner_name e order_date para acelerar queries de BI sem JOINs.';

COMMENT ON COLUMN ploomes_order_products.group_name IS
  'Nome do grupo do produto (ex: "Pacotes Mule Mule", "Adicionais Caulí"). Derivado do catálogo /Products?$expand=Group em sync-time.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_ploomes_order_products_group_date
  ON ploomes_order_products (group_name, order_date DESC)
  WHERE group_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ploomes_order_products_owner_group
  ON ploomes_order_products (owner_name, group_name)
  WHERE owner_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ploomes_order_products_unit_date
  ON ploomes_order_products (unit_id, order_date DESC);

CREATE INDEX IF NOT EXISTS idx_ploomes_order_products_order_id
  ON ploomes_order_products (order_id);

-- RLS
ALTER TABLE ploomes_order_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY ploomes_order_products_select ON ploomes_order_products
  FOR SELECT TO authenticated
  USING (
    is_global_viewer()
    OR unit_id = ANY(get_user_unit_ids())
  );

COMMIT;
