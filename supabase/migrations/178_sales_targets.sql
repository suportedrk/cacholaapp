-- ============================================================
-- Migration 178 — Metas de Vendas (faturamento) por vendedora/mês
--
-- A "Meta mensal" do Meu Painel (/vendas) NÃO vem do Ploomes — a API
-- api2.ploomes.com não expõe entidade de Goals/Quotas (verificado 27/06/2026).
-- A meta é cadastro MANUAL nosso; o realizado continua vindo do Ploomes
-- (SUM(ploomes_order_products.total), fonte de verdade da Fase C).
--
-- Quem cadastra: super_admin + diretor (check_permission 'vendas','edit').
-- Quem vê: gestor (vendas:edit) vê todas; vendedora vê só a própria.
--
-- Convenção da esteira (migrations 160+): SEM BEGIN/COMMIT e SEM NOTIFY pgrst
-- soltos — a esteira migrate-prod.yml cuida da transação e do reload do schema.
--
-- Rollback: 178_sales_targets_rollback.sql
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- PARTE 1 — TABELA
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.sales_targets (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id      uuid          NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  unit_id        uuid          REFERENCES public.units(id) ON DELETE SET NULL,
  period_month   date          NOT NULL,
  target_revenue numeric(12,2) NOT NULL DEFAULT 0,
  target_deals   integer,                       -- reservado p/ futuro (UI atual: só faturamento)
  notes          text,
  created_by     uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT sales_targets_revenue_nonneg   CHECK (target_revenue >= 0),
  CONSTRAINT sales_targets_deals_nonneg      CHECK (target_deals IS NULL OR target_deals >= 0),
  CONSTRAINT sales_targets_period_first_day  CHECK (period_month = date_trunc('month', period_month)::date),
  CONSTRAINT sales_targets_unique_seller_month UNIQUE (seller_id, period_month)
);

-- (seller_id, period_month) já tem btree pelo UNIQUE sales_targets_unique_seller_month.
-- Índice extra só para o range puro por mês (caso "Todas as vendedoras", sem prefixo seller_id):
CREATE INDEX IF NOT EXISTS idx_sales_targets_month
  ON public.sales_targets (period_month);

COMMENT ON TABLE public.sales_targets IS
  'Metas de venda (faturamento) por vendedora/mês — cadastro manual (não vem do Ploomes). UNIQUE(seller_id, period_month); period_month sempre 1º dia do mês. Realizado = SUM(ploomes_order_products.total).';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_targets TO authenticated;

-- updated_at automático (função compartilhada do projeto)
DROP TRIGGER IF EXISTS trg_sales_targets_updated_at ON public.sales_targets;
CREATE TRIGGER trg_sales_targets_updated_at
  BEFORE UPDATE ON public.sales_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ════════════════════════════════════════════════════════════
-- PARTE 2 — RLS (permission-based via módulo 'vendas')
--   SELECT: gestor (vendas:edit) vê todas; vendedora vê só a própria meta.
--   CUD: vendas:edit (super_admin bypassa em check_permission).
-- Defesa em profundidade — as leituras do app passam pela RPC SECURITY DEFINER
-- da Parte 3; estas policies cobrem acesso direto à tabela.
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_targets: select" ON public.sales_targets;
DROP POLICY IF EXISTS "sales_targets: insert" ON public.sales_targets;
DROP POLICY IF EXISTS "sales_targets: update" ON public.sales_targets;
DROP POLICY IF EXISTS "sales_targets: delete" ON public.sales_targets;

CREATE POLICY "sales_targets: select" ON public.sales_targets
  FOR SELECT TO authenticated
  USING (
    public.check_permission(auth.uid(), 'vendas', 'edit')
    OR seller_id = (SELECT u.seller_id FROM public.users u WHERE u.id = auth.uid())
  );

CREATE POLICY "sales_targets: insert" ON public.sales_targets
  FOR INSERT TO authenticated
  WITH CHECK (public.check_permission(auth.uid(), 'vendas', 'edit'));

CREATE POLICY "sales_targets: update" ON public.sales_targets
  FOR UPDATE TO authenticated
  USING (public.check_permission(auth.uid(), 'vendas', 'edit'))
  WITH CHECK (public.check_permission(auth.uid(), 'vendas', 'edit'));

CREATE POLICY "sales_targets: delete" ON public.sales_targets
  FOR DELETE TO authenticated
  USING (public.check_permission(auth.uid(), 'vendas', 'edit'));

-- ════════════════════════════════════════════════════════════
-- PARTE 3 — RPC de leitura agregada por período
--   Soma as metas mensais cujo period_month cai no intervalo (cobre 3M/6M/12M).
--   p_seller_id NULL = soma de TODAS as vendedoras ativas não-sistema (visão "Todas").
--   Guard: exige vendas:view; vendedora é forçada à própria meta (espelha o
--   scoping do realizado em get_vendas_my_kpis).
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_sales_target_for_period(
  p_seller_id  uuid,
  p_start_date date,
  p_end_date   date
)
RETURNS TABLE (
  target_revenue numeric,
  target_deals   bigint,
  months_count   integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role          text;
  v_my_seller     uuid;
  v_effective     uuid;
BEGIN
  IF NOT public.check_permission(auth.uid(), 'vendas', 'view') THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  SELECT role, seller_id INTO v_role, v_my_seller
  FROM public.users WHERE id = auth.uid();

  -- Vendedora só enxerga a própria meta, independentemente do parâmetro.
  IF v_role = 'vendedora' THEN
    v_effective := v_my_seller;
  ELSE
    v_effective := p_seller_id;  -- NULL = todas as ativas não-sistema
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(st.target_revenue), 0)::numeric,
    COALESCE(SUM(st.target_deals), 0)::bigint,
    COUNT(*)::integer
  FROM public.sales_targets st
  JOIN public.sellers s ON s.id = st.seller_id
  WHERE st.period_month >= date_trunc('month', p_start_date)::date
    AND st.period_month <= p_end_date
    AND (
      (v_effective IS NOT NULL AND st.seller_id = v_effective)
      OR (v_effective IS NULL AND s.status = 'active' AND s.is_system_account = false)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_target_for_period(uuid, date, date) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- PARTE 4 — Garantir vendas:edit para diretores (defesa contra drift)
--   O template (role_permissions) já concede; check_permission lê só
--   user_permissions → backfill idempotente p/ diretores sem a linha.
--   super_admin bypassa; não precisa de linha.
-- ════════════════════════════════════════════════════════════
INSERT INTO public.user_permissions (user_id, unit_id, module, action, granted)
SELECT u.id, NULL, 'vendas', 'edit', true
FROM public.users u
WHERE u.role = 'diretor'
ON CONFLICT (user_id, unit_id, module, action) DO UPDATE SET granted = true;
