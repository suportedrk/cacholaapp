-- ============================================================
-- Rollback da Migration 167 — restaura get_event_conflicts / get_conflicting_event_ids
-- ao estado anterior (SEM guard de unidade e SEM search_path).
-- ============================================================
-- ATENCAO: reabre o vazamento cross-tenant. Usar so se a 167 causar regressao.

CREATE OR REPLACE FUNCTION public.get_event_conflicts(p_unit_id uuid)
RETURNS TABLE(event_id_a uuid, event_id_b uuid, conflict_date date, gap_minutes integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT
    a.id                                              AS event_id_a,
    b.id                                              AS event_id_b,
    a.date                                            AS conflict_date,
    EXTRACT(EPOCH FROM (
      GREATEST(a.start_time, b.start_time) -
      LEAST(a.end_time, b.end_time)
    ))::INTEGER / 60                                  AS gap_minutes
  FROM public.events a
  JOIN public.events b
    ON  a.unit_id = b.unit_id
    AND a.date    = b.date
    AND a.id      < b.id
  WHERE
    a.unit_id = p_unit_id
    AND a.status IN ('confirmed', 'in_progress')
    AND b.status IN ('confirmed', 'in_progress')
    AND (
      (a.end_time <= b.start_time AND b.start_time - a.end_time < INTERVAL '2 hours')
      OR
      (b.end_time <= a.start_time AND a.start_time - b.end_time < INTERVAL '2 hours')
      OR
      (a.start_time < b.end_time AND b.start_time < a.end_time)
    );
$function$;

ALTER FUNCTION public.get_conflicting_event_ids(uuid) RESET search_path;
