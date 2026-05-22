-- ============================================================
-- Migration 094: Alinhamento de RLS do modulo de Manutencao (Fase 3)
-- ============================================================
-- Objetivo: fechar a "porta dos fundos" das 8 tabelas criadas na
-- migration 031. Hoje suas policies so checam membership de unidade
-- (unit_id = ANY(get_user_unit_ids())) e NAO chamam check_permission()
-- nem is_global_viewer(). Consequencia: qualquer role com membership
-- em user_units daquela unidade (freelancer, decoracao, vendedora...)
-- pode fazer CRUD de chamados via PostgREST direto, mesmo sem estar
-- em MAINTENANCE_MODULE_ROLES. O guard de layout protege a UI, nao a API.
--
-- Esta migration alinha as 8 tabelas ao padrao do resto do projeto
-- (eventos, atas, prestadores): role-gate via check_permission()
-- + fallback is_global_viewer() para super_admin/diretor.
--
-- ESCOPO (2 passos):
--   1. Backfill precautorio de user_permissions a partir do template
--      role_default_perms WHERE module='manutencao'. Diagnostico
--      2026-05-21 confirmou 0 usuarios sem permissao hoje; o backfill
--      cobre usuarios criados entre agora e o deploy.
--   2. DROP + CREATE das policies das 8 tabelas da migration 031.
--      maintenance_tickets fica SEM policy de DELETE (delete negado a
--      todos, igual a 031) -- chamado nao tem feature de exclusao na
--      UI e hard-delete destruiria historico/auditoria.
--
-- FORA DE ESCOPO -- nota sobre a "divida F7":
--   A Fase 3.2 do diagnostico previa um passo 3 para atualizar as
--   policies de maintenance_suppliers / supplier_contacts /
--   supplier_documents / maintenance_costs do codigo EN 'maintenance'
--   para PT-BR 'manutencao'. Esse passo foi REMOVIDO: a migration 032
--   (032_maintenance_migrate_legacy.sql, linhas 195-206) ja fez
--   DROP TABLE ... CASCADE dessas 4 tabelas + maintenance_orders.
--   Elas nao existem mais em producao (verificado via pg_class em
--   2026-05-21). A divida F7 foi quitada pela remocao do modulo legado.
--
-- check_permission(p_user_id, p_module, p_action) -- 3 args, ignora
-- unit_id internamente; faz RETURN TRUE para super_admin (bypass).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- PASSO 1 -- Backfill de user_permissions (precautorio)
-- ------------------------------------------------------------
-- Insere as linhas do template do cargo para diretor/gerente/manutencao.
-- super_admin e EXCLUIDO de proposito: check_permission() faz RETURN TRUE
-- para super_admin antes de consultar user_permissions, logo linhas para
-- super_admin sao cosmeticas (regra do CLAUDE.md: "Nao fazer backfill
-- para usuarios super_admin").
-- ON CONFLICT DO NOTHING garante que permissoes individuais ja existentes
-- (ex.: diretores com create/edit/delete customizados alem do template)
-- sao preservadas.
-- unit_id = NULL -> permissao global (padrao 100% de user_permissions).

INSERT INTO public.user_permissions (user_id, module, action, granted, unit_id)
SELECT u.id, rdp.module, rdp.action, rdp.granted, NULL
FROM public.users u
JOIN public.role_default_perms rdp ON rdp.role = u.role
WHERE u.role IN ('diretor', 'gerente', 'manutencao')
  AND rdp.module = 'manutencao'
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

-- ------------------------------------------------------------
-- PASSO 2 -- DROP das policies antigas (idempotente)
-- ------------------------------------------------------------
-- Policies originais da migration 031 (unit-based, sem role-gate):
DROP POLICY IF EXISTS "unit_read_sectors"      ON public.maintenance_sectors;
DROP POLICY IF EXISTS "unit_manage_sectors"    ON public.maintenance_sectors;
DROP POLICY IF EXISTS "unit_read_categories"   ON public.maintenance_categories;
DROP POLICY IF EXISTS "unit_manage_categories" ON public.maintenance_categories;
DROP POLICY IF EXISTS "unit_read_items"        ON public.maintenance_items;
DROP POLICY IF EXISTS "unit_manage_items"      ON public.maintenance_items;
DROP POLICY IF EXISTS "unit_read_sla"          ON public.maintenance_sla;
DROP POLICY IF EXISTS "unit_manage_sla"        ON public.maintenance_sla;
DROP POLICY IF EXISTS "unit_read_tickets"      ON public.maintenance_tickets;
DROP POLICY IF EXISTS "unit_insert_tickets"    ON public.maintenance_tickets;
DROP POLICY IF EXISTS "unit_update_tickets"    ON public.maintenance_tickets;
DROP POLICY IF EXISTS "unit_read_executions"   ON public.maintenance_executions;
DROP POLICY IF EXISTS "unit_manage_executions" ON public.maintenance_executions;
DROP POLICY IF EXISTS "unit_read_photos"       ON public.maintenance_ticket_photos;
DROP POLICY IF EXISTS "unit_manage_photos"     ON public.maintenance_ticket_photos;
DROP POLICY IF EXISTS "unit_read_history"      ON public.maintenance_status_history;

-- Novos nomes (idempotencia em re-execucao da migration):
DROP POLICY IF EXISTS "maintenance_sectors: view"        ON public.maintenance_sectors;
DROP POLICY IF EXISTS "maintenance_sectors: create"      ON public.maintenance_sectors;
DROP POLICY IF EXISTS "maintenance_sectors: edit"        ON public.maintenance_sectors;
DROP POLICY IF EXISTS "maintenance_sectors: delete"      ON public.maintenance_sectors;
DROP POLICY IF EXISTS "maintenance_categories: view"     ON public.maintenance_categories;
DROP POLICY IF EXISTS "maintenance_categories: create"   ON public.maintenance_categories;
DROP POLICY IF EXISTS "maintenance_categories: edit"     ON public.maintenance_categories;
DROP POLICY IF EXISTS "maintenance_categories: delete"   ON public.maintenance_categories;
DROP POLICY IF EXISTS "maintenance_items: view"          ON public.maintenance_items;
DROP POLICY IF EXISTS "maintenance_items: create"        ON public.maintenance_items;
DROP POLICY IF EXISTS "maintenance_items: edit"          ON public.maintenance_items;
DROP POLICY IF EXISTS "maintenance_items: delete"        ON public.maintenance_items;
DROP POLICY IF EXISTS "maintenance_sla: view"            ON public.maintenance_sla;
DROP POLICY IF EXISTS "maintenance_sla: create"          ON public.maintenance_sla;
DROP POLICY IF EXISTS "maintenance_sla: edit"            ON public.maintenance_sla;
DROP POLICY IF EXISTS "maintenance_sla: delete"          ON public.maintenance_sla;
DROP POLICY IF EXISTS "maintenance_tickets: view"        ON public.maintenance_tickets;
DROP POLICY IF EXISTS "maintenance_tickets: create"      ON public.maintenance_tickets;
DROP POLICY IF EXISTS "maintenance_tickets: edit"        ON public.maintenance_tickets;
DROP POLICY IF EXISTS "maintenance_tickets: delete"      ON public.maintenance_tickets;
DROP POLICY IF EXISTS "maintenance_executions: view"     ON public.maintenance_executions;
DROP POLICY IF EXISTS "maintenance_executions: create"   ON public.maintenance_executions;
DROP POLICY IF EXISTS "maintenance_executions: edit"     ON public.maintenance_executions;
DROP POLICY IF EXISTS "maintenance_executions: delete"   ON public.maintenance_executions;
DROP POLICY IF EXISTS "maintenance_ticket_photos: view"   ON public.maintenance_ticket_photos;
DROP POLICY IF EXISTS "maintenance_ticket_photos: create" ON public.maintenance_ticket_photos;
DROP POLICY IF EXISTS "maintenance_ticket_photos: edit"   ON public.maintenance_ticket_photos;
DROP POLICY IF EXISTS "maintenance_ticket_photos: delete" ON public.maintenance_ticket_photos;
DROP POLICY IF EXISTS "maintenance_status_history: view"  ON public.maintenance_status_history;

-- ------------------------------------------------------------
-- PASSO 2 -- CREATE das policies novas
-- Padrao: check_permission(auth.uid(),'manutencao','<acao>')
--         AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
-- Mapeamento: SELECT->view  INSERT->create  UPDATE->edit  DELETE->delete
-- ------------------------------------------------------------

-- == maintenance_sectors ==
CREATE POLICY "maintenance_sectors: view" ON public.maintenance_sectors
  FOR SELECT TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'view')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_sectors: create" ON public.maintenance_sectors
  FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'create')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_sectors: edit" ON public.maintenance_sectors
  FOR UPDATE TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  )
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_sectors: delete" ON public.maintenance_sectors
  FOR DELETE TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- == maintenance_categories ==
