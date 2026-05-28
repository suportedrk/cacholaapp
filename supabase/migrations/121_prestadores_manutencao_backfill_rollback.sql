-- ============================================================
-- Rollback da Migration 121 — Remove backfill manutencao/prestadores/view
-- ATENÇÃO: reverte o grant concedido pela 121. Executar APENAS se
-- a 121 foi aplicada por engano e nenhum usuário dependia do acesso.
-- ============================================================

BEGIN;

DELETE FROM public.user_permissions
WHERE module  = 'prestadores'
  AND action  = 'view'
  AND granted = true
  AND user_id IN (
    SELECT id FROM public.users WHERE role = 'manutencao'
  );

RAISE NOTICE 'Rollback 121 concluído: grants prestadores/view de manutencao removidos.';

NOTIFY pgrst, 'reload schema';

COMMIT;
