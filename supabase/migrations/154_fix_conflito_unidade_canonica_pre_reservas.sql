-- =============================================================
-- Migration 154 — Corrige get_pre_reserva_conflicts para usar a
-- unidade canonica COALESCE(Order.chosen_unit_id, deal.unit_id),
-- a mesma da pre_reservas_ploomes_view. Elimina conflitos falsos
-- entre festas de unidades diferentes.
-- =============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_pre_reserva_conflicts(p_unit_id UUID)
RETURNS TABLE (
  pr_id              TEXT,
  pr_source          TEXT,
  conflict_with_id   TEXT,
  conflict_with_type TEXT,
  conflict_date      DATE,
  gap_minutes        INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$

WITH deals_resolved AS (
  SELECT
    pd.*,
    COALESCE(
      (SELECT o.chosen_unit_id
         FROM public.ploomes_orders o
        WHERE o.deal_id = pd.ploomes_deal_id
          AND o.chosen_unit_id IS NOT NULL
        ORDER BY o.created_at DESC
        LIMIT 1),
      pd.unit_id
    ) AS resolved_unit_id
  FROM public.ploomes_deals pd
)

-- 1. PR Diretoria x Evento Confirmado (inalterado)
SELECT
  d.id::TEXT, 'diretoria', e.id::TEXT, 'event', d.date,
  (EXTRACT(EPOCH FROM (GREATEST(d.start_time, e.start_time) - LEAST(d.end_time, e.end_time))) / 60)::INTEGER
FROM pre_reservas_diretoria d
JOIN events e ON e.date = d.date AND e.unit_id = d.unit_id
WHERE d.unit_id = p_unit_id
  AND e.status = 'confirmed'
  AND d.start_time IS NOT NULL AND d.end_time IS NOT NULL
  AND e.start_time IS NOT NULL AND e.end_time IS NOT NULL
  AND EXTRACT(EPOCH FROM (GREATEST(d.start_time, e.start_time) - LEAST(d.end_time, e.end_time))) / 60 < 120

UNION ALL

-- 2. PR Ploomes x Evento Confirmado (usa unidade canonica)
SELECT
  pdr.ploomes_deal_id::TEXT, 'ploomes', e.id::TEXT, 'event', pdr.event_date,
  (EXTRACT(EPOCH FROM (GREATEST(pdr.start_time, e.start_time) - LEAST(pdr.end_time, e.end_time))) / 60)::INTEGER
FROM deals_resolved pdr
JOIN events e ON e.date = pdr.event_date AND e.unit_id = pdr.resolved_unit_id
WHERE pdr.resolved_unit_id = p_unit_id
  AND pdr.status_id = 1
  AND pdr.stage_id IN (60004416, 60056754)
  AND pdr.event_date IS NOT NULL
  AND e.status = 'confirmed'
  AND pdr.start_time IS NOT NULL AND pdr.end_time IS NOT NULL
  AND e.start_time IS NOT NULL AND e.end_time IS NOT NULL
  AND EXTRACT(EPOCH FROM (GREATEST(pdr.start_time, e.start_time) - LEAST(pdr.end_time, e.end_time))) / 60 < 120

UNION ALL

-- 3. PR Diretoria x PR Ploomes (usa unidade canonica)
SELECT
  d.id::TEXT, 'diretoria', pdr.ploomes_deal_id::TEXT, 'pre_reserva', d.date,
  (EXTRACT(EPOCH FROM (GREATEST(d.start_time, pdr.start_time) - LEAST(d.end_time, pdr.end_time))) / 60)::INTEGER
FROM pre_reservas_diretoria d
JOIN deals_resolved pdr ON pdr.event_date = d.date AND pdr.resolved_unit_id = d.unit_id
WHERE d.unit_id = p_unit_id
  AND pdr.status_id = 1
  AND pdr.stage_id IN (60004416, 60056754)
  AND pdr.event_date IS NOT NULL
  AND d.start_time IS NOT NULL AND d.end_time IS NOT NULL
  AND pdr.start_time IS NOT NULL AND pdr.end_time IS NOT NULL
  AND EXTRACT(EPOCH FROM (GREATEST(d.start_time, pdr.start_time) - LEAST(d.end_time, pdr.end_time))) / 60 < 120

UNION ALL

-- 4. PR Ploomes x PR Ploomes (usa unidade canonica; pares distintos)
SELECT
  a.ploomes_deal_id::TEXT, 'ploomes', b.ploomes_deal_id::TEXT, 'pre_reserva', a.event_date,
  (EXTRACT(EPOCH FROM (GREATEST(a.start_time, b.start_time) - LEAST(a.end_time, b.end_time))) / 60)::INTEGER
FROM deals_resolved a
JOIN deals_resolved b
  ON b.event_date = a.event_date
 AND b.resolved_unit_id = a.resolved_unit_id
 AND b.ploomes_deal_id > a.ploomes_deal_id
WHERE a.resolved_unit_id = p_unit_id
  AND a.status_id = 1 AND a.stage_id IN (60004416, 60056754) AND a.event_date IS NOT NULL
  AND b.status_id = 1 AND b.stage_id IN (60004416, 60056754) AND b.event_date IS NOT NULL
  AND a.start_time IS NOT NULL AND a.end_time IS NOT NULL
  AND b.start_time IS NOT NULL AND b.end_time IS NOT NULL
  AND EXTRACT(EPOCH FROM (GREATEST(a.start_time, b.start_time) - LEAST(a.end_time, b.end_time))) / 60 < 120
$$;

COMMENT ON FUNCTION public.get_pre_reserva_conflicts(UUID) IS
  'Detecta conflitos de horario entre pre-reservas (Diretoria e Ploomes) e eventos confirmados. Unidade de deals Ploomes resolvida via COALESCE(Order.chosen_unit_id, deal.unit_id), igual a pre_reservas_ploomes_view. gap_minutes < 0 = sobreposicao; 0..119 = intervalo < 2h.';

GRANT EXECUTE ON FUNCTION public.get_pre_reserva_conflicts(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
