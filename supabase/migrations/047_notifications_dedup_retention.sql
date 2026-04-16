-- ============================================================
-- Migration 047 — Notificações: dedup diário + retenção automática
--
-- Problema: cron check-alerts roda a cada hora e insere a mesma
-- notificação para os mesmos itens atrasados infinitamente.
-- Resultado: 507 notificações, 489 duplicatas (~96/dia).
--
-- Solução:
--   1. Limpeza pontual das duplicatas acumuladas
--   2. Unique index parcial (user_id, type, link, dia) para tipos overdue
--   3. RPC create_notification com ON CONFLICT DO NOTHING
--   4. RPC cleanup_old_notifications para retenção de 30 dias
--   5. Índice auxiliar para performance de limpeza
-- ============================================================

-- ── PASSO 1: Limpeza pontual das duplicatas existentes ────────
-- Para cada combinação (user_id, type, link, dia), mantém apenas
-- a notificação mais recente e remove todas as outras.

DELETE FROM public.notifications
WHERE type IN ('maintenance_overdue', 'checklist_overdue')
  AND id NOT IN (
    SELECT DISTINCT ON (user_id, type, link, DATE(created_at)) id
    FROM public.notifications
    WHERE type IN ('maintenance_overdue', 'checklist_overdue')
    ORDER BY user_id, type, link, DATE(created_at), created_at DESC
  );

-- ── PASSO 2: Limpeza inicial de notificações > 30 dias ────────
DELETE FROM public.notifications
WHERE created_at < now() - interval '30 days';

-- ── PASSO 3: Unique index parcial ────────────────────────────
-- Previne duplicatas futuras para tipos gerados por cron.
-- Um (user_id, type, link) por dia — funciona como dedup diário.
-- Somente para tipos 'overdue'; outros tipos sempre inserem normalmente.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_no_daily_dup
  ON public.notifications (user_id, type, link, (DATE(created_at)))
  WHERE type IN ('maintenance_overdue', 'checklist_overdue');

-- ── PASSO 4: Atualizar RPC create_notification ───────────────
-- Mantém assinatura exata idêntica à versão anterior.
-- Adiciona ON CONFLICT DO NOTHING para tipos cobertos pelo index parcial.
-- Para outros tipos (event_tomorrow, checklist_assigned, etc.), sem alteração.

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type    TEXT,
  p_title   TEXT,
  p_body    TEXT,
  p_link    TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- ON CONFLICT só ativa quando o index parcial se aplica
  -- (type IN ('maintenance_overdue', 'checklist_overdue')).
  -- Para todos os outros tipos, INSERT ocorre normalmente.
  INSERT INTO public.notifications (user_id, type, title, body, link, is_read)
  VALUES (p_user_id, p_type, p_title, p_body, p_link, FALSE)
  ON CONFLICT (user_id, type, link, (DATE(created_at)))
    WHERE type IN ('maintenance_overdue', 'checklist_overdue')
  DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;  -- NULL se foi ignorada por dedup (comportamento esperado)
END;
$$;

COMMENT ON FUNCTION public.create_notification IS
  'Cria notificação. Para tipos overdue (maintenance_overdue, checklist_overdue), '
  'usa ON CONFLICT DO NOTHING para garantir no máximo 1 por (user, type, link) por dia. '
  'Para demais tipos sempre insere.';

-- ── PASSO 5: RPC de retenção ──────────────────────────────────
-- Chamada pelo cron check-alerts ao final de cada execução.
-- Remove notificações mais antigas que p_days dias.

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications(p_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_notifications IS
  'Remove notificações mais antigas que p_days dias. Retorna o número de linhas deletadas.';

-- ── PASSO 6: Índice auxiliar para performance de retenção ─────
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON public.notifications (created_at);
