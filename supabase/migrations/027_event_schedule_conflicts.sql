-- ============================================================
-- Migration 027: Detecção de conflito de horário entre eventos
-- ============================================================
-- Detecta pares de eventos na mesma unidade e data com intervalo
-- inferior a 2 horas entre eles.
-- Apenas status 'confirmed' e 'in_progress' participam da checagem.
-- setup_time e teardown_time NÃO entram na lógica por ora —
-- apenas start_time e end_time.
-- ============================================================

-- ============================================================
-- 1. FUNÇÃO: get_event_conflicts(p_unit_id UUID)
--    Retorna todos os pares de eventos conflitantes para uma unidade.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_event_conflicts(p_unit_id UUID)
RETURNS TABLE (
  event_id_a    UUID,
  event_id_b    UUID,
  conflict_date DATE,
  gap_minutes   INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
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
    AND a.id      < b.id   -- evita duplicar o par (A,B) e (B,A)
  WHERE
    a.unit_id = p_unit_id
    AND a.status IN ('confirmed', 'in_progress')
    AND b.status IN ('confirmed', 'in_progress')
    AND (
      -- B começa antes de 2h após fim de A
      (a.end_time <= b.start_time AND b.start_time - a.end_time < INTERVAL '2 hours')
      OR
      -- A começa antes de 2h após fim de B
      (b.end_time <= a.start_time AND a.start_time - b.end_time < INTERVAL '2 hours')
      OR
      -- sobreposição direta (um começa antes do outro terminar)
      (a.start_time < b.end_time AND b.start_time < a.end_time)
    );
$$;

-- ============================================================
-- 2. FUNÇÃO: get_conflicting_event_ids(p_unit_id UUID)
--    Retorna apenas os IDs únicos de eventos com algum conflito.
--    Usada como alternativa quando apenas os IDs são necessários.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_conflicting_event_ids(p_unit_id UUID)
RETURNS TABLE (event_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT unnest(ARRAY[event_id_a, event_id_b])
  FROM public.get_event_conflicts(p_unit_id);
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.get_event_conflicts(UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conflicting_event_ids(UUID) TO authenticated;
