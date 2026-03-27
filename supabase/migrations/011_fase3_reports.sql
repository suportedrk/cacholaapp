-- =============================================================
-- MIGRATION 011 — Fase 3: Relatórios + Indexes de Performance
-- =============================================================
-- Criado em: 2026-03-27
-- Blocos cobertos: Fase 3 Bloco 1 (RPCs) + Bloco 5 (Indexes)
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- INDEXES DE PERFORMANCE (Bloco 5, antecipados)
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_events_unit_date
  ON public.events(unit_id, date);

CREATE INDEX IF NOT EXISTS idx_events_status
  ON public.events(status);

CREATE INDEX IF NOT EXISTS idx_maintenance_unit_status
  ON public.maintenance_orders(unit_id, status);

CREATE INDEX IF NOT EXISTS idx_maintenance_due_date
  ON public.maintenance_orders(due_date);

CREATE INDEX IF NOT EXISTS idx_checklists_unit_status
  ON public.checklists(unit_id, status);

CREATE INDEX IF NOT EXISTS idx_checklists_due_date
  ON public.checklists(due_date);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_module
  ON public.audit_logs(module);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications(user_id, is_read);

-- ─────────────────────────────────────────────────────────────
-- FUNÇÕES RPC — RELATÓRIO DE EVENTOS
-- ─────────────────────────────────────────────────────────────

-- Resumo geral de eventos
CREATE OR REPLACE FUNCTION report_events_summary(
  p_unit_id UUID    DEFAULT NULL,
  p_from    DATE    DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_to      DATE    DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_events    BIGINT,
  avg_guests      NUMERIC,
  top_event_type  TEXT,
  top_venue       TEXT
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      e.id,
      e.guest_count,
      et.name AS type_name,
      v.name  AS venue_name
    FROM events e
    LEFT JOIN event_types et ON e.event_type_id = et.id
    LEFT JOIN venues       v  ON e.venue_id      = v.id
    WHERE e.date BETWEEN p_from AND p_to
      AND (p_unit_id IS NULL OR e.unit_id = p_unit_id)
  )
  SELECT
    COUNT(*)::BIGINT                    AS total_events,
    ROUND(AVG(guest_count), 1)          AS avg_guests,
    (
      SELECT type_name FROM base
      WHERE type_name IS NOT NULL
      GROUP BY type_name ORDER BY COUNT(*) DESC LIMIT 1
    )                                   AS top_event_type,
    (
      SELECT venue_name FROM base
      WHERE venue_name IS NOT NULL
      GROUP BY venue_name ORDER BY COUNT(*) DESC LIMIT 1
    )                                   AS top_venue
  FROM base;
$$;

