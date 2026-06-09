-- 153_atas_diretoria_visibility_rls_rollback.sql
-- Rollback da migration 153_atas_diretoria_visibility_rls.sql
--
-- OBJETIVO: restaurar o estado exato anterior ao 153:
--   - policies de meeting_minutes (select/update/delete) => definicoes da migration 089
--   - policy  de meeting_minutes (insert)               => definicao da migration 077
--   - can_view_meeting()                                => definicao da migration 089
--   - policies de escrita das filhas (participants/action_items) => definicoes da 089
--   - remove is_diretoria()
--   - reverte backfill de role_permissions e user_permissions (best-effort)
--
-- NOTA SOBRE unit_id:
--   A migration 153 removeu o NOT NULL de meeting_minutes.unit_id para suportar
--   atas globais (unit_id IS NULL). Este rollback NAO re-aplica NOT NULL cegamente
--   porque pode existir ata com unit_id IS NULL inserida apos a 153 — o ALTER TABLE
--   falharia com "column contains null values".
--
--   Para restaurar NOT NULL manualmente APOS garantir que nao existem atas globais:
--
--     -- Verificar se existem atas com unit_id NULL:
--     SELECT id, title FROM public.meeting_minutes WHERE unit_id IS NULL;
--
--     -- Se zero resultados, entao e seguro:
--     -- ALTER TABLE public.meeting_minutes ALTER COLUMN unit_id SET NOT NULL;
--
-- EXECUCAO: apenas em banco local (docker exec cacholaos-db psql ...).
--   Nunca aplicar em producao sem verificacao prévia de unit_id acima.

BEGIN;

-- ============================================================
-- 1. Remover is_diretoria() introduzida pela 153
-- ============================================================
-- CASCADE necessario: as policies da 153 dependem de is_diretoria().
-- As policies sao recriadas nos blocos seguintes com a logica da 089/077.
DROP FUNCTION IF EXISTS public.is_diretoria() CASCADE;

-- ============================================================
-- 2. Restaurar can_view_meeting() => definicao da migration 089
--    (criador | participante | is_global_viewer | gerente-da-unidade)
--    NOTA: sem SET search_path = public (identico ao 089)
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_view_meeting(p_meeting_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meeting_minutes mm
    WHERE mm.id = p_meeting_id
      AND (
        -- Criador sempre pode ver
        mm.created_by = auth.uid()
        -- Participante pode ver
        OR EXISTS (
          SELECT 1
          FROM public.meeting_participants mp
          WHERE mp.meeting_id = mm.id
            AND mp.user_id = auth.uid()
        )
        -- super_admin, diretor e pos_vendas veem tudo (is_global_viewer)
        OR is_global_viewer()
        -- Gerente da unidade da ata tambem ve tudo
        OR EXISTS (
          SELECT 1
          FROM public.user_units uu
          JOIN public.users u ON u.id = uu.user_id
          WHERE uu.user_id = auth.uid()
            AND uu.unit_id = mm.unit_id
            AND u.role     = 'gerente'
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_meeting(uuid) TO authenticated, anon;

COMMENT ON FUNCTION public.can_view_meeting(uuid) IS
  'Retorna true se o usuario autenticado pode ver a ata p_meeting_id. '
  'Criador, participantes, global viewers e gerente da unidade da ata. '
  'Migrada de user_units.role para users.role (JOIN) na migration 089.';

-- ============================================================
-- 3. meeting_minutes — SELECT => definicao da migration 089
-- ============================================================
DROP POLICY IF EXISTS "meeting_minutes_select" ON public.meeting_minutes;
CREATE POLICY "meeting_minutes_select" ON public.meeting_minutes
  FOR SELECT TO authenticated
  USING (
    (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.meeting_participants mp
        WHERE mp.meeting_id = meeting_minutes.id
          AND mp.user_id = auth.uid()
      )
      OR is_global_viewer()
      OR EXISTS (
        SELECT 1 FROM public.user_units uu
        JOIN public.users u ON u.id = uu.user_id
        WHERE uu.user_id = auth.uid()
          AND uu.unit_id = meeting_minutes.unit_id
          AND u.role     = 'gerente'
      )
    )
  );

-- ============================================================
-- 4. meeting_minutes — INSERT => definicao da migration 077
--    (check_permission(atas,create) AND unit_id em unidades proprias AND criador self)
-- ============================================================
DROP POLICY IF EXISTS "meeting_minutes_insert" ON public.meeting_minutes;
CREATE POLICY "meeting_minutes_insert" ON public.meeting_minutes
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'atas'::text, 'create'::text)
    AND (unit_id = ANY (get_user_unit_ids()))
    AND (created_by = auth.uid())
  );

