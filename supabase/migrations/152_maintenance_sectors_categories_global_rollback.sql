-- ============================================================
-- ROLLBACK da Migration 152: Setores/Categorias de Manutencao globais
-- ============================================================
-- Reverte as mudancas ESTRUTURAIS da 152:
--   1. Restaura as policies RLS no formato da migration 094 (sem o
--      disjunto "unit_id IS NULL").
--   2. Remove os indices UNIQUE globais e recria a UNIQUE por-unidade
--      de categorias (estado da migration 096). Setores volta a NAO
--      ter unique (estado original da 031).
--
-- *** A GLOBALIZACAO DOS DADOS NAO E FIELMENTE REVERSIVEL ***
-- A 152 setou unit_id = NULL e deduplicou registros (deletando
-- duplicatas e re-apontando chamados). Este rollback NAO re-separa os
-- dados por unidade nem ressuscita os registros deletados -- nao ha
-- informacao para saber a qual unidade cada registro globalizado
-- pertencia originalmente.
--
-- Consequencia: os registros permanecem com unit_id = NULL. Por isso
-- este rollback NAO re-adiciona o NOT NULL em unit_id (ALTER ... SET
-- NOT NULL falharia com os registros globais existentes). Caso seja
-- realmente necessario restaurar o NOT NULL, o operador deve PRIMEIRO
-- reatribuir manualmente um unit_id a cada registro e so entao rodar
-- as linhas comentadas no fim deste arquivo.
--
-- Importante: com as policies revertidas ao formato 094, os registros
-- que ficaram globais (unit_id = NULL) deixam de ser visiveis para
-- cargos que nao sao is_global_viewer() (ex.: gerente), porque
-- "unit_id = ANY(get_user_unit_ids())" e falso para NULL. Isso e
-- inerente ao caminho de globalizacao ja consumado.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- PASSO 1 -- Remover indices UNIQUE globais; restaurar unique 096
-- ------------------------------------------------------------
DROP INDEX IF EXISTS public.uq_maintenance_sectors_name;
DROP INDEX IF EXISTS public.uq_maintenance_categories_name;

-- Estado da migration 096 (unique por-unidade em categorias).
CREATE UNIQUE INDEX IF NOT EXISTS uq_maintenance_categories_unit_name
  ON public.maintenance_categories (unit_id, lower(trim(name)));

-- ------------------------------------------------------------
-- PASSO 2 -- Restaurar policies RLS no formato da migration 094
-- (sem o disjunto "unit_id IS NULL")
-- ------------------------------------------------------------

-- == maintenance_sectors ==
DROP POLICY IF EXISTS "maintenance_sectors: view"   ON public.maintenance_sectors;
DROP POLICY IF EXISTS "maintenance_sectors: create" ON public.maintenance_sectors;
DROP POLICY IF EXISTS "maintenance_sectors: edit"   ON public.maintenance_sectors;
DROP POLICY IF EXISTS "maintenance_sectors: delete" ON public.maintenance_sectors;

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
DROP POLICY IF EXISTS "maintenance_categories: view"   ON public.maintenance_categories;
DROP POLICY IF EXISTS "maintenance_categories: create" ON public.maintenance_categories;
DROP POLICY IF EXISTS "maintenance_categories: edit"   ON public.maintenance_categories;
DROP POLICY IF EXISTS "maintenance_categories: delete" ON public.maintenance_categories;

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

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- OPCIONAL -- Restaurar NOT NULL em unit_id (NAO executado por padrao)
-- So funciona se TODOS os registros tiverem unit_id preenchido. Como a
-- 152 globalizou (unit_id = NULL) e este rollback NAO re-separa os
-- dados, reatribua manualmente as unidades antes de descomentar:
-- ------------------------------------------------------------
-- ALTER TABLE public.maintenance_sectors    ALTER COLUMN unit_id SET NOT NULL;
-- ALTER TABLE public.maintenance_categories ALTER COLUMN unit_id SET NOT NULL;