-- Eventos por mês e status
CREATE OR REPLACE FUNCTION report_events_by_month(
  p_unit_id UUID    DEFAULT NULL,
  p_from    DATE    DEFAULT (CURRENT_DATE - INTERVAL '365 days')::DATE,
  p_to      DATE    DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  month  TEXT,
  status TEXT,
  count  BIGINT
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    TO_CHAR(date, 'YYYY-MM') AS month,
    status::TEXT,
    COUNT(*)::BIGINT
  FROM events
  WHERE date BETWEEN p_from AND p_to
    AND (p_unit_id IS NULL OR unit_id = p_unit_id)
  GROUP BY month, status
  ORDER BY month, status;
$$;

-- Eventos por tipo
CREATE OR REPLACE FUNCTION report_events_by_type(
  p_unit_id UUID    DEFAULT NULL,
  p_from    DATE    DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_to      DATE    DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  type_name TEXT,
  count     BIGINT
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(et.name, 'Sem tipo') AS type_name,
    COUNT(*)::BIGINT
  FROM events e
  LEFT JOIN event_types et ON e.event_type_id = et.id
  WHERE e.date BETWEEN p_from AND p_to
    AND (p_unit_id IS NULL OR e.unit_id = p_unit_id)
  GROUP BY type_name
  ORDER BY count DESC;
$$;

-- Eventos por salão
CREATE OR REPLACE FUNCTION report_events_by_venue(
  p_unit_id UUID    DEFAULT NULL,
  p_from    DATE    DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_to      DATE    DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  venue_name TEXT,
  count      BIGINT
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(v.name, 'Sem salão') AS venue_name,
    COUNT(*)::BIGINT
  FROM events e
  LEFT JOIN venues v ON e.venue_id = v.id
  WHERE e.date BETWEEN p_from AND p_to
    AND (p_unit_id IS NULL OR e.unit_id = p_unit_id)
  GROUP BY venue_name
  ORDER BY count DESC;
$$;

-- ─────────────────────────────────────────────────────────────
-- FUNÇÕES RPC — RELATÓRIO DE MANUTENÇÃO
-- ─────────────────────────────────────────────────────────────

-- Resumo geral de manutenções
CREATE OR REPLACE FUNCTION report_maintenance_summary(
  p_unit_id UUID    DEFAULT NULL,
  p_from    DATE    DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_to      DATE    DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_open            BIGINT,
  total_completed       BIGINT,
  avg_resolution_days   NUMERIC,
  top_sector            TEXT
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      mo.id,
      mo.status,
      mo.created_at,
      mo.updated_at,
      s.name AS sector_name
    FROM maintenance_orders mo
    LEFT JOIN sectors s ON mo.sector_id = s.id
    WHERE mo.created_at::DATE BETWEEN p_from AND p_to
      AND (p_unit_id IS NULL OR mo.unit_id = p_unit_id)
  )
  SELECT
    COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled'))::BIGINT AS total_open,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT                    AS total_completed,
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400.0
      ) FILTER (WHERE status = 'completed'),
      1
    )                                                                        AS avg_resolution_days,
    (
      SELECT sector_name FROM base
      WHERE sector_name IS NOT NULL
      GROUP BY sector_name ORDER BY COUNT(*) DESC LIMIT 1
    )                                                                        AS top_sector
  FROM base;
$$;

-- Manutenções abertas vs concluídas por mês
CREATE OR REPLACE FUNCTION report_maintenance_by_month(
  p_unit_id UUID    DEFAULT NULL,
  p_from    DATE    DEFAULT (CURRENT_DATE - INTERVAL '365 days')::DATE,
  p_to      DATE    DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  month           TEXT,
  open_count      BIGINT,
  completed_count BIGINT
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    TO_CHAR(created_at, 'YYYY-MM') AS month,
    COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled'))::BIGINT AS open_count,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT                    AS completed_count
  FROM maintenance_orders
  WHERE created_at::DATE BETWEEN p_from AND p_to
    AND (p_unit_id IS NULL OR unit_id = p_unit_id)
  GROUP BY month
  ORDER BY month;
$$;

-- Manutenções por setor
CREATE OR REPLACE FUNCTION report_maintenance_by_sector(
  p_unit_id UUID    DEFAULT NULL,
  p_from    DATE    DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_to      DATE    DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  sector_name TEXT,
  count       BIGINT
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(s.name, 'Sem setor') AS sector_name,
    COUNT(*)::BIGINT
  FROM maintenance_orders mo
  LEFT JOIN sectors s ON mo.sector_id = s.id
  WHERE mo.created_at::DATE BETWEEN p_from AND p_to
    AND (p_unit_id IS NULL OR mo.unit_id = p_unit_id)
  GROUP BY sector_name
  ORDER BY count DESC;
$$;

-- ─────────────────────────────────────────────────────────────
-- FUNÇÕES RPC — RELATÓRIO DE CHECKLISTS
-- ─────────────────────────────────────────────────────────────

-- Resumo geral de checklists
CREATE OR REPLACE FUNCTION report_checklists_summary(
  p_unit_id UUID    DEFAULT NULL,
  p_from    DATE    DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_to      DATE    DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total               BIGINT,
  on_time_count       BIGINT,
  overdue_count       BIGINT,
  top_overdue_cat     TEXT
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      c.id,
      c.status,
      c.due_date,
      c.updated_at,
      cc.name AS cat_name
    FROM checklists c
    LEFT JOIN checklist_templates ct ON c.template_id  = ct.id
    LEFT JOIN checklist_categories cc ON ct.category_id = cc.id
    WHERE c.created_at::DATE BETWEEN p_from AND p_to
      AND (p_unit_id IS NULL OR c.unit_id = p_unit_id)
  )
  SELECT
    COUNT(*)::BIGINT AS total,
    COUNT(*) FILTER (
      WHERE status = 'completed'
        AND (due_date IS NULL OR updated_at <= due_date)
    )::BIGINT                                              AS on_time_count,
    COUNT(*) FILTER (
      WHERE status NOT IN ('completed','cancelled')
        AND due_date IS NOT NULL AND due_date < NOW()
    )::BIGINT                                              AS overdue_count,
    (
      SELECT cat_name FROM base
      WHERE cat_name IS NOT NULL
        AND status NOT IN ('completed','cancelled')
        AND due_date IS NOT NULL AND due_date < NOW()
      GROUP BY cat_name ORDER BY COUNT(*) DESC LIMIT 1
    )                                                      AS top_overdue_cat
  FROM base;
$$;

-- Checklists concluídos vs atrasados por mês
CREATE OR REPLACE FUNCTION report_checklists_by_month(
  p_unit_id UUID    DEFAULT NULL,
  p_from    DATE    DEFAULT (CURRENT_DATE - INTERVAL '365 days')::DATE,
  p_to      DATE    DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  month           TEXT,
  completed_count BIGINT,
  overdue_count   BIGINT
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    TO_CHAR(created_at, 'YYYY-MM') AS month,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT AS completed_count,
    COUNT(*) FILTER (
      WHERE status NOT IN ('completed','cancelled')
        AND due_date IS NOT NULL AND due_date < NOW()
    )::BIGINT                                            AS overdue_count
  FROM checklists
  WHERE created_at::DATE BETWEEN p_from AND p_to
    AND (p_unit_id IS NULL OR unit_id = p_unit_id)
  GROUP BY month
  ORDER BY month;
$$;

-- Checklists por categoria
CREATE OR REPLACE FUNCTION report_checklists_by_category(
  p_unit_id UUID    DEFAULT NULL,
  p_from    DATE    DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_to      DATE    DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  category_name TEXT,
  total_count   BIGINT,
  overdue_count BIGINT
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(cc.name, 'Sem categoria') AS category_name,
    COUNT(*)::BIGINT                   AS total_count,
    COUNT(*) FILTER (
      WHERE c.status NOT IN ('completed','cancelled')
        AND c.due_date IS NOT NULL AND c.due_date < NOW()
    )::BIGINT                          AS overdue_count
  FROM checklists c
  LEFT JOIN checklist_templates   ct ON c.template_id  = ct.id
  LEFT JOIN checklist_categories  cc ON ct.category_id = cc.id
  WHERE c.created_at::DATE BETWEEN p_from AND p_to
    AND (p_unit_id IS NULL OR c.unit_id = p_unit_id)
  GROUP BY category_name
  ORDER BY total_count DESC;
$$;

-- ─────────────────────────────────────────────────────────────
-- FUNÇÕES RPC — RELATÓRIO DE EQUIPE
-- ─────────────────────────────────────────────────────────────

-- Eventos por colaborador
CREATE OR REPLACE FUNCTION report_staff_by_events(
  p_unit_id UUID    DEFAULT NULL,
  p_from    DATE    DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_to      DATE    DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  user_id     UUID,
  user_name   TEXT,
  events_count BIGINT
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    u.id           AS user_id,
    u.name         AS user_name,
    COUNT(es.id)::BIGINT AS events_count
  FROM users u
  JOIN event_staff es ON es.user_id = u.id
  JOIN events      e  ON e.id = es.event_id
  WHERE e.date BETWEEN p_from AND p_to
    AND (p_unit_id IS NULL OR e.unit_id = p_unit_id)
    AND u.is_active = TRUE
  GROUP BY u.id, u.name
  ORDER BY events_count DESC
  LIMIT 20;
$$;

-- Checklists por colaborador
CREATE OR REPLACE FUNCTION report_staff_by_checklists(
  p_unit_id UUID    DEFAULT NULL,
  p_from    DATE    DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_to      DATE    DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  user_id              UUID,
  user_name            TEXT,
  checklists_completed BIGINT,
  checklists_overdue   BIGINT,
  maintenance_count    BIGINT
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    u.id AS user_id,
    u.name AS user_name,
    COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'completed')::BIGINT   AS checklists_completed,
    COUNT(DISTINCT c.id) FILTER (
      WHERE c.status NOT IN ('completed','cancelled')
        AND c.due_date IS NOT NULL AND c.due_date < NOW()
    )::BIGINT                                                              AS checklists_overdue,
    COUNT(DISTINCT mo.id)::BIGINT                                          AS maintenance_count
  FROM users u
  LEFT JOIN checklists c ON c.assigned_to = u.id
    AND c.created_at::DATE BETWEEN p_from AND p_to
    AND (p_unit_id IS NULL OR c.unit_id = p_unit_id)
  LEFT JOIN maintenance_orders mo ON mo.assigned_to = u.id
    AND mo.created_at::DATE BETWEEN p_from AND p_to
    AND (p_unit_id IS NULL OR mo.unit_id = p_unit_id)
  WHERE u.is_active = TRUE
    AND (c.id IS NOT NULL OR mo.id IS NOT NULL)
  GROUP BY u.id, u.name
  ORDER BY checklists_completed DESC
  LIMIT 20;
$$;

-- Resumo de equipe
CREATE OR REPLACE FUNCTION report_staff_summary(
  p_unit_id UUID    DEFAULT NULL,
  p_from    DATE    DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_to      DATE    DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  top_events_user      TEXT,
  top_checklists_user  TEXT,
  avg_events_per_user  NUMERIC
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  WITH ev AS (
    SELECT u.name, COUNT(es.id) AS cnt
    FROM users u
    JOIN event_staff es ON es.user_id = u.id
    JOIN events e ON e.id = es.event_id
      AND e.date BETWEEN p_from AND p_to
      AND (p_unit_id IS NULL OR e.unit_id = p_unit_id)
    WHERE u.is_active = TRUE
    GROUP BY u.id, u.name
  ),
  ch AS (
    SELECT u.name, COUNT(c.id) AS cnt
    FROM users u
    JOIN checklists c ON c.assigned_to = u.id
      AND c.status = 'completed'
      AND c.created_at::DATE BETWEEN p_from AND p_to
      AND (p_unit_id IS NULL OR c.unit_id = p_unit_id)
    WHERE u.is_active = TRUE
    GROUP BY u.id, u.name
  )
  SELECT
    (SELECT name FROM ev ORDER BY cnt DESC LIMIT 1) AS top_events_user,
    (SELECT name FROM ch ORDER BY cnt DESC LIMIT 1) AS top_checklists_user,
    ROUND((SELECT AVG(cnt) FROM ev), 1)             AS avg_events_per_user;
$$;

-- ─────────────────────────────────────────────────────────────
-- GRANTS (permitir execução por usuários autenticados)
-- ─────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION report_events_summary        TO authenticated;
GRANT EXECUTE ON FUNCTION report_events_by_month       TO authenticated;
GRANT EXECUTE ON FUNCTION report_events_by_type        TO authenticated;
GRANT EXECUTE ON FUNCTION report_events_by_venue       TO authenticated;
GRANT EXECUTE ON FUNCTION report_maintenance_summary   TO authenticated;
GRANT EXECUTE ON FUNCTION report_maintenance_by_month  TO authenticated;
GRANT EXECUTE ON FUNCTION report_maintenance_by_sector TO authenticated;
GRANT EXECUTE ON FUNCTION report_checklists_summary    TO authenticated;
GRANT EXECUTE ON FUNCTION report_checklists_by_month   TO authenticated;
GRANT EXECUTE ON FUNCTION report_checklists_by_category TO authenticated;
GRANT EXECUTE ON FUNCTION report_staff_by_events       TO authenticated;
GRANT EXECUTE ON FUNCTION report_staff_by_checklists   TO authenticated;
GRANT EXECUTE ON FUNCTION report_staff_summary         TO authenticated;
