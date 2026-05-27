-- ============================================================
-- Smoke test do helper plpgsql public.check_permission_or_raise(module, action)
-- introduzido pela Migration 120 (Fase 3 — Etapa 0).
--
-- Executar localmente após aplicar a 120:
--   docker exec -i cacholaos-db psql -U postgres -d postgres \
--     < scripts/smoke/check-permission-or-raise.sql
--
-- O script cobre 3 cenários:
--   (1) super_admin → passa (bypass dentro da check_permission)
--   (2) usuário com a permissão granted → passa
--   (3) usuário sem a permissão → RAISE EXCEPTION 'insufficient_privilege' (ERRCODE 42501)
--
-- Pré-requisitos:
--   - 1 usuário super_admin local (id: 5e3ffc23-90de-4e76-b97f-c4b18c99c997 do seed)
--   - 1 usuário diretor local (id: 6920ff15-8bc3-4b2a-9ddc-085a3aaa340f do seed)
--   - 1 usuário manutencao local (id: 94089b89-2cd0-4474-bc2c-b039786dab45 do seed)
--   - A função check_permission_or_raise existente (Migration 120 aplicada).
-- ============================================================

\set ON_ERROR_STOP off
\pset format aligned

\echo === CENÁRIO 1: super_admin deveria passar (bypass) ===
BEGIN;
SET LOCAL request.jwt.claim.sub TO '5e3ffc23-90de-4e76-b97f-c4b18c99c997';
SET LOCAL ROLE authenticated;
SELECT public.check_permission_or_raise('eventos', 'view') AS super_admin_view;
SELECT public.check_permission_or_raise('eventos', 'delete') AS super_admin_delete;
SELECT public.check_permission_or_raise('manutencao', 'view') AS super_admin_manut;
ROLLBACK;

\echo === CENÁRIO 2: diretor com eventos.view granted deveria passar ===
BEGIN;
SET LOCAL request.jwt.claim.sub TO '6920ff15-8bc3-4b2a-9ddc-085a3aaa340f';
SET LOCAL ROLE authenticated;
SELECT public.check_permission_or_raise('eventos', 'view') AS diretor_view;
ROLLBACK;

\echo === CENÁRIO 3: manutencao SEM eventos.view deveria FALHAR (42501) ===
BEGIN;
SET LOCAL request.jwt.claim.sub TO '94089b89-2cd0-4474-bc2c-b039786dab45';
SET LOCAL ROLE authenticated;
SELECT public.check_permission_or_raise('eventos', 'view');
ROLLBACK;

\echo === CENÁRIO 4: sem sessão (sem JWT) deveria FALHAR ===
BEGIN;
RESET request.jwt.claim.sub;
SET LOCAL ROLE authenticated;
SELECT public.check_permission_or_raise('eventos', 'view');
ROLLBACK;

\echo === FIM do smoke. Esperado: cenários 1-2 SUCCESS, 3-4 RAISE insufficient_privilege. ===
