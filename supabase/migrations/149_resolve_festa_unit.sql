-- ============================================================
-- Migration 149 — Fundação da unidade canônica da festa (Fase 1)
-- ============================================================
-- 1. Função-regra escalar resolve_festa_unit(): hierarquia canônica
--    chosen (Order) > Escolhida (deal_A583075F) > Pretendida (deal_BD9C4B07),
--    com fallback final SEMPRE na Pretendida — NUNCA "primeira unidade ativa".
-- 2. Coluna ploomes_deals.escolhida_unit_id (nível 2 da hierarquia),
--    populada pelo sync; NULL quando o campo Escolhida está vazio.
--
-- NÃO altera RPCs do BI (Fase 3) nem faz backfill de dado (Fase 2).

BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_festa_unit(
  p_chosen     uuid,
  p_escolhida  uuid,
  p_pretendida uuid
) RETURNS uuid
  LANGUAGE sql
  IMMUTABLE
AS $$
  SELECT COALESCE(p_chosen, p_escolhida, p_pretendida);
$$;

COMMENT ON FUNCTION public.resolve_festa_unit(uuid, uuid, uuid) IS
  'Hierarquia canônica da UNIDADE DA FESTA: chosen (Order, order_EDD14E93) > Escolhida (deal_A583075F) > Pretendida (deal_BD9C4B07). Fallback final SEMPRE na Pretendida — NUNCA "primeira unidade ativa". Função pura/escalar, reutilizada por events.unit_id, ploomes_order_products.unit_id e (Fase 3) pelas RPCs do BI. Espelha resolveFestaUnit em src/lib/ploomes/resolve-unit.ts.';

GRANT EXECUTE ON FUNCTION public.resolve_festa_unit(uuid, uuid, uuid) TO authenticated;

ALTER TABLE public.ploomes_deals
  ADD COLUMN IF NOT EXISTS escolhida_unit_id uuid REFERENCES public.units(id);

COMMENT ON COLUMN public.ploomes_deals.escolhida_unit_id IS
  'Unidade ESCOLHIDA da festa (FieldKey deal_A583075F) — nível 2 da hierarquia canônica. Populada pelo sync (sync-deals.ts) via resolveUnitIdStrict. NULL quando a Escolhida está vazia, fazendo resolve_festa_unit cair na Pretendida (unit_id).';

NOTIFY pgrst, 'reload schema';

COMMIT;
