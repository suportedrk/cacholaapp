-- ============================================================
-- Migration 032: Migrar dados legacy de manutencao para o
--                schema 031 e remover tabelas obsoletas
-- ============================================================
-- Mapeamentos:
--   sectors (8 linhas)            → maintenance_sectors
--   maintenance_orders (2 linhas) → maintenance_tickets
--   maintenance_orders.assigned_to → maintenance_executions
--   maintenance_costs (1 linha)   → maintenance_executions.cost (absorvido)
--   maintenance_photos (3 linhas) → maintenance_ticket_photos
--   maintenance_suppliers (vazia) → DROP
--   supplier_contacts (vazia)     → DROP
--   supplier_documents (vazia)    → DROP
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- 1. sectors → maintenance_sectors (preservando UUIDs)
--    Nota: sectors nao tem updated_at; usa created_at como fallback
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.maintenance_sectors (
  id, unit_id, name, description, is_active, sort_order, created_at, updated_at
)
SELECT
  id,
  unit_id,
  name,
  NULL,           -- description: nao existia em sectors
  is_active,
  sort_order,
  created_at,
  created_at      -- updated_at: fallback para created_at
FROM public.sectors
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 2. maintenance_orders → maintenance_tickets
-- Mapeamentos:
--   type:   punctual→pontual, emergency→emergencial,
--           recurring→agendado, preventive→preventivo
--   priority → urgency  (valores identicos: low/medium/high/critical)
--   status: waiting_parts→waiting_part, completed→concluded
--   due_date → due_at
--   created_by → opened_by
--   sector_id: mesmo UUID, agora FK → maintenance_sectors
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.maintenance_tickets (
  id, unit_id, title, description,
  sector_id, category_id, item_id,
  nature, urgency, status,
  scheduled_date, concluded_at, due_at,
  opened_by, total_cost,
  created_at, updated_at
)
SELECT
  mo.id,
  mo.unit_id,
  mo.title,
  mo.description,
  mo.sector_id,
  NULL,
  NULL,
  CASE mo.type
    WHEN 'punctual'   THEN 'pontual'
    WHEN 'emergency'  THEN 'emergencial'
    WHEN 'recurring'  THEN 'agendado'
    WHEN 'preventive' THEN 'preventivo'
    ELSE 'pontual'
  END,
  mo.priority,
  CASE mo.status
    WHEN 'open'          THEN 'open'
    WHEN 'in_progress'   THEN 'in_progress'
    WHEN 'waiting_parts' THEN 'waiting_part'
    WHEN 'completed'     THEN 'concluded'
    WHEN 'cancelled'     THEN 'cancelled'
    ELSE 'open'
  END,
  NULL,             -- scheduled_date: nao tinha no legacy
  mo.completed_at,
  mo.due_date,      -- due_date → due_at
  mo.created_by,    -- opened_by = quem criou o chamado
  0,                -- sera recalculado pelo trigger apos inserir execucoes
  mo.created_at,
  mo.updated_at
FROM public.maintenance_orders mo
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 3. Criar execucoes para ordens com assigned_to
--    Absorve maintenance_costs na coluna cost da execucao
--    O trigger sync_ticket_total_cost atualiza total_cost automaticamente
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.maintenance_executions (
  ticket_id, executor_type, internal_user_id, provider_id,
  cost, cost_approved, status,
  started_at, concluded_at, created_at, updated_at
)
SELECT
  mo.id,
  'internal',
  mo.assigned_to,
  NULL,
  COALESCE(mc.amount, 0),
  false,
  CASE mo.status
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'completed'   THEN 'concluded'
    ELSE 'assigned'
  END,
  mo.created_at,
  mo.completed_at,
  mo.created_at,
  mo.updated_at
FROM public.maintenance_orders mo
LEFT JOIN public.maintenance_costs mc ON mc.order_id = mo.id
WHERE mo.assigned_to IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- 4. maintenance_photos → maintenance_ticket_photos
--    type (before/after/during) → caption em portugues
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.maintenance_ticket_photos (
  id, ticket_id, url, caption, uploaded_by, created_at
)
SELECT
  mp.id,
  mp.order_id,
  mp.url,
  CASE mp.type
    WHEN 'before' THEN 'Antes'
    WHEN 'after'  THEN 'Depois'
    WHEN 'during' THEN 'Durante'
    ELSE mp.type
  END,
  mp.uploaded_by,
  mp.created_at
FROM public.maintenance_photos mp
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 5. Historico de status inicial para chamados migrados
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.maintenance_status_history (
  ticket_id, from_status, to_status, changed_by, note, created_at
)
SELECT
  mt.id,
  NULL,
  mt.status,
  mt.opened_by,
  'Migrado do sistema legado',
  mt.created_at
FROM public.maintenance_tickets mt
WHERE mt.id IN (SELECT id FROM public.maintenance_orders);

-- ──────────────────────────────────────────────────────────────
-- 6. Verificacao antes do DROP
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_sectors   int;
  v_tickets   int;
  v_execs     int;
  v_photos    int;
BEGIN
  SELECT COUNT(*) INTO v_sectors FROM public.maintenance_sectors;
  SELECT COUNT(*) INTO v_tickets FROM public.maintenance_tickets;
  SELECT COUNT(*) INTO v_execs   FROM public.maintenance_executions;
  SELECT COUNT(*) INTO v_photos  FROM public.maintenance_ticket_photos;

  RAISE NOTICE 'maintenance_sectors: % linhas', v_sectors;
  RAISE NOTICE 'maintenance_tickets: % linhas', v_tickets;
  RAISE NOTICE 'maintenance_executions: % linhas', v_execs;
  RAISE NOTICE 'maintenance_ticket_photos: % linhas', v_photos;

  IF v_sectors < 8 THEN
    RAISE EXCEPTION 'ABORT: maintenance_sectors deveria ter >= 8 linhas, tem %', v_sectors;
  END IF;
  IF v_tickets < 2 THEN
    RAISE EXCEPTION 'ABORT: maintenance_tickets deveria ter >= 2 linhas, tem %', v_tickets;
  END IF;
  IF v_photos < 3 THEN
    RAISE EXCEPTION 'ABORT: maintenance_ticket_photos deveria ter >= 3 linhas, tem %', v_photos;
  END IF;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 7. DROP tabelas legacy (ordem de dependencia)
-- ──────────────────────────────────────────────────────────────

-- 7a. Custos (absorvidos em execucoes)
DROP TABLE IF EXISTS public.maintenance_costs CASCADE;

-- 7b. Fotos legacy (migradas)
DROP TABLE IF EXISTS public.maintenance_photos CASCADE;

-- 7c. Fornecedores legacy e dependentes (todos vazios)
DROP TABLE IF EXISTS public.supplier_documents CASCADE;
DROP TABLE IF EXISTS public.supplier_contacts CASCADE;
DROP TABLE IF EXISTS public.maintenance_suppliers CASCADE;

-- 7d. Ordens legacy (migradas; CASCADE remove indices, policies, triggers)
DROP TABLE IF EXISTS public.maintenance_orders CASCADE;

-- 7e. Setores legacy (migrados; CASCADE remove policies)
DROP TABLE IF EXISTS public.sectors CASCADE;

-- ──────────────────────────────────────────────────────────────
-- 8. Cleanup de funcoes legadas
-- ──────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.update_maintenance_suppliers_updated_at() CASCADE;

COMMIT;