CREATE POLICY "maintenance_categories: view" ON public.maintenance_categories
  FOR SELECT TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'view')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_categories: create" ON public.maintenance_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'create')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_categories: edit" ON public.maintenance_categories
  FOR UPDATE TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  )
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_categories: delete" ON public.maintenance_categories
  FOR DELETE TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- == maintenance_items ==
CREATE POLICY "maintenance_items: view" ON public.maintenance_items
  FOR SELECT TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'view')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_items: create" ON public.maintenance_items
  FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'create')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_items: edit" ON public.maintenance_items
  FOR UPDATE TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  )
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_items: delete" ON public.maintenance_items
  FOR DELETE TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- == maintenance_sla ==
CREATE POLICY "maintenance_sla: view" ON public.maintenance_sla
  FOR SELECT TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'view')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_sla: create" ON public.maintenance_sla
  FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'create')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_sla: edit" ON public.maintenance_sla
  FOR UPDATE TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  )
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_sla: delete" ON public.maintenance_sla
  FOR DELETE TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- == maintenance_tickets ==
-- NOTA: DELIBERADAMENTE SEM policy de DELETE. A 031 tambem nao tinha
-- -> DELETE de chamado permanece 100% negado a todos (inclusive
-- super_admin: sem policy de DELETE, nao ha como invocar o bypass de
-- check_permission). Motivo: nao existe feature de excluir chamado na
-- UI (diagnostico secao 8.5.3); hard-delete destruiria historico e
-- auditoria. O objetivo da migration e APERTAR a seguranca, nao
-- habilitar capacidade nova. As demais tabelas ganham policy de DELETE
-- com check_permission; somente maintenance_tickets fica sem.
-- (O DROP POLICY IF EXISTS "maintenance_tickets: delete" acima remove
--  a policy caso uma versao anterior da 094 ja a tenha criado.)
CREATE POLICY "maintenance_tickets: view" ON public.maintenance_tickets
  FOR SELECT TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'view')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_tickets: create" ON public.maintenance_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'create')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_tickets: edit" ON public.maintenance_tickets
  FOR UPDATE TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  )
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
-- (sem CREATE POLICY de DELETE para maintenance_tickets -- intencional, ver NOTA acima)

