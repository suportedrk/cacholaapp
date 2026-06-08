-- 153_atas_diretoria_visibility_rls.sql
-- Modulo Atas — Fase 2 (SOMENTE banco). Redesenho do modelo de visibilidade RLS.
--
-- OBJETIVO:
--   1. Permitir atas GLOBAIS (sem unidade): unit_id passa a ser NULLABLE.
--   2. Novo modelo de visibilidade:
--        - diretoria (super_admin + diretor) ve/edita TODAS as atas;
--        - demais usuarios: apenas atas que CRIARAM ou em que PARTICIPAM.
--   3. Introduz is_diretoria() — restrito a super_admin + diretor.
--        NAO usa is_global_viewer() (que inclui pos_vendas) nem a logica de
--        gerente-da-unidade da migration 089.
--
-- MUDANCA DE COMPORTAMENTO (tightening deliberado vs estado da migration 089):
--   - gerente PERDE a visibilidade unit-wide de atas que nao criou/participa;
--   - pos_vendas PERDE a visao global de atas (is_diretoria nao o inclui);
--   - diretoria passa a poder criar atas globais (unit_id IS NULL).
--
-- NOTA DE RECURSAO RLS:
--   can_view_meeting() permanece SECURITY DEFINER (item 7). As policies de
--   SELECT das tabelas filhas (meeting_participants / meeting_action_items)
--   continuam usando can_view_meeting(meeting_id), e as policies de ESCRITA
--   das filhas referenciam meeting_participants via EXISTS. A terminacao da
--   avaliacao depende de can_view_meeting bypassar RLS (SECURITY DEFINER).
--   NUNCA converter para SECURITY INVOKER — causaria recursao infinita.
--
-- ESCOPO: apenas banco. Navegacao e guard de layout (atas/layout.tsx)
--   permanecem inalterados — modulo segue "Em breve".
--
-- Aplicacao em producao: manual via docker exec apos deploy verde
--   (deploy.yml NAO aplica migrations). A etapa de deploy deve auditar
--   user_permissions de diretor/gerente CONTRA PRODUCAO (nao local).

BEGIN;

-- ============================================================
-- 1. unit_id passa a ser opcional (suporte a atas globais da diretoria)
-- ============================================================
ALTER TABLE public.meeting_minutes ALTER COLUMN unit_id DROP NOT NULL;

-- ============================================================
-- 2. is_diretoria() — super_admin + diretor APENAS
--    Mesmo padrao de is_global_viewer (sql, STABLE, SECURITY DEFINER,
--    search_path=public), mas conjunto de roles mais restrito.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_diretoria()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_diretoria() TO authenticated, anon;

COMMENT ON FUNCTION public.is_diretoria() IS
  'Retorna true se o usuario autenticado e super_admin ou diretor. '
  'Diferente de is_global_viewer(), NAO inclui pos_vendas — cobre apenas '
  'super_admin e diretor. Usada no modelo de visibilidade do modulo Atas '
  '(migration 153): diretoria ve todas as atas; demais veem apenas as que '
  'criaram ou em que participam.';

-- ============================================================
-- 3. meeting_minutes — SELECT
--    criador | diretoria | participante
-- ============================================================
DROP POLICY IF EXISTS "meeting_minutes_select" ON public.meeting_minutes;
CREATE POLICY "meeting_minutes_select" ON public.meeting_minutes
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_diretoria()
    OR EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = meeting_minutes.id
        AND mp.user_id = auth.uid()
    )
  );

-- ============================================================
-- 4. meeting_minutes — INSERT
--    criador self + permissao de create + escopo de unidade
--    (ata por unidade na propria unidade OU ata global pela diretoria)
-- ============================================================
DROP POLICY IF EXISTS "meeting_minutes_insert" ON public.meeting_minutes;
CREATE POLICY "meeting_minutes_insert" ON public.meeting_minutes
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.check_permission(auth.uid(), 'atas', 'create')
    AND (
      (unit_id IS NOT NULL AND unit_id = ANY(public.get_user_unit_ids()))
      OR (unit_id IS NULL AND public.is_diretoria())
    )
  );

