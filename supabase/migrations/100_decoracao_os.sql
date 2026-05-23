-- ============================================================
-- Migration 100 — Módulo Decoração: Ordens de Serviço (Pedaço 1)
-- Cria as duas tabelas operacionais da OS de balões, com filtro
-- de unidade na RLS (padrão events). Adiciona duas RPCs atômicas
-- (create/update_decoracao_os_with_items) SECURITY INVOKER, para
-- que a RLS valha normalmente — assim a RPC não vira atalho que
-- ignora o controle de acesso.
--
-- NÃO inclui aqui (Pedaços 2/3): vínculo com festa do Ploomes,
-- foto da mesa, status "Encerrada" da OS, ocorrências.
--
-- Onboarding: ao cadastrar a decoradora em produção, garantir que
-- o usuário dela tenha entrada em user_units para AMBAS as
-- unidades (Pinheiros + Moema); senão ela só vê uma. O módulo
-- 'decoracao' já está registrado pela migration 097.
--
-- Rollback: 100_decoracao_os_rollback.sql
-- ============================================================

BEGIN;

-- ── 1. TABELAS ───────────────────────────────────────────────

-- Ordem de serviço (a "festa"): unit_id obrigatório para o filtro
-- de RLS; data/hora opcionais (planilha permite linha sem data
-- definida); tema text livre (aceita combinações como
-- "Pokémon + Corinthians"); tema_id é link opcional ao catálogo.
-- Sem coluna de status — o status vive no item; status agregado
-- da OS é derivado em UI a partir dos itens.
CREATE TABLE IF NOT EXISTS public.decoracao_os (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     uuid        NOT NULL REFERENCES public.units(id),
  data_festa  date,
  hora_festa  time,
  tema        text        NOT NULL,
  tema_id     uuid        REFERENCES public.decoracao_temas(id),
  created_by  uuid        REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decoracao_os_unit
  ON public.decoracao_os (unit_id);
CREATE INDEX IF NOT EXISTS idx_decoracao_os_data
  ON public.decoracao_os (data_festa);

-- Itens da OS: balao_modelo_id NULL = "a definir" (planilha
-- permite); quantidade INTEGER porque é contagem de itens (não
-- existe meio centro de mesa); custo e venda NÃO são gravados —
-- são calculados ao vivo na UI a partir do modelo, fiel à
-- planilha (equivalente ao IFERROR(VLOOKUP)*qtd).
CREATE TABLE IF NOT EXISTS public.decoracao_os_itens (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id           uuid        NOT NULL REFERENCES public.decoracao_os(id) ON DELETE CASCADE,
  balao_modelo_id uuid        REFERENCES public.decoracao_balao_modelos(id),
  quantidade      integer     NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  observacoes     text,
  status          text        NOT NULL DEFAULT 'aguardando_prova'
                  CHECK (status IN ('aguardando_prova', 'aprovada', 'realizada')),
  ordem           integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decoracao_os_itens_os
  ON public.decoracao_os_itens (os_id);

-- ── 2. GRANTS de tabela (papel authenticated do PostgREST) ──
-- Obrigatório: PostgREST checa GRANT antes da RLS. Sem isso, 403
-- "permission denied for table" mesmo com políticas corretas.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decoracao_os       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decoracao_os_itens TO authenticated;

-- ── 3. TRIGGERS updated_at (reutiliza update_updated_at()) ────

CREATE OR REPLACE TRIGGER trg_decoracao_os_updated_at
  BEFORE UPDATE ON public.decoracao_os
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE TRIGGER trg_decoracao_os_itens_updated_at
  BEFORE UPDATE ON public.decoracao_os_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 4. RLS ───────────────────────────────────────────────────
-- Padrão `events` (010_fase25_units.sql): check_permission +
-- filtro por unit_id via get_user_unit_ids(). is_global_viewer()
-- continua sendo rede de segurança para super_admin/diretor.
-- Itens herdam o filtro via EXISTS na ordem-pai.

ALTER TABLE public.decoracao_os       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decoracao_os_itens ENABLE ROW LEVEL SECURITY;

-- decoracao_os
DROP POLICY IF EXISTS "decoracao_os: view"   ON public.decoracao_os;
DROP POLICY IF EXISTS "decoracao_os: create" ON public.decoracao_os;
DROP POLICY IF EXISTS "decoracao_os: edit"   ON public.decoracao_os;
DROP POLICY IF EXISTS "decoracao_os: delete" ON public.decoracao_os;

CREATE POLICY "decoracao_os: view" ON public.decoracao_os
  FOR SELECT TO authenticated
  USING (
    check_permission(auth.uid(), 'decoracao', 'view')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "decoracao_os: create" ON public.decoracao_os
  FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'decoracao', 'create')
    AND unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "decoracao_os: edit" ON public.decoracao_os
  FOR UPDATE TO authenticated
  USING (
    check_permission(auth.uid(), 'decoracao', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  )
  WITH CHECK (
    check_permission(auth.uid(), 'decoracao', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "decoracao_os: delete" ON public.decoracao_os
  FOR DELETE TO authenticated
  USING (
    check_permission(auth.uid(), 'decoracao', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- decoracao_os_itens — herda o filtro de unidade via EXISTS
DROP POLICY IF EXISTS "decoracao_os_itens: view"   ON public.decoracao_os_itens;
DROP POLICY IF EXISTS "decoracao_os_itens: create" ON public.decoracao_os_itens;
DROP POLICY IF EXISTS "decoracao_os_itens: edit"   ON public.decoracao_os_itens;
DROP POLICY IF EXISTS "decoracao_os_itens: delete" ON public.decoracao_os_itens;

CREATE POLICY "decoracao_os_itens: view" ON public.decoracao_os_itens
  FOR SELECT TO authenticated
  USING (
    check_permission(auth.uid(), 'decoracao', 'view')
    AND EXISTS (
      SELECT 1 FROM public.decoracao_os o
      WHERE o.id = decoracao_os_itens.os_id
        AND (is_global_viewer() OR o.unit_id = ANY(get_user_unit_ids()))
    )
  );

CREATE POLICY "decoracao_os_itens: create" ON public.decoracao_os_itens
  FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'decoracao', 'edit')
    AND EXISTS (
      SELECT 1 FROM public.decoracao_os o
      WHERE o.id = decoracao_os_itens.os_id
        AND (is_global_viewer() OR o.unit_id = ANY(get_user_unit_ids()))
    )
  );

CREATE POLICY "decoracao_os_itens: edit" ON public.decoracao_os_itens
  FOR UPDATE TO authenticated
  USING (
    check_permission(auth.uid(), 'decoracao', 'edit')
    AND EXISTS (
      SELECT 1 FROM public.decoracao_os o
      WHERE o.id = decoracao_os_itens.os_id
        AND (is_global_viewer() OR o.unit_id = ANY(get_user_unit_ids()))
    )
  )
  WITH CHECK (
    check_permission(auth.uid(), 'decoracao', 'edit')
    AND EXISTS (
      SELECT 1 FROM public.decoracao_os o
      WHERE o.id = decoracao_os_itens.os_id
        AND (is_global_viewer() OR o.unit_id = ANY(get_user_unit_ids()))
    )
  );

CREATE POLICY "decoracao_os_itens: delete" ON public.decoracao_os_itens
  FOR DELETE TO authenticated
  USING (
    check_permission(auth.uid(), 'decoracao', 'edit')
    AND EXISTS (
      SELECT 1 FROM public.decoracao_os o
      WHERE o.id = decoracao_os_itens.os_id
        AND (is_global_viewer() OR o.unit_id = ANY(get_user_unit_ids()))
    )
  );

-- ── 5. RPCs ATÔMICAS ─────────────────────────────────────────
-- SECURITY INVOKER (default) — RLS vale naturalmente: a RPC só
-- consegue inserir/atualizar o que o usuário poderia inserir
-- diretamente via PostgREST. Não vira atalho de bypass.
-- Cada item é JSONB no array p_itens; o id é opcional (NULL = novo).

-- 5a. Cria ordem + itens em uma transação.
CREATE OR REPLACE FUNCTION public.create_decoracao_os_with_items(
  p_unit_id    uuid,
  p_data_festa date,
  p_hora_festa time,
  p_tema       text,
  p_tema_id    uuid,
  p_itens      jsonb       -- array de { balao_modelo_id, quantidade, observacoes, status, ordem }
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_os_id uuid;
  v_item  jsonb;
BEGIN
  IF p_tema IS NULL OR length(trim(p_tema)) = 0 THEN
    RAISE EXCEPTION 'tema_obrigatorio' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.decoracao_os (unit_id, data_festa, hora_festa, tema, tema_id, created_by)
  VALUES (p_unit_id, p_data_festa, p_hora_festa, trim(p_tema), p_tema_id, auth.uid())
  RETURNING id INTO v_os_id;

  IF p_itens IS NOT NULL AND jsonb_typeof(p_itens) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      INSERT INTO public.decoracao_os_itens (
        os_id, balao_modelo_id, quantidade, observacoes, status, ordem
      )
      VALUES (
        v_os_id,
        NULLIF(v_item->>'balao_modelo_id', '')::uuid,
        COALESCE((v_item->>'quantidade')::int, 1),
        NULLIF(v_item->>'observacoes', ''),
        COALESCE(v_item->>'status', 'aguardando_prova'),
        COALESCE((v_item->>'ordem')::int, 0)
      );
    END LOOP;
  END IF;

  RETURN v_os_id;
END;
$$;

-- 5b. Atualiza ordem + reconcilia itens (delete os removidos,
-- upsert os enviados) em uma transação. Item com id existente
-- é atualizado; sem id ou id NULL é inserido. Itens da ordem
-- que NÃO estão na lista enviada são deletados.
CREATE OR REPLACE FUNCTION public.update_decoracao_os_with_items(
  p_os_id      uuid,
  p_unit_id    uuid,
  p_data_festa date,
  p_hora_festa time,
  p_tema       text,
  p_tema_id    uuid,
  p_itens      jsonb       -- array de { id?, balao_modelo_id, quantidade, observacoes, status, ordem }
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item     jsonb;
  v_item_id  uuid;
  v_kept_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_tema IS NULL OR length(trim(p_tema)) = 0 THEN
    RAISE EXCEPTION 'tema_obrigatorio' USING ERRCODE = '22023';
  END IF;

  UPDATE public.decoracao_os
  SET unit_id    = p_unit_id,
      data_festa = p_data_festa,
      hora_festa = p_hora_festa,
      tema       = trim(p_tema),
      tema_id    = p_tema_id
  WHERE id = p_os_id;

  -- A UPDATE acima é gated pela RLS edit. Se a RLS bloquear, o
  -- ROW COUNT é 0 mas não há exceção. Validamos abaixo:
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ordem_nao_encontrada_ou_sem_permissao' USING ERRCODE = '42501';
  END IF;

  -- Upsert itens
  IF p_itens IS NOT NULL AND jsonb_typeof(p_itens) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      v_item_id := NULLIF(v_item->>'id', '')::uuid;

      IF v_item_id IS NULL THEN
        INSERT INTO public.decoracao_os_itens (
          os_id, balao_modelo_id, quantidade, observacoes, status, ordem
        )
        VALUES (
          p_os_id,
          NULLIF(v_item->>'balao_modelo_id', '')::uuid,
          COALESCE((v_item->>'quantidade')::int, 1),
          NULLIF(v_item->>'observacoes', ''),
          COALESCE(v_item->>'status', 'aguardando_prova'),
          COALESCE((v_item->>'ordem')::int, 0)
        )
        RETURNING id INTO v_item_id;
      ELSE
        UPDATE public.decoracao_os_itens
        SET balao_modelo_id = NULLIF(v_item->>'balao_modelo_id', '')::uuid,
            quantidade      = COALESCE((v_item->>'quantidade')::int, 1),
            observacoes     = NULLIF(v_item->>'observacoes', ''),
            status          = COALESCE(v_item->>'status', 'aguardando_prova'),
            ordem           = COALESCE((v_item->>'ordem')::int, 0)
        WHERE id = v_item_id AND os_id = p_os_id;
      END IF;

      v_kept_ids := v_kept_ids || v_item_id;
    END LOOP;
  END IF;

  -- Apaga itens que estavam na ordem mas não vieram na lista
  DELETE FROM public.decoracao_os_itens
  WHERE os_id = p_os_id
    AND id <> ALL (v_kept_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_decoracao_os_with_items(uuid, date, time, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_decoracao_os_with_items(uuid, uuid, date, time, text, uuid, jsonb) TO authenticated;

-- ── 6. Recarregar schema do PostgREST ────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;
