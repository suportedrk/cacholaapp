-- ============================================================
-- ROLLBACK da Migration 171 — remove o trigger anti-escalada em public.users
-- ============================================================
-- Reverte ao estado pré-171. ⚠️ Atenção: remover este trigger REABRE a escalada
-- de privilégio (qualquer logado pode se autopromover via PATCH em users.role).
-- Use só se o trigger causar regressão comprovada em fluxo legítimo de gestão.
-- Idempotente.
-- ============================================================

DROP TRIGGER IF EXISTS trg_users_protect_privileged_columns ON public.users;
DROP FUNCTION IF EXISTS public.protect_users_privileged_columns();