-- ============================================================
-- 5. meeting_minutes — UPDATE
-- ============================================================
DROP POLICY IF EXISTS "meeting_minutes_update" ON public.meeting_minutes;
CREATE POLICY "meeting_minutes_update" ON public.meeting_minutes
  FOR UPDATE TO authenticated
  USING (
    public.check_permission(auth.uid(), 'atas', 'edit')
    AND (
      created_by = auth.uid()
      OR public.is_diretoria()
      OR EXISTS (
        SELECT 1 FROM public.meeting_participants mp
        WHERE mp.meeting_id = meeting_minutes.id
          AND mp.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_diretoria()
    OR (unit_id IS NOT NULL AND unit_id = ANY(public.get_user_unit_ids()))
  );

-- ============================================================
-- 6. meeting_minutes — DELETE
--    criador OU diretoria, com permissao de delete
-- ============================================================
DROP POLICY IF EXISTS "meeting_minutes_delete" ON public.meeting_minutes;
CREATE POLICY "meeting_minutes_delete" ON public.meeting_minutes
  FOR DELETE TO authenticated
  USING (
    public.check_permission(auth.uid(), 'atas', 'delete')
    AND (created_by = auth.uid() OR public.is_diretoria())
  );

-- ============================================================
-- 7. can_view_meeting(p_meeting_id uuid)
--    Mantem assinatura, SECURITY DEFINER, STABLE, search_path.
--    criador | diretoria | participante. SEM is_global_viewer,
--    SEM gerente-da-unidade.
--    PERMANECE SECURITY DEFINER — ver nota de recursao no cabecalho.
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_view_meeting(p_meeting_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meeting_minutes mm
    WHERE mm.id = p_meeting_id
      AND (
        mm.created_by = auth.uid()
        OR public.is_diretoria()
        OR EXISTS (
          SELECT 1
          FROM public.meeting_participants mp
          WHERE mp.meeting_id = mm.id
            AND mp.user_id = auth.uid()
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_meeting(uuid) TO authenticated, anon;

COMMENT ON FUNCTION public.can_view_meeting(uuid) IS
  'Retorna true se o usuario autenticado pode ver a ata p_meeting_id: '
  'criador, diretoria (super_admin/diretor) ou participante. '
  'SECURITY DEFINER e obrigatorio (bypassa RLS) para evitar recursao nas '
  'policies das tabelas filhas. Redesenhada na migration 153 — removida a '
  'logica de is_global_viewer e gerente-da-unidade.';

-- ============================================================
-- 8. Tabelas filhas — alinhar ESCRITA a regra do UPDATE do pai:
--    check_permission(atas,edit) AND (criador | diretoria | participante)
--    Remove TODAS as referencias a is_global_viewer e gerente-da-unidade.
-- ============================================================

-- ── meeting_participants ──────────────────────────────────────
DROP POLICY IF EXISTS "meeting_participants_insert" ON public.meeting_participants;
CREATE POLICY "meeting_participants_insert" ON public.meeting_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    public.check_permission(auth.uid(), 'atas', 'edit')
    AND EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR public.is_diretoria()
          OR EXISTS (
            SELECT 1 FROM public.meeting_participants mp
            WHERE mp.meeting_id = mm.id
              AND mp.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "meeting_participants_update" ON public.meeting_participants;
CREATE POLICY "meeting_participants_update" ON public.meeting_participants
  FOR UPDATE TO authenticated
  USING (
    public.check_permission(auth.uid(), 'atas', 'edit')
    AND EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR public.is_diretoria()
          OR EXISTS (
            SELECT 1 FROM public.meeting_participants mp
            WHERE mp.meeting_id = mm.id
              AND mp.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "meeting_participants_delete" ON public.meeting_participants;
CREATE POLICY "meeting_participants_delete" ON public.meeting_participants
  FOR DELETE TO authenticated
  USING (
    public.check_permission(auth.uid(), 'atas', 'edit')
    AND EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR public.is_diretoria()
          OR EXISTS (
            SELECT 1 FROM public.meeting_participants mp
            WHERE mp.meeting_id = mm.id
              AND mp.user_id = auth.uid()
          )
        )
    )
  );

-- ── meeting_action_items ──────────────────────────────────────
DROP POLICY IF EXISTS "meeting_action_items_insert" ON public.meeting_action_items;
CREATE POLICY "meeting_action_items_insert" ON public.meeting_action_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.check_permission(auth.uid(), 'atas', 'edit')
    AND EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR public.is_diretoria()
          OR EXISTS (
            SELECT 1 FROM public.meeting_participants mp
            WHERE mp.meeting_id = mm.id
              AND mp.user_id = auth.uid()
          )
        )
    )
  );

-- UPDATE: preserva a clausula adicional "assigned_to = auth.uid()"
-- (responsavel marca o proprio item mesmo sem permissao de edit).
DROP POLICY IF EXISTS "meeting_action_items_update" ON public.meeting_action_items;
CREATE POLICY "meeting_action_items_update" ON public.meeting_action_items
  FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR (
      public.check_permission(auth.uid(), 'atas', 'edit')
      AND EXISTS (
        SELECT 1 FROM public.meeting_minutes mm
        WHERE mm.id = meeting_id
          AND (
            mm.created_by = auth.uid()
            OR public.is_diretoria()
            OR EXISTS (
              SELECT 1 FROM public.meeting_participants mp
              WHERE mp.meeting_id = mm.id
                AND mp.user_id = auth.uid()
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "meeting_action_items_delete" ON public.meeting_action_items;
CREATE POLICY "meeting_action_items_delete" ON public.meeting_action_items
  FOR DELETE TO authenticated
  USING (
    public.check_permission(auth.uid(), 'atas', 'edit')
    AND EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR public.is_diretoria()
          OR EXISTS (
            SELECT 1 FROM public.meeting_participants mp
            WHERE mp.meeting_id = mm.id
              AND mp.user_id = auth.uid()
          )
        )
    )
  );

-- ============================================================
-- 9. Backfill de permissoes de Atas (padrao cachola-rbac-pattern)
-- ============================================================

-- 9a. Template role_permissions (fonte de verdade lida por apply-template.ts):
--     diretor e gerente passam a ter create/edit/delete granted.
INSERT INTO public.role_permissions (role_code, module_code, action, granted) VALUES
  ('diretor', 'atas', 'create', true),
  ('diretor', 'atas', 'edit',   true),
  ('diretor', 'atas', 'delete', true),
  ('gerente', 'atas', 'create', true),
  ('gerente', 'atas', 'edit',   true),
  ('gerente', 'atas', 'delete', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = true;

-- 9b. Propagar para usuarios JA existentes com role diretor ou gerente.
--     check_permission e unit-agnostic (le user_id+module+action), portanto
--     gravamos grant GLOBAL (unit_id = NULL), padrao das demais linhas reais.
--     Constraint alvo: UNIQUE NULLS NOT DISTINCT (user_id, unit_id, module, action).
--     Nao altera permissoes de outros modulos nem de outros cargos.
INSERT INTO public.user_permissions (user_id, unit_id, module, action, granted)
SELECT u.id, NULL::uuid, 'atas', a.action, true
FROM public.users u
CROSS JOIN (VALUES ('create'), ('edit'), ('delete')) AS a(action)
WHERE u.role IN ('diretor', 'gerente')
  AND u.is_active = true
ON CONFLICT (user_id, unit_id, module, action) DO UPDATE SET granted = true;

-- ============================================================
-- 10. Reload do schema cache do PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
