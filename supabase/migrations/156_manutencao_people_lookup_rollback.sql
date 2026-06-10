-- supabase/migrations/156_manutencao_people_lookup_rollback.sql
-- Rollback da migration 156 — remove a RPC de exibição get_maintenance_people.
-- Sem alteração de RLS para reverter; nada além da função foi criado.

BEGIN;

DROP FUNCTION IF EXISTS public.get_maintenance_people(uuid);

COMMIT;