-- == maintenance_executions (tabela-filha, escopo via ticket_id) ==
-- Dependencia executions -> tickets e aciclica; nao precisa de
-- SECURITY DEFINER. O subquery em maintenance_tickets tambem e
-- filtrado pela RLS de tickets, mas o escopo de unidade e mantido
-- explicito para clareza e paridade com a 031.
CREATE POLICY "maintenance_executions: view" ON public.maintenance_executions
  FOR SELECT TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'view')
    AND ticket_id IN (
      SELECT id FROM public.maintenance_tickets
      WHERE is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
    )
  );
CREATE POLICY "maintenance_executions: create" ON public.maintenance_executions
  FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'create')
    AND ticket_id IN (
      SELECT id FROM public.maintenance_tickets
      WHERE is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
    )
  );
CREATE POLICY "maintenance_executions: edit" ON public.maintenance_executions
  FOR UPDATE TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND ticket_id IN (
      SELECT id FROM public.maintenance_tickets
      WHERE is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
    )
  )
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND ticket_id IN (
      SELECT id FROM public.maintenance_tickets
      WHERE is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
    )
  );
CREATE POLICY "maintenance_executions: delete" ON public.maintenance_executions
  FOR DELETE TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'delete')
    AND ticket_id IN (
      SELECT id FROM public.maintenance_tickets
      WHERE is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
    )
  );

-- == maintenance_ticket_photos (tabela-filha, escopo via ticket_id) ==
CREATE POLICY "maintenance_ticket_photos: view" ON public.maintenance_ticket_photos
  FOR SELECT TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'view')
    AND ticket_id IN (
      SELECT id FROM public.maintenance_tickets
      WHERE is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
    )
  );
CREATE POLICY "maintenance_ticket_photos: create" ON public.maintenance_ticket_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'create')
    AND ticket_id IN (
      SELECT id FROM public.maintenance_tickets
      WHERE is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
    )
  );
CREATE POLICY "maintenance_ticket_photos: edit" ON public.maintenance_ticket_photos
  FOR UPDATE TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND ticket_id IN (
      SELECT id FROM public.maintenance_tickets
      WHERE is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
    )
  )
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND ticket_id IN (
      SELECT id FROM public.maintenance_tickets
      WHERE is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
    )
  );
CREATE POLICY "maintenance_ticket_photos: delete" ON public.maintenance_ticket_photos
  FOR DELETE TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'delete')
    AND ticket_id IN (
      SELECT id FROM public.maintenance_tickets
      WHERE is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
    )
  );

-- == maintenance_status_history (append-only via trigger) ==
-- A 031 so tinha policy de SELECT. INSERT e feito exclusivamente
-- pelo trigger record_ticket_status_change() (SECURITY DEFINER, que
-- bypassa RLS). NAO criamos policies de INSERT/UPDATE/DELETE de
-- proposito: a timeline deve ser append-only e o cliente autenticado
-- nao deve escrever nela diretamente. Mantem o comportamento da 031.
CREATE POLICY "maintenance_status_history: view" ON public.maintenance_status_history
  FOR SELECT TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'view')
    AND ticket_id IN (
      SELECT id FROM public.maintenance_tickets
      WHERE is_global_viewer() OR unit_id = ANY(get_user_unit_ids())
    )
  );

COMMIT;
