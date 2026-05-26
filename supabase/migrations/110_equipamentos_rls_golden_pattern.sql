-- ============================================================
-- Migration 110 — Equipamentos: RLS no molde de ouro (Fase 2 piloto)
-- Criado em: 2026-05-26
-- Referência: docs/rbac/proposta-arquitetura-alvo.md Item 2 (molde de ouro)
--             + Fase 1 do Item 6 (12 módulos cargo-puros)
--             + decisão Opção B (2026-05-26)
--
-- Terceira e última migration do piloto Equipamentos.
-- Reescreve a RLS de public.equipment e public.equipment_categories
-- para usar check_permission(auth.uid(), 'equipamentos', '<ação>')
-- combinado com filtro de unidade, no padrão Eventos / Manutenção
-- (077, 094).
--
-- Pré-condições (devem estar OK):
--   - migration 107 aplicada (permission_controls catalog)
--   - migration 108 aplicada (template manutencao alinhado)
--   - migration 109 aplicada (user_permissions backfill aditivo)
--
-- Padrão das 8 policies (4 ações × 2 tabelas):
--   SELECT: USING (check_permission + is_global_viewer OR unit)
--   INSERT: WITH CHECK (check_permission + is_global_viewer OR unit)
--   UPDATE: USING + WITH CHECK (check_permission + is_global_viewer OR unit)
--   DELETE: USING (check_permission + is_global_viewer OR unit)
--
-- Não-destrutivo em runtime: o backfill da 109 garante que todos os
-- usuários com cargo super_admin/diretor/gerente/manutencao já têm
-- linhas granted=true em user_permissions para as 4 ações. super_admin
-- usa bypass na própria check_permission.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Pré-validação: usuários elegíveis com cobertura completa
-- ------------------------------------------------------------
DO $$
DECLARE
  v_short INT;
BEGIN
  SELECT COUNT(*) INTO v_short
  FROM public.users u
  WHERE u.role IN ('diretor', 'gerente', 'manutencao')
    AND (
      SELECT COUNT(*) FROM public.user_permissions up
      WHERE up.user_id = u.id
        AND up.module = 'equipamentos'
        AND up.action IN ('view','create','edit','delete')
        AND up.granted = true
    ) <> 4;

  IF v_short > 0 THEN
    RAISE EXCEPTION
      'Abortando: % usuário(s) elegível(is) (diretor/gerente/manutencao) sem cobertura completa em user_permissions para equipamentos. Aplicar migrations 108 + 109 antes desta, ou investigar linhas granted=false individuais.',
      v_short;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- PASSO 1 — DROP policies antigas (idempotente)
-- ------------------------------------------------------------
-- Policies da 012 (equipment, unit-only):
DROP POLICY IF EXISTS equipment_select ON public.equipment;
DROP POLICY IF EXISTS equipment_insert ON public.equipment;
DROP POLICY IF EXISTS equipment_update ON public.equipment;
DROP POLICY IF EXISTS equipment_delete ON public.equipment;

-- Policies da 013 (equipment_categories, unit-only):
DROP POLICY IF EXISTS "equip_cat_select" ON public.equipment_categories;
DROP POLICY IF EXISTS "equip_cat_insert" ON public.equipment_categories;
DROP POLICY IF EXISTS "equip_cat_update" ON public.equipment_categories;
DROP POLICY IF EXISTS "equip_cat_delete" ON public.equipment_categories;

-- Nomes novos (idempotência em re-execução):
DROP POLICY IF EXISTS "equipment: view"   ON public.equipment;
DROP POLICY IF EXISTS "equipment: create" ON public.equipment;
DROP POLICY IF EXISTS "equipment: edit"   ON public.equipment;
DROP POLICY IF EXISTS "equipment: delete" ON public.equipment;
DROP POLICY IF EXISTS "equipment_categories: view"   ON public.equipment_categories;
DROP POLICY IF EXISTS "equipment_categories: create" ON public.equipment_categories;
DROP POLICY IF EXISTS "equipment_categories: edit"   ON public.equipment_categories;
DROP POLICY IF EXISTS "equipment_categories: delete" ON public.equipment_categories;

-- ------------------------------------------------------------
-- PASSO 2 — CREATE policies no molde de ouro
-- ------------------------------------------------------------

-- == equipment ==
CREATE POLICY "equipment: view" ON public.equipment
  FOR SELECT TO authenticated
  USING (
    check_permission(auth.uid(), 'equipamentos', 'view')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "equipment: create" ON public.equipment
  FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'equipamentos', 'create')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "equipment: edit" ON public.equipment
  FOR UPDATE TO authenticated
  USING (
    check_permission(auth.uid(), 'equipamentos', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  )
  WITH CHECK (
    check_permission(auth.uid(), 'equipamentos', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "equipment: delete" ON public.equipment
  FOR DELETE TO authenticated
  USING (
    check_permission(auth.uid(), 'equipamentos', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- == equipment_categories ==
CREATE POLICY "equipment_categories: view" ON public.equipment_categories
  FOR SELECT TO authenticated
  USING (
    check_permission(auth.uid(), 'equipamentos', 'view')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "equipment_categories: create" ON public.equipment_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'equipamentos', 'create')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "equipment_categories: edit" ON public.equipment_categories
  FOR UPDATE TO authenticated
  USING (
    check_permission(auth.uid(), 'equipamentos', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  )
  WITH CHECK (
    check_permission(auth.uid(), 'equipamentos', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "equipment_categories: delete" ON public.equipment_categories
  FOR DELETE TO authenticated
  USING (
    check_permission(auth.uid(), 'equipamentos', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- ------------------------------------------------------------
-- PASSO 3 — Pós-validação: 4 policies em cada tabela, nomes esperados
-- ------------------------------------------------------------
DO $$
DECLARE
  v_eq   INT;
  v_eqc  INT;
BEGIN
  SELECT COUNT(*) INTO v_eq
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'equipment'
    AND policyname IN ('equipment: view','equipment: create','equipment: edit','equipment: delete');

  SELECT COUNT(*) INTO v_eqc
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'equipment_categories'
    AND policyname IN ('equipment_categories: view','equipment_categories: create','equipment_categories: edit','equipment_categories: delete');

  IF v_eq <> 4 OR v_eqc <> 4 THEN
    RAISE EXCEPTION
      'Pós-condição falhou: esperava 4 policies em equipment e 4 em equipment_categories. Encontrei % e %.',
      v_eq, v_eqc;
  END IF;

  RAISE NOTICE 'OK: 4 policies aplicadas em cada tabela (equipment, equipment_categories).';
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
