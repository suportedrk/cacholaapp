-- =============================================================
-- Migration 049 — RPC get_pre_reserva_conflicts
-- Detecta conflitos de horário entre pré-reservas (Diretoria e
-- Ploomes) e eventos confirmados — server-side, sem limitação
-- de paginação client-side.
--
-- Retorna uma linha por par conflitante (PR × Evento ou PR × PR).
-- gap_minutes < 0  → sobreposição direta
-- 0 <= gap_minutes < 120 → intervalo menor que 2h
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_pre_reserva_conflicts(p_unit_id UUID)
RETURNS TABLE (
  pr_id              TEXT,     -- ID da pré-reserva (UUID::text ou ploomes_deal_id::text)
  pr_source          TEXT,     -- 'diretoria' | 'ploomes'
  conflict_with_id   TEXT,     -- ID do item conflitante (event UUID::text ou PR id::text)
  conflict_with_type TEXT,     -- 'event' | 'pre_reserva'
  conflict_date      DATE,
  gap_minutes        INTEGER   -- negativo = sobreposição; 0..119 = intervalo < 2h
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$

-- ── 1. PR Diretoria × Evento Confirmado ──────────────────────
SELECT
  d.id::TEXT                AS pr_id,
  'diretoria'               AS pr_source,
  e.id::TEXT                AS conflict_with_id,
  'event'                   AS conflict_with_type,
  d.date                    AS conflict_date,
  (EXTRACT(EPOCH FROM (
    GREATEST(d.start_time, e.start_time) - LEAST(d.end_time, e.end_time)
  )) / 60)::INTEGER         AS gap_minutes
FROM pre_reservas_diretoria d
JOIN events e
  ON  e.date    = d.date
  AND e.unit_id = d.unit_id
WHERE d.unit_id = p_unit_id
  AND e.status  = 'confirmed'
  AND d.start_time IS NOT NULL AND d.end_time IS NOT NULL
  AND e.start_time IS NOT NULL AND e.end_time IS NOT NULL
  AND EXTRACT(EPOCH FROM (
    GREATEST(d.start_time, e.start_time) - LEAST(d.end_time, e.end_time)
  )) / 60 < 120

UNION ALL

-- ── 2. PR Ploomes × Evento Confirmado ────────────────────────
SELECT
  pd.ploomes_deal_id::TEXT  AS pr_id,
  'ploomes'                 AS pr_source,
  e.id::TEXT                AS conflict_with_id,
  'event'                   AS conflict_with_type,
  pd.event_date             AS conflict_date,
  (EXTRACT(EPOCH FROM (
    GREATEST(pd.start_time, e.start_time) - LEAST(pd.end_time, e.end_time)
  )) / 60)::INTEGER         AS gap_minutes
FROM ploomes_deals pd
JOIN events e
  ON  e.date    = pd.event_date
  AND e.unit_id = pd.unit_id
WHERE pd.unit_id  = p_unit_id
  AND pd.status_id = 1
  AND pd.stage_id  IN (60004416, 60056754)
  AND pd.event_date IS NOT NULL
  AND e.status  = 'confirmed'
  AND pd.start_time IS NOT NULL AND pd.end_time IS NOT NULL
  AND e.start_time  IS NOT NULL AND e.end_time  IS NOT NULL
  AND EXTRACT(EPOCH FROM (
    GREATEST(pd.start_time, e.start_time) - LEAST(pd.end_time, e.end_time)
  )) / 60 < 120

UNION ALL

-- ── 3. PR Diretoria × PR Ploomes ─────────────────────────────
SELECT
  d.id::TEXT                AS pr_id,
  'diretoria'               AS pr_source,
  pd.ploomes_deal_id::TEXT  AS conflict_with_id,
  'pre_reserva'             AS conflict_with_type,
  d.date                    AS conflict_date,
  (EXTRACT(EPOCH FROM (
    GREATEST(d.start_time, pd.start_time) - LEAST(d.end_time, pd.end_time)
  )) / 60)::INTEGER         AS gap_minutes
FROM pre_reservas_diretoria d
JOIN ploomes_deals pd
  ON  pd.event_date = d.date
  AND pd.unit_id    = d.unit_id
WHERE d.unit_id   = p_unit_id
  AND pd.status_id = 1
  AND pd.stage_id  IN (60004416, 60056754)
  AND pd.event_date IS NOT NULL
  AND d.start_time  IS NOT NULL AND d.end_time  IS NOT NULL
  AND pd.start_time IS NOT NULL AND pd.end_time IS NOT NULL
  AND EXTRACT(EPOCH FROM (
    GREATEST(d.start_time, pd.start_time) - LEAST(d.end_time, pd.end_time)
  )) / 60 < 120

UNION ALL

-- ── 4. PR Ploomes × PR Ploomes (pares distintos) ─────────────
SELECT
  a.ploomes_deal_id::TEXT   AS pr_id,
  'ploomes'                 AS pr_source,
  b.ploomes_deal_id::TEXT   AS conflict_with_id,
  'pre_reserva'             AS conflict_with_type,
  a.event_date              AS conflict_date,
  (EXTRACT(EPOCH FROM (
    GREATEST(a.start_time, b.start_time) - LEAST(a.end_time, b.end_time)
  )) / 60)::INTEGER         AS gap_minutes
FROM ploomes_deals a
JOIN ploomes_deals b
  ON  b.event_date       = a.event_date
  AND b.unit_id          = a.unit_id
  AND b.ploomes_deal_id  > a.ploomes_deal_id   -- evita duplicatas
WHERE a.unit_id   = p_unit_id
  AND a.status_id = 1 AND a.stage_id IN (60004416, 60056754) AND a.event_date IS NOT NULL
  AND b.status_id = 1 AND b.stage_id IN (60004416, 60056754) AND b.event_date IS NOT NULL
  AND a.start_time IS NOT NULL AND a.end_time IS NOT NULL
  AND b.start_time IS NOT NULL AND b.end_time IS NOT NULL
  AND EXTRACT(EPOCH FROM (
    GREATEST(a.start_time, b.start_time) - LEAST(a.end_time, b.end_time)
  )) / 60 < 120
$$;

COMMENT ON FUNCTION public.get_pre_reserva_conflicts(UUID) IS
  'Detecta conflitos de horário entre pré-reservas (Diretoria e Ploomes) e eventos confirmados (e entre pré-reservas entre si) para uma unidade. gap_minutes < 0 = sobreposição; 0..119 = intervalo < 2h.';

-- Permissão para usuários autenticados chamarem a função
GRANT EXECUTE ON FUNCTION public.get_pre_reserva_conflicts(UUID) TO authenticated;
