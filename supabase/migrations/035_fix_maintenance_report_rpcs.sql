-- ──────────────────────────────────────────────────────────────────────────────
-- Migration 035: Recriar RPCs de relatórios de manutenção
-- maintenance_orders (dropada) → maintenance_tickets
-- sectors (dropada)            → maintenance_sectors
-- status 'completed'           → status 'concluded'
-- avg resolução via concluded_at (não updated_at)
-- ──────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.report_maintenance_summary(uuid, date, date);
DROP FUNCTION IF EXISTS public.report_maintenance_by_month(uuid, date, date);
DROP FUNCTION IF EXISTS public.report_maintenance_by_sector(uuid, date, date);

-- ── 1. Sumário geral ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_maintenance_summary(
  p_unit_id uuid DEFAULT NULL,
  p_from    date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_to      date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  total_open           bigint,
  total_completed      bigint,
  avg_resolution_days  numeric,
  top_sector           text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT
      mt.id,
      mt.status,
      mt.created_at,
      mt.concluded_at,
      ms.name AS sector_name
    FROM maintenance_tickets mt
    LEFT JOIN maintenance_sectors ms ON mt.sector_id = ms.id
    WHERE mt.created_at::DATE BETWEEN p_from AND p_to
      AND (p_unit_id IS NULL OR mt.unit_id = p_unit_id)
  )
  SELECT
    COUNT(*) FILTER (WHERE status NOT IN ('concluded','cancelled'))::BIGINT AS total_open,
    COUNT(*) FILTER (WHERE status = 'concluded')::BIGINT                   AS total_completed,
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (concluded_at - created_at)) / 86400.0
      ) FILTER (WHERE status = 'concluded' AND concluded_at IS NOT NULL),
      1
    )                                                                       AS avg_resolution_days,
    (
      SELECT sector_name FROM base
      WHERE sector_name IS NOT NULL
      GROUP BY sector_name ORDER BY COUNT(*) DESC LIMIT 1
    )                                                                       AS top_sector
  FROM base;
$$;

-- ── 2. Por mês ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_maintenance_by_month(
  p_unit_id uuid DEFAULT NULL,
  p_from    date DEFAULT (CURRENT_DATE - INTERVAL '365 days')::date,
  p_to      date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  month           text,
  open_count      bigint,
  completed_count bigint
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  SELECT
    TO_CHAR(created_at, 'YYYY-MM')                                         AS month,
    COUNT(*) FILTER (WHERE status NOT IN ('concluded','cancelled'))::BIGINT AS open_count,
    COUNT(*) FILTER (WHERE status = 'concluded')::BIGINT                   AS completed_count
  FROM maintenance_tickets
  WHERE created_at::DATE BETWEEN p_from AND p_to
    AND (p_unit_id IS NULL OR unit_id = p_unit_id)
  GROUP BY month
  ORDER BY month;
$$;

-- ── 3. Por setor ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_maintenance_by_sector(
  p_unit_id uuid DEFAULT NULL,
  p_from    date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_to      date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  sector_name text,
  count       bigint
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(ms.name, 'Sem setor') AS sector_name,
    COUNT(*)::BIGINT
  FROM maintenance_tickets mt
  LEFT JOIN maintenance_sectors ms ON mt.sector_id = ms.id
  WHERE mt.created_at::DATE BETWEEN p_from AND p_to
    AND (p_unit_id IS NULL OR mt.unit_id = p_unit_id)
  GROUP BY sector_name
  ORDER BY count DESC;
$$;

-- ── Permissões ───────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.report_maintenance_summary(uuid, date, date)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_maintenance_by_month(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_maintenance_by_sector(uuid, date, date) TO authenticated;