-- ============================================================
-- 5. meeting_minutes — UPDATE => definicao da migration 089
-- ============================================================
DROP POLICY IF EXISTS "meeting_minutes_update" ON public.meeting_minutes;
CREATE POLICY "meeting_minutes_update" ON public.meeting_minutes
  FOR UPDATE TO authenticated
  USING (
    (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
    AND (
      created_by = auth.uid()
      OR is_global_viewer()
      OR EXISTS (
        SELECT 1 FROM public.user_units uu
        JOIN public.users u ON u.id = uu.user_id
        WHERE uu.user_id = auth.uid()
          AND uu.unit_id = meeting_minutes.unit_id
          AND u.role     = 'gerente'
      )
    )
  )
  WITH CHECK (
    unit_id = ANY(get_user_unit_ids())
  );

-- ============================================================
-- 6. meeting_minutes — DELETE => definicao da migration 089
-- ============================================================
DROP POLICY IF EXISTS "meeting_minutes_delete" ON public.meeting_minutes;
CREATE POLICY "meeting_minutes_delete" ON public.meeting_minutes
  FOR DELETE TO authenticated
  USING (
    (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
    AND (
      created_by = auth.uid()
      OR is_global_viewer()
      OR EXISTS (
        SELECT 1 FROM public.user_units uu
        JOIN public.users u ON u.id = uu.user_id
        WHERE uu.user_id = auth.uid()
          AND uu.unit_id = meeting_minutes.unit_id
          AND u.role     = 'gerente'
      )
    )
  );

-- ============================================================
-- 7. meeting_participants — INSERT/UPDATE/DELETE => definicoes da migration 089
-- ============================================================
DROP POLICY IF EXISTS "meeting_participants_insert" ON public.meeting_participants;
CREATE POLICY "meeting_participants_insert" ON public.meeting_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            JOIN public.users u ON u.id = uu.user_id
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND u.role     = 'gerente'
          )
        )
    )
  );

DROP POLICY IF EXISTS "meeting_participants_update" ON public.meeting_participants;
CREATE POLICY "meeting_participants_update" ON public.meeting_participants
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            JOIN public.users u ON u.id = uu.user_id
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND u.role     = 'gerente'
          )
        )
    )
  );

DROP POLICY IF EXISTS "meeting_participants_delete" ON public.meeting_participants;
CREATE POLICY "meeting_participants_delete" ON public.meeting_participants
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            JOIN public.users u ON u.id = uu.user_id
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND u.role     = 'gerente'
          )
        )
    )
  );

-- ============================================================
-- 8. meeting_action_items — INSERT/UPDATE/DELETE => definicoes da migration 089
-- ============================================================
DROP POLICY IF EXISTS "meeting_action_items_insert" ON public.meeting_action_items;
CREATE POLICY "meeting_action_items_insert" ON public.meeting_action_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            JOIN public.users u ON u.id = uu.user_id
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND u.role     = 'gerente'
          )
        )
    )
  );

DROP POLICY IF EXISTS "meeting_action_items_update" ON public.meeting_action_items;
CREATE POLICY "meeting_action_items_update" ON public.meeting_action_items
  FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            JOIN public.users u ON u.id = uu.user_id
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND u.role     = 'gerente'
          )
        )
    )
  );

DROP POLICY IF EXISTS "meeting_action_items_delete" ON public.meeting_action_items;
CREATE POLICY "meeting_action_items_delete" ON public.meeting_action_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            JOIN public.users u ON u.id = uu.user_id
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND u.role     = 'gerente'
          )
        )
    )
  );

-- ============================================================
-- 9. Reverter backfill de permissoes (best-effort, mesmo padrao 123/127)
--    Remove apenas as linhas exatas adicionadas pela 153.
--    Se alguma linha nao existir (ex: ja removida), DELETE nao falha.
-- ============================================================

-- 9a. role_permissions: remover as 6 linhas adicionadas pela 153
DELETE FROM public.role_permissions
WHERE (role_code, module_code, action) IN (
  ('diretor', 'atas', 'create'),
  ('diretor', 'atas', 'edit'),
  ('diretor', 'atas', 'delete'),
  ('gerente', 'atas', 'create'),
  ('gerente', 'atas', 'edit'),
  ('gerente', 'atas', 'delete')
);

-- 9b. user_permissions: remover grants (unit_id=NULL, atas, create/edit/delete)
--     de usuarios com role diretor ou gerente.
--     ATENCAO: remove APENAS as linhas com unit_id IS NULL.
--     Se algum usuario tiver grant por-unidade (unit_id nao nulo) para atas,
--     essas linhas NAO sao tocadas — foram criadas por outro mecanismo.
DELETE FROM public.user_permissions
WHERE module = 'atas'
  AND action IN ('create', 'edit', 'delete')
  AND unit_id IS NULL
  AND user_id IN (
    SELECT id FROM public.users WHERE role IN ('diretor', 'gerente')
  );

-- ============================================================
-- 10. Reload do schema cache do PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
