-- ============================================================
-- Migration 152: Setores e Categorias de Manutencao GLOBAIS
-- ============================================================
-- Decisao do diretor (06/jun/2026): "as mesmas categorias e setores
-- nas duas unidades". maintenance_sectors e maintenance_categories
-- deixam de ser por-unidade e passam a ser listas unicas (globais),
-- representadas por unit_id = NULL (mesmo padrao de permissao global
-- usado em user_permissions e nas policies is_global_viewer()).
--
-- ESCOPO:
--   1. DROP NOT NULL em unit_id das 2 tabelas.
--   2. Deduplicar por nome (lower(trim(name))): manter UM registro por
--      nome (preferindo o de Pinheiros), re-apontar maintenance_tickets
--      dos perdedores para o mantido, deletar perdedores, globalizar o
--      mantido (unit_id = NULL).
--   3. Substituir a UNIQUE (unit_id, lower(trim(name))) de categorias
--      por UNIQUE global em lower(trim(name)); adicionar UNIQUE global
--      em setores (nao existia).
--   4. Reescrever as policies RLS das 2 tabelas (da migration 094) para
--      liberar registros globais: (unit_id IS NULL OR is_global_viewer()
--      OR unit_id = ANY(get_user_unit_ids())).
--
-- ORDEM DDL+DML (regra do hotfix v1.5.7): DROP NOT NULL -> dedup
-- (repoint ANTES de delete, pois a FK e ON DELETE SET NULL) -> indices
-- UNIQUE por ultimo (dedup sujo aborta a transacao inteira).
--
-- Em PRODUCAO: Pinheiros configurado, Moema vazia, ZERO chamados.
-- So vai globalizar os registros de Pinheiros. O script e defensivo
-- para o banco LOCAL, que tem registros nas duas unidades.
--
-- Idempotente: re-execucao nao causa erro (IF NOT EXISTS / DROP IF EXISTS).
-- Rollback: 152_maintenance_sectors_categories_global_rollback.sql
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- PASSO 1 -- Tornar unit_id nullable (global = NULL)
-- ------------------------------------------------------------
ALTER TABLE public.maintenance_sectors    ALTER COLUMN unit_id DROP NOT NULL;
ALTER TABLE public.maintenance_categories ALTER COLUMN unit_id DROP NOT NULL;

-- ------------------------------------------------------------
-- PASSO 2 -- Deduplicar SETORES por nome (preferindo Pinheiros)
-- ------------------------------------------------------------
-- Temp table com o "keeper" de cada nome distinto. DISTINCT ON exige
-- que o ORDER BY comece pela expressao do DISTINCT ON; o desempate
-- prioriza a unidade Pinheiros (slug='pinheiros'), depois o mais antigo.
CREATE TEMP TABLE _sector_keepers ON COMMIT DROP AS
SELECT DISTINCT ON (lower(trim(s.name)))
       s.id  AS keeper_id,
       lower(trim(s.name)) AS norm
FROM public.maintenance_sectors s
LEFT JOIN public.units u ON u.id = s.unit_id
ORDER BY lower(trim(s.name)),
         (u.slug = 'pinheiros') DESC NULLS LAST,
         s.created_at ASC,
         s.id ASC;

-- Re-apontar chamados dos perdedores para o keeper (ANTES de deletar).
UPDATE public.maintenance_tickets t
SET sector_id = k.keeper_id
FROM public.maintenance_sectors s
JOIN _sector_keepers k ON k.norm = lower(trim(s.name))
WHERE t.sector_id = s.id
  AND s.id <> k.keeper_id;

-- Deletar perdedores.
DELETE FROM public.maintenance_sectors s
USING _sector_keepers k
WHERE k.norm = lower(trim(s.name))
  AND s.id <> k.keeper_id;

-- Globalizar os keepers (e qualquer registro remanescente).
UPDATE public.maintenance_sectors SET unit_id = NULL WHERE unit_id IS NOT NULL;

-- ------------------------------------------------------------
-- PASSO 3 -- Deduplicar CATEGORIAS por nome (preferindo Pinheiros)
-- ------------------------------------------------------------
CREATE TEMP TABLE _cat_keepers ON COMMIT DROP AS
SELECT DISTINCT ON (lower(trim(c.name)))
       c.id  AS keeper_id,
       lower(trim(c.name)) AS norm
FROM public.maintenance_categories c
LEFT JOIN public.units u ON u.id = c.unit_id
ORDER BY lower(trim(c.name)),
         (u.slug = 'pinheiros') DESC NULLS LAST,
         c.created_at ASC,
         c.id ASC;

UPDATE public.maintenance_tickets t
SET category_id = k.keeper_id
FROM public.maintenance_categories c
JOIN _cat_keepers k ON k.norm = lower(trim(c.name))
WHERE t.category_id = c.id
  AND c.id <> k.keeper_id;

DELETE FROM public.maintenance_categories c
USING _cat_keepers k
WHERE k.norm = lower(trim(c.name))
  AND c.id <> k.keeper_id;

UPDATE public.maintenance_categories SET unit_id = NULL WHERE unit_id IS NOT NULL;

-- ------------------------------------------------------------
-- PASSO 4 -- Indices UNIQUE globais (por ultimo: dedup sujo aborta tudo)
-- ------------------------------------------------------------
-- Categorias: substitui a unique por-unidade (migration 096) pela global.
DROP INDEX IF EXISTS public.uq_maintenance_categories_unit_name;
CREATE UNIQUE INDEX IF NOT EXISTS uq_maintenance_categories_name
  ON public.maintenance_categories (lower(trim(name)));

-- Setores: nao tinha unique; adiciona global.
CREATE UNIQUE INDEX IF NOT EXISTS uq_maintenance_sectors_name
  ON public.maintenance_sectors (lower(trim(name)));

-- ------------------------------------------------------------
-- PASSO 5 -- RLS: liberar registros globais (unit_id IS NULL)
-- Reescreve as 8 policies da migration 094 acrescentando o disjunto
-- "unit_id IS NULL" -- assim gerente (que NAO e is_global_viewer())
-- enxerga e gerencia os registros globais. O role-gate via
-- check_permission() e o escopo de unidade para registros NAO-globais
-- permanecem inalterados.
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
    AND (unit_id IS NULL OR is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_sectors: create" ON public.maintenance_sectors
  FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'create')
    AND (unit_id IS NULL OR is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_sectors: edit" ON public.maintenance_sectors
  FOR UPDATE TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND (unit_id IS NULL OR is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  )
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND (unit_id IS NULL OR is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_sectors: delete" ON public.maintenance_sectors
  FOR DELETE TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'delete')
    AND (unit_id IS NULL OR is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
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
    AND (unit_id IS NULL OR is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_categories: create" ON public.maintenance_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'create')
    AND (unit_id IS NULL OR is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_categories: edit" ON public.maintenance_categories
  FOR UPDATE TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND (unit_id IS NULL OR is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  )
  WITH CHECK (
    check_permission(auth.uid(), 'manutencao', 'edit')
    AND (unit_id IS NULL OR is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
CREATE POLICY "maintenance_categories: delete" ON public.maintenance_categories
  FOR DELETE TO authenticated
  USING (
    check_permission(auth.uid(), 'manutencao', 'delete')
    AND (unit_id IS NULL OR is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

COMMIT;

-- Recarregar o schema cache do PostgREST (policies/colunas alteradas).
NOTIFY pgrst, 'reload schema';
