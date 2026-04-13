-- ============================================
-- Migration 040: Tabela ploomes_deals para módulo BI
-- Armazena TODOS os deals do pipeline Cachola
-- independente do stage, para análises de conversão
-- ============================================

-- 1. Tabela principal
CREATE TABLE IF NOT EXISTS ploomes_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação Ploomes
  ploomes_deal_id BIGINT NOT NULL UNIQUE,

  -- Dados do deal
  title TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  deal_amount NUMERIC(12,2),

  -- Stage e Status do pipeline
  stage_id BIGINT NOT NULL,
  stage_name TEXT,
  status_id INTEGER NOT NULL,         -- 1=Em aberto, 2=Ganho, 3=Perdido
  status_name TEXT,

  -- Unidade
  unit_id UUID REFERENCES units(id),

  -- Datas do Ploomes (as REAIS, não a data de sync)
  ploomes_create_date TIMESTAMPTZ NOT NULL,   -- CreateDate do Ploomes
  ploomes_last_update TIMESTAMPTZ,            -- LastUpdateDate do Ploomes

  -- Data da festa (extraída de OtherProperties se disponível)
  event_date DATE,

  -- FK opcional para o evento criado (se deal virou festa)
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índices para BI queries
CREATE INDEX IF NOT EXISTS idx_ploomes_deals_unit_id        ON ploomes_deals(unit_id);
CREATE INDEX IF NOT EXISTS idx_ploomes_deals_create_date    ON ploomes_deals(ploomes_create_date);
CREATE INDEX IF NOT EXISTS idx_ploomes_deals_status_id      ON ploomes_deals(status_id);
CREATE INDEX IF NOT EXISTS idx_ploomes_deals_stage_id       ON ploomes_deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_ploomes_deals_event_date     ON ploomes_deals(event_date);
CREATE INDEX IF NOT EXISTS idx_ploomes_deals_unit_create    ON ploomes_deals(unit_id, ploomes_create_date);
CREATE INDEX IF NOT EXISTS idx_ploomes_deals_unit_status    ON ploomes_deals(unit_id, status_id);

-- 3. Trigger updated_at (reutiliza função existente)
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON ploomes_deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 4. RLS
ALTER TABLE ploomes_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view deals of their units" ON ploomes_deals
  FOR SELECT USING (
    unit_id = ANY(get_user_unit_ids())
    OR is_global_viewer()
  );

CREATE POLICY "Service role can manage deals" ON ploomes_deals
  FOR ALL USING (auth.role() = 'service_role');

-- 5. Comentários
COMMENT ON TABLE ploomes_deals IS 'Todos os deals do pipeline Cachola para BI. Sync paralelo ao events (não filtra por stage).';
COMMENT ON COLUMN ploomes_deals.ploomes_create_date IS 'Data de criação REAL no Ploomes (CreateDate), NÃO a data de sync';
COMMENT ON COLUMN ploomes_deals.status_id IS '1=Em aberto, 2=Ganho, 3=Perdido (mapeamento real do Ploomes)';
COMMENT ON COLUMN ploomes_deals.event_id IS 'FK para events se este deal gerou um evento no Cachola';
