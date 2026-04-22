-- Migration 070: get_event_sales_summary
--
-- RPC que retorna o resumo comercial de um evento:
--   deal     → dados do deal Ploomes vinculado
--   products → produtos vendidos via ploomes_orders
--   upsell_contacts → histórico de contatos de upsell

CREATE OR REPLACE FUNCTION public.get_event_sales_summary(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal_id  BIGINT;
  v_deal     JSONB;
  v_prods    JSONB;
  v_contacts JSONB;
BEGIN
  -- Guard: apenas roles com acesso ao módulo Vendas
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin','diretor','gerente','vendedora','pos_vendas')
  ) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Resolve ploomes_deal_id (TEXT no evento, BIGINT no ploomes_deals)
  SELECT ploomes_deal_id::BIGINT INTO v_deal_id
  FROM public.events
  WHERE id = p_event_id
    AND ploomes_deal_id IS NOT NULL;

  -- ── 1. Deal header ────────────────────────────────────────────
  IF v_deal_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'ploomes_deal_id',    d.ploomes_deal_id,
      'owner_name',         d.owner_name,
      'deal_amount',        d.deal_amount,
      'stage_name',         d.stage_name,
      'status_id',          d.status_id,
      'ploomes_last_update', d.ploomes_last_update
    ) INTO v_deal
    FROM public.ploomes_deals d
    WHERE d.ploomes_deal_id = v_deal_id;
  END IF;

  -- ── 2. Produtos vendidos ──────────────────────────────────────
  IF v_deal_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'group_name',   pop.group_name,
        'product_name', pop.product_name,
        'quantity',     pop.quantity,
        'total',        pop.total
      ) ORDER BY pop.group_name, pop.product_name
    ), '[]'::jsonb) INTO v_prods
    FROM public.ploomes_orders po
    JOIN public.ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    WHERE po.deal_id = v_deal_id;
  ELSE
    v_prods := '[]'::jsonb;
  END IF;

  -- ── 3. Histórico de contatos de upsell ───────────────────────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',                 ucl.id,
      'contacted_at',       ucl.contacted_at,
      'outcome',            ucl.outcome,
      'notes',              ucl.notes,
      'contacted_by_name',  u.name,
      'seller_name',        s.name,
      'reopened_at',        ucl.reopened_at
    ) ORDER BY ucl.contacted_at DESC
  ), '[]'::jsonb) INTO v_contacts
  FROM public.upsell_contact_log ucl
  JOIN public.users u  ON u.id  = ucl.contacted_by
  LEFT JOIN public.sellers s ON s.id = ucl.seller_id
  WHERE ucl.event_id = p_event_id;

  RETURN jsonb_build_object(
    'deal',            v_deal,
    'products',        v_prods,
    'upsell_contacts', v_contacts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_event_sales_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_sales_summary(UUID) TO authenticated;
