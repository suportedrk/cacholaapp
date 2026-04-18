-- =============================================================
-- Migration 061: Infraestrutura de Upsell
--   1. ploomes_contacts   — espelho local de contatos Ploomes (Cliente Cachola=Sim)
--   2. upsell_contact_log — registro de contatos feitos pela vendedora
--   3. ploomes_config     — colunas para chave do campo "Cliente Cachola ?"
-- =============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. ploomes_contacts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ploomes_contacts (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ploomes_contact_id   BIGINT      NOT NULL UNIQUE,
  name                 TEXT        NOT NULL,
  legal_name           TEXT,
  email                TEXT,
  phones               JSONB,
  birthday             DATE,
  next_anniversary     DATE,
  previous_anniversary DATE,
  last_deal_id         BIGINT,
  last_order_id        BIGINT,
  owner_id             INTEGER,
  owner_name           TEXT,
  cliente_cachola      BOOLEAN     NOT NULL DEFAULT TRUE,
  ploomes_create_date  TIMESTAMPTZ,
  ploomes_update_date  TIMESTAMPTZ,
  synced_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ploomes_contacts_owner_id
  ON public.ploomes_contacts(owner_id);

CREATE INDEX IF NOT EXISTS idx_ploomes_contacts_previous_anniversary
  ON public.ploomes_contacts(previous_anniversary)
  WHERE previous_anniversary IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ploomes_contacts_next_anniversary
  ON public.ploomes_contacts(next_anniversary)
  WHERE next_anniversary IS NOT NULL;

ALTER TABLE public.ploomes_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY ploomes_contacts_select ON public.ploomes_contacts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin','diretor','gerente','vendedora')
  ));

CREATE TRIGGER trg_ploomes_contacts_updated_at
  BEFORE UPDATE ON public.ploomes_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.ploomes_contacts IS
  'Espelho local de contatos Ploomes com Cliente Cachola=Sim. Sync periódico via cron a cada 30min.';

-- ─────────────────────────────────────────────────────────────
-- 2. upsell_contact_log
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.upsell_contact_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  seller_id     UUID        NOT NULL REFERENCES public.sellers(id),
  contacted_by  UUID        NOT NULL REFERENCES public.users(id),
  contacted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome       TEXT        NOT NULL
                CHECK (outcome IN ('tentou','recusou','vendeu_adicional','vendeu_upgrade','outro')),
  notes         TEXT,
  reopened_at   TIMESTAMPTZ,
  reopened_by   UUID        REFERENCES public.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upsell_log_event_id
  ON public.upsell_contact_log(event_id);

CREATE INDEX IF NOT EXISTS idx_upsell_log_seller_id
  ON public.upsell_contact_log(seller_id);

CREATE INDEX IF NOT EXISTS idx_upsell_log_contacted_at
  ON public.upsell_contact_log(contacted_at DESC);

-- Uma oportunidade "ativa" (não reaberta) por evento
CREATE UNIQUE INDEX IF NOT EXISTS uniq_upsell_log_active_per_event
  ON public.upsell_contact_log(event_id)
  WHERE reopened_at IS NULL;

ALTER TABLE public.upsell_contact_log ENABLE ROW LEVEL SECURITY;

-- SELECT: VENDAS_MODULE_ROLES
CREATE POLICY upsell_log_select ON public.upsell_contact_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin','diretor','gerente','vendedora')
  ));

-- INSERT: vendedora responsável ou gestor
CREATE POLICY upsell_log_insert ON public.upsell_contact_log
  FOR INSERT TO authenticated
  WITH CHECK (
    contacted_by = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role IN ('super_admin','diretor','gerente')
      )
      OR EXISTS (
        SELECT 1 FROM public.users u
        JOIN public.sellers s ON s.id = u.seller_id
        WHERE u.id = auth.uid()
          AND s.id = upsell_contact_log.seller_id
      )
    )
  );

-- UPDATE: quem criou ou gestor pode reabrir
CREATE POLICY upsell_log_update ON public.upsell_contact_log
  FOR UPDATE TO authenticated
  USING (
    contacted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin','diretor','gerente')
    )
  );

CREATE TRIGGER trg_upsell_log_updated_at
  BEFORE UPDATE ON public.upsell_contact_log
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.upsell_contact_log IS
  'Log de contatos feitos em oportunidades de upsell. uniq_upsell_log_active_per_event garante um contato ativo por evento; reopened_at libera para reabrir.';

-- ─────────────────────────────────────────────────────────────
-- 3. Estende ploomes_config com campos de "Cliente Cachola ?"
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.ploomes_config
  ADD COLUMN IF NOT EXISTS cliente_cachola_field_key    TEXT,
  ADD COLUMN IF NOT EXISTS cliente_cachola_sim_option_id BIGINT;

COMMENT ON COLUMN public.ploomes_config.cliente_cachola_field_key IS
  'FieldKey do campo customizado "Cliente Cachola ?" em Contact (TypeId=10 checkbox). Ex: contact_E2B745FB-...';
COMMENT ON COLUMN public.ploomes_config.cliente_cachola_sim_option_id IS
  'Valor "Sim" do campo checkbox: para TypeId=10 é 1 (BigIntegerValue). Usado no filtro OData do sync-contacts.';

COMMIT;
