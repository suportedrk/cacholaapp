-- ============================================================
-- Migration 176 — Read-only do "Ver como": bloqueio das escritas que escapam do 175
-- ============================================================
-- A migration 175 bloqueia toda escrita gateada por check_permission (a maioria RBAC).
-- Esta fecha as escritas que NAO passam por check_permission e seriam alcancaveis pelo
-- JWT mintado do modo "Ver como" (sub = alvo, claim `impersonator`):
--   - politicas de escrita por DONO/ROLE em tabelas public (comentarios de checklist,
--     logs de upsell/recompra, notificacoes proprias, pre-reservas, unit_settings,
--     ploomes_config, commercial_task_completions, central_servicos_avisos_leitura,
--     users self-update);
--   - TODA escrita em storage.objects (uploads/updates/deletes de qualquer bucket).
--
-- ESTRATEGIA — politicas RESTRICTIVE (AND-combinadas com as permissivas existentes):
--   nao reescrevemos nenhuma policy existente (zero risco de drift de corpo). Apenas
--   ADICIONAMOS, por comando de escrita, uma policy restritiva cujo predicado e
--   `NOT public.is_impersonating()`. Em sessao normal (sem o claim) -> NOT false = true ->
--   nenhum efeito. Sob "Ver como" -> NOT true = false -> a escrita e barrada,
--   independentemente das policies permissivas. SELECT NAO recebe policy restritiva ->
--   leituras intactas. service_role/owner (BYPASSRLS) nao sao afetados e nunca carregam
--   o claim.
--
-- NO-OP ate o token mintado existir. Idempotente (DROP POLICY IF EXISTS antes de criar).
-- Sem BEGIN/COMMIT nem NOTIFY pgrst (a esteira cuida).
--
-- NOTA: as RPCs SECURITY DEFINER que gravam e furam RLS sao tratadas a parte (176b):
-- a maioria tem os chamadores ja bloqueados (a mutacao-pai e barrada antes), restando
-- so 2 standalone de baixo impacto (set_my_action_item_status, mark_all_notifications_read).
-- ============================================================

-- 1) Tabelas public com escrita por dono/role fora do check_permission.
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    -- escritas por dono/role fora do check_permission (alcançáveis pelo token mintado)
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
    -- defense-in-depth: escritas gateadas por super_admin inline (só alcançáveis se o
    -- alvo fosse super_admin — o endpoint de minta proíbe isso, esta é a 2a camada)
    'units',
    'role_permissions',
    'role_default_perms',
    'role_template_audit',
    -- logs append-only (WITH CHECK true): evita poluição sob impersonation
    'audit_logs',
    'ploomes_sync_log'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    -- INSERT
    EXECUTE format('DROP POLICY IF EXISTS impersonation_readonly_block_insert ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY impersonation_readonly_block_insert ON public.%I AS RESTRICTIVE FOR INSERT TO public WITH CHECK (NOT public.is_impersonating())', t);
    -- UPDATE
    EXECUTE format('DROP POLICY IF EXISTS impersonation_readonly_block_update ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY impersonation_readonly_block_update ON public.%I AS RESTRICTIVE FOR UPDATE TO public USING (NOT public.is_impersonating()) WITH CHECK (NOT public.is_impersonating())', t);
    -- DELETE
    EXECUTE format('DROP POLICY IF EXISTS impersonation_readonly_block_delete ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY impersonation_readonly_block_delete ON public.%I AS RESTRICTIVE FOR DELETE TO public USING (NOT public.is_impersonating())', t);
  END LOOP;
END $$;

-- 2) storage.objects — bloqueia TODA escrita (qualquer bucket) sob "Ver como".
--    Cobre de uma vez provider-documents, checklist-photos, equipment-photos,
--    maintenance-*, supplier-documents, user-avatars, decoracao, central-servicos.
DROP POLICY IF EXISTS impersonation_readonly_block_insert ON storage.objects;
CREATE POLICY impersonation_readonly_block_insert ON storage.objects
  AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (NOT public.is_impersonating());

DROP POLICY IF EXISTS impersonation_readonly_block_update ON storage.objects;
CREATE POLICY impersonation_readonly_block_update ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO public
  USING (NOT public.is_impersonating())
  WITH CHECK (NOT public.is_impersonating());

DROP POLICY IF EXISTS impersonation_readonly_block_delete ON storage.objects;
CREATE POLICY impersonation_readonly_block_delete ON storage.objects
  AS RESTRICTIVE FOR DELETE TO public
  USING (NOT public.is_impersonating());
