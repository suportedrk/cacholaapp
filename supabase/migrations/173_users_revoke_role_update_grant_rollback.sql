-- ============================================================
-- ROLLBACK da Migration 173 — restaura o UPDATE table-level em public.users
-- ============================================================
-- Reverte ao estado pré-173: `authenticated` volta a ter UPDATE em todas as
-- colunas de public.users (inclusive `role`).
--
-- ⚠️ Atenção: isto REABRE a gravação de `role` no nível de GRANT. A escalada de
-- privilégio em si continua bloqueada pelo trigger da mig 171
-- (protect_users_privileged_columns), mas a camada extra de GRANT é perdida.
-- Use só se o REVOKE causar regressão comprovada em fluxo legítimo.
--
-- O GRANT table-level abrange todas as colunas e supersede os grants de coluna
-- da mig 173 (que ficam inertes). Idempotente.
-- ============================================================

GRANT UPDATE ON public.users TO authenticated;
