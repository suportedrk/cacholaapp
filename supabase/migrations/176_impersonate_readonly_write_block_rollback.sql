-- ============================================================
-- ROLLBACK da Migration 176 — remove as policies restritivas de read-only
-- ============================================================
-- Remove apenas as policies ADICIONADAS pela 176 (as permissivas originais ficam intactas,
-- pois nunca foram tocadas). Idempotente. Sem BEGIN/COMMIT nem NOTIFY pgrst.
-- ============================================================

DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'central_servicos_avisos_leitura',
    'checklist_item_comments',
    'commercial_task_completions',
    'notifications',
    'ploomes_config',
    'pre_reservas_diretoria',
    'recompra_contact_log',
    'unit_settings',
    'upsell_contact_log',
    'users',
    'units',
    'role_permissions',
    'role_default_perms',
    'role_template_audit',
    'audit_logs',
    'ploomes_sync_log'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('DROP POLICY IF EXISTS impersonation_readonly_block_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS impersonation_readonly_block_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS impersonation_readonly_block_delete ON public.%I', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS impersonation_readonly_block_insert ON storage.objects;
DROP POLICY IF EXISTS impersonation_readonly_block_update ON storage.objects;
DROP POLICY IF EXISTS impersonation_readonly_block_delete ON storage.objects;
