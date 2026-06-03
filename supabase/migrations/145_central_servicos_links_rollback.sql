-- ============================================================
-- Rollback da Migration 145 — Central de Serviços: Links úteis
-- Remove a tabela central_servicos_links (e suas policies/trigger via CASCADE).
-- NÃO toca no módulo RBAC 'central_servicos' (criado no Bloco A / migration 144).
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS public.central_servicos_links CASCADE;

NOTIFY pgrst, 'reload schema';

COMMIT;
