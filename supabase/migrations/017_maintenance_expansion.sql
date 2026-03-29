-- ============================================================
-- Migration 017: Maintenance Schema Expansion
-- Adds: preventive type, suppliers, costs, approval workflow
-- ============================================================

-- ============================================================
-- STEP 1: Create maintenance_suppliers
-- (must exist before FK in maintenance_orders)
-- ============================================================

CREATE TABLE IF NOT EXISTS maintenance_suppliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  company_name    TEXT NOT NULL,
  trade_name      TEXT,
  cnpj            TEXT,
  category        TEXT,
  email           TEXT,
  phone           TEXT,
  address         TEXT,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  rating          SMALLINT CHECK (rating >= 1 AND rating <= 5),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_suppliers_unit_id   ON maintenance_suppliers(unit_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_suppliers_category  ON maintenance_suppliers(category);
CREATE INDEX IF NOT EXISTS idx_maintenance_suppliers_active    ON maintenance_suppliers(unit_id, is_active);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_maintenance_suppliers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_maintenance_suppliers_updated_at
  BEFORE UPDATE ON maintenance_suppliers
  FOR EACH ROW EXECUTE FUNCTION update_maintenance_suppliers_updated_at();

-- ============================================================
-- STEP 2: Create supplier_contacts
-- ============================================================

CREATE TABLE IF NOT EXISTS supplier_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id  UUID NOT NULL REFERENCES maintenance_suppliers(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  role         TEXT,
  phone        TEXT,
  whatsapp     TEXT,
  email        TEXT,
  is_primary   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier_id ON supplier_contacts(supplier_id);

-- ============================================================
-- STEP 3: Create supplier_documents
-- ============================================================

CREATE TABLE IF NOT EXISTS supplier_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id       UUID NOT NULL REFERENCES maintenance_suppliers(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  file_url          TEXT NOT NULL,
  file_type         TEXT,
  file_size_bytes   INTEGER,
  uploaded_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at        DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier_id ON supplier_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_expires     ON supplier_documents(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================
-- STEP 4: Create maintenance_costs
-- ============================================================

CREATE TABLE IF NOT EXISTS maintenance_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  order_id        UUID NOT NULL REFERENCES maintenance_orders(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  cost_type       TEXT NOT NULL CHECK (cost_type IN ('material', 'labor', 'travel', 'other')),
  receipt_url     TEXT,
  receipt_notes   TEXT,

  -- Approval workflow
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by    UUID NOT NULL REFERENCES users(id),
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_costs_unit_id       ON maintenance_costs(unit_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_costs_order_id      ON maintenance_costs(order_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_costs_status        ON maintenance_costs(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_costs_submitted_by  ON maintenance_costs(submitted_by);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_maintenance_costs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_maintenance_costs_updated_at
  BEFORE UPDATE ON maintenance_costs
  FOR EACH ROW EXECUTE FUNCTION update_maintenance_costs_updated_at();

-- ============================================================
-- STEP 5: Alter maintenance_orders
-- ============================================================

-- 5a. Expand type CHECK constraint to include 'preventive'
ALTER TABLE maintenance_orders
  DROP CONSTRAINT IF EXISTS maintenance_orders_type_check;

ALTER TABLE maintenance_orders
  ADD CONSTRAINT maintenance_orders_type_check
  CHECK (type IN ('emergency', 'punctual', 'recurring', 'preventive'));

-- 5b. Add supplier_id FK (nullable — not every order has an external supplier)
ALTER TABLE maintenance_orders
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES maintenance_suppliers(id) ON DELETE SET NULL;

-- 5c. Add cost_estimate
ALTER TABLE maintenance_orders
  ADD COLUMN IF NOT EXISTS cost_estimate DECIMAL(10,2);

-- 5d. Add completed_at for SLA calculation
ALTER TABLE maintenance_orders
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 5e. Add preventive_plan JSONB
-- Schema: { frequency, interval, checklist_items[], last_performed_at, next_due_date,
--           advance_notice_days, linked_equipment_id }
ALTER TABLE maintenance_orders
  ADD COLUMN IF NOT EXISTS preventive_plan JSONB;

-- Index for supplier_id lookup
CREATE INDEX IF NOT EXISTS idx_maintenance_orders_supplier_id ON maintenance_orders(supplier_id) WHERE supplier_id IS NOT NULL;

-- ============================================================
-- STEP 6: RLS — Enable and create policies
-- ============================================================

ALTER TABLE maintenance_suppliers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_contacts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_costs      ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------
-- maintenance_suppliers: direct unit_id check
-- ----------------------------------------------------------
CREATE POLICY "suppliers: view"
ON maintenance_suppliers FOR SELECT TO authenticated
USING (
  check_permission(auth.uid(), 'maintenance', 'view')
  AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
);

CREATE POLICY "suppliers: create"
ON maintenance_suppliers FOR INSERT TO authenticated
WITH CHECK (
  check_permission(auth.uid(), 'maintenance', 'create')
  AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
);

CREATE POLICY "suppliers: update"
ON maintenance_suppliers FOR UPDATE TO authenticated
USING (
  check_permission(auth.uid(), 'maintenance', 'edit')
  AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
);

CREATE POLICY "suppliers: delete"
ON maintenance_suppliers FOR DELETE TO authenticated
USING (
  check_permission(auth.uid(), 'maintenance', 'delete')
  AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
);

-- ----------------------------------------------------------
-- supplier_contacts: access via parent supplier unit_id
-- ----------------------------------------------------------
CREATE POLICY "supplier_contacts: view"
ON supplier_contacts FOR SELECT TO authenticated
USING (
  supplier_id IN (
    SELECT id FROM maintenance_suppliers
    WHERE is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
  )
);

CREATE POLICY "supplier_contacts: create"
ON supplier_contacts FOR INSERT TO authenticated
WITH CHECK (
  supplier_id IN (
    SELECT id FROM maintenance_suppliers
    WHERE check_permission(auth.uid(), 'maintenance', 'create')
      AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  )
);

CREATE POLICY "supplier_contacts: update"
ON supplier_contacts FOR UPDATE TO authenticated
USING (
  supplier_id IN (
    SELECT id FROM maintenance_suppliers
    WHERE check_permission(auth.uid(), 'maintenance', 'edit')
      AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  )
);

CREATE POLICY "supplier_contacts: delete"
ON supplier_contacts FOR DELETE TO authenticated
USING (
  supplier_id IN (
    SELECT id FROM maintenance_suppliers
    WHERE check_permission(auth.uid(), 'maintenance', 'delete')
      AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  )
);

-- ----------------------------------------------------------
-- supplier_documents: access via parent supplier unit_id
-- ----------------------------------------------------------
CREATE POLICY "supplier_documents: view"
ON supplier_documents FOR SELECT TO authenticated
USING (
  supplier_id IN (
    SELECT id FROM maintenance_suppliers
    WHERE is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
  )
);

CREATE POLICY "supplier_documents: create"
ON supplier_documents FOR INSERT TO authenticated
WITH CHECK (
  supplier_id IN (
    SELECT id FROM maintenance_suppliers
    WHERE check_permission(auth.uid(), 'maintenance', 'create')
      AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  )
);

CREATE POLICY "supplier_documents: update"
ON supplier_documents FOR UPDATE TO authenticated
USING (
  supplier_id IN (
    SELECT id FROM maintenance_suppliers
    WHERE check_permission(auth.uid(), 'maintenance', 'edit')
      AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  )
);

CREATE POLICY "supplier_documents: delete"
ON supplier_documents FOR DELETE TO authenticated
USING (
  supplier_id IN (
    SELECT id FROM maintenance_suppliers
    WHERE check_permission(auth.uid(), 'maintenance', 'delete')
      AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  )
);

-- ----------------------------------------------------------
-- maintenance_costs: direct unit_id check
-- Técnico vê seus próprios; gerente vê todos da unidade
-- ----------------------------------------------------------
CREATE POLICY "costs: view"
ON maintenance_costs FOR SELECT TO authenticated
USING (
  (check_permission(auth.uid(), 'maintenance', 'view') OR submitted_by = auth.uid())
  AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
);

CREATE POLICY "costs: create"
ON maintenance_costs FOR INSERT TO authenticated
WITH CHECK (
  check_permission(auth.uid(), 'maintenance', 'create')
  AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
);

CREATE POLICY "costs: update"
ON maintenance_costs FOR UPDATE TO authenticated
USING (
  (check_permission(auth.uid(), 'maintenance', 'edit') OR submitted_by = auth.uid())
  AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
);

CREATE POLICY "costs: delete"
ON maintenance_costs FOR DELETE TO authenticated
USING (
  check_permission(auth.uid(), 'maintenance', 'delete')
  AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
);

-- ============================================================
-- STEP 7: Storage buckets
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-documents',
  'supplier-documents',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'maintenance-receipts',
  'maintenance-receipts',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies — supplier-documents
CREATE POLICY "supplier-documents: authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'supplier-documents');

CREATE POLICY "supplier-documents: authenticated insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'supplier-documents');

CREATE POLICY "supplier-documents: authenticated delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'supplier-documents');

-- Storage policies — maintenance-receipts
CREATE POLICY "maintenance-receipts: authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'maintenance-receipts');

CREATE POLICY "maintenance-receipts: authenticated insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'maintenance-receipts');

CREATE POLICY "maintenance-receipts: authenticated delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'maintenance-receipts');

-- ============================================================
-- STEP 8: Seed data (Pinheiros — unit_id hardcoded for dev)
-- ============================================================

DO $$
DECLARE
  v_unit_id   UUID := '61b94ee5-ed89-4671-baf0-3475f7cdaf0f';
  v_admin_id  UUID := '2bc52f06-8209-42ce-b1ea-00523214bcf0';
  v_order_id  UUID := 'e3dac6c3-3dd2-42a7-9c86-08ed293b510a';

  v_supplier1 UUID;
  v_supplier2 UUID;
  v_supplier3 UUID;
BEGIN
  -- Suppliers (multi-row insert, IDs captured separately)
  INSERT INTO maintenance_suppliers (unit_id, company_name, trade_name, cnpj, category, phone, email, is_active, rating)
  VALUES
    (v_unit_id, 'Refrimax Climatização Ltda',   'Refrimax',   '12.345.678/0001-90', 'Refrigeração', '(11) 99999-0001', 'contato@refrimax.com.br', true, 4),
    (v_unit_id, 'Eletrofix Serviços Elétricos',  'Eletrofix',  '98.765.432/0001-10', 'Elétrica',     '(11) 99999-0002', 'eletrofix@email.com',     true, 5),
    (v_unit_id, 'HidroClean Manutenção',          'HidroClean', NULL,                 'Hidráulica',   '(11) 99999-0003', NULL,                      true, 3);

  -- Capture IDs by name
  SELECT id INTO v_supplier1 FROM maintenance_suppliers WHERE company_name = 'Refrimax Climatização Ltda'   AND unit_id = v_unit_id LIMIT 1;
  SELECT id INTO v_supplier2 FROM maintenance_suppliers WHERE company_name = 'Eletrofix Serviços Elétricos'  AND unit_id = v_unit_id LIMIT 1;
  SELECT id INTO v_supplier3 FROM maintenance_suppliers WHERE company_name = 'HidroClean Manutenção'          AND unit_id = v_unit_id LIMIT 1;

  -- Contacts
  INSERT INTO supplier_contacts (supplier_id, name, role, phone, whatsapp, email, is_primary)
  VALUES
    (v_supplier1, 'Carlos Oliveira',  'Técnico',    '(11) 98888-0001', '(11) 98888-0001', 'carlos@refrimax.com.br',    true),
    (v_supplier1, 'Ana Lima',         'Comercial',  '(11) 98888-0002', NULL,              'ana@refrimax.com.br',       false),
    (v_supplier2, 'Roberto Ferreira', 'Técnico',    '(11) 98888-0003', '(11) 98888-0003', 'roberto@eletrofix.com',     true),
    (v_supplier3, 'Marcos Costa',     'Hidráulico', '(11) 98888-0004', '(11) 98888-0004', NULL,                       true);

  -- Cost example linked to existing order
  INSERT INTO maintenance_costs (unit_id, order_id, description, amount, cost_type, receipt_notes, status, submitted_by)
  VALUES
    (v_unit_id, v_order_id, 'Compra de filtro de ar',          85.90,  'material', 'Nota fiscal anexada', 'pending',  v_admin_id),
    (v_unit_id, v_order_id, 'Mão de obra técnico - 2h',       250.00,  'labor',    NULL,                  'approved', v_admin_id),
    (v_unit_id, v_order_id, 'Deslocamento do técnico',         40.00,  'travel',   NULL,                  'approved', v_admin_id);

  -- Update the reviewed costs
  UPDATE maintenance_costs
  SET reviewed_by = v_admin_id, reviewed_at = now()
  WHERE order_id = v_order_id AND status = 'approved';

END $$;
