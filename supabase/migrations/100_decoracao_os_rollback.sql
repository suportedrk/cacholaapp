-- ============================================================
-- Rollback 100 — Módulo Decoração: Ordens de Serviço
-- Desfaz a migration 100_decoracao_os.sql.
-- ============================================================

BEGIN;

DROP FUNCTION IF EXISTS public.update_decoracao_os_with_items(uuid, uuid, date, time, text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.create_decoracao_os_with_items(uuid, date, time, text, uuid, jsonb);

DROP POLICY IF EXISTS "decoracao_os_itens: view"   ON public.decoracao_os_itens;
DROP POLICY IF EXISTS "decoracao_os_itens: create" ON public.decoracao_os_itens;
DROP POLICY IF EXISTS "decoracao_os_itens: edit"   ON public.decoracao_os_itens;
DROP POLICY IF EXISTS "decoracao_os_itens: delete" ON public.decoracao_os_itens;

DROP POLICY IF EXISTS "decoracao_os: view"   ON public.decoracao_os;
DROP POLICY IF EXISTS "decoracao_os: create" ON public.decoracao_os;
DROP POLICY IF EXISTS "decoracao_os: edit"   ON public.decoracao_os;
DROP POLICY IF EXISTS "decoracao_os: delete" ON public.decoracao_os;

DROP TABLE IF EXISTS public.decoracao_os_itens;
DROP TABLE IF EXISTS public.decoracao_os;

NOTIFY pgrst, 'reload schema';

COMMIT;
