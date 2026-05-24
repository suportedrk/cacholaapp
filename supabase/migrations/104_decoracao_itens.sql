-- ============================================================
-- Migration 104 — Módulo Decoração: Itens com Variações
-- Objetivo: catálogo de itens (item-pai) + variações (filho)
-- Item-pai: nome, foto, tipo (proprio|alugado), fornecedor (só alugado),
-- observacoes, ativo. Variação: tamanho/cor/detalhe (ao menos um) +
-- código UNIQUE auto-gerado via sequência ('DEC-NNNNNN').
-- RPCs SECURITY INVOKER para gravação atômica (item + variações).
-- Bucket privado 'decoracao-itens' no padrão da 099.
-- ============================================================

BEGIN;

-- ── 1. Tabela item-pai ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.decoracao_itens (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT        NOT NULL,
  tipo            TEXT        NOT NULL,
  fornecedor_id   UUID        NULL REFERENCES public.decoracao_fornecedores(id) ON DELETE SET NULL,
  foto_path       TEXT        NULL,
  observacoes     TEXT        NULL,
  ativo           BOOLEAN     NOT NULL DEFAULT true,
  created_by      UUID        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_decoracao_itens_tipo CHECK (tipo IN ('proprio', 'alugado')),
  CONSTRAINT chk_decoracao_itens_fornecedor_por_tipo CHECK (
    (tipo = 'proprio'  AND fornecedor_id IS NULL) OR
    (tipo = 'alugado')
  )
);

CREATE INDEX IF NOT EXISTS idx_decoracao_itens_ativo
  ON public.decoracao_itens (ativo);

CREATE INDEX IF NOT EXISTS idx_decoracao_itens_nome
  ON public.decoracao_itens (nome);

CREATE INDEX IF NOT EXISTS idx_decoracao_itens_fornecedor
  ON public.decoracao_itens (fornecedor_id) WHERE fornecedor_id IS NOT NULL;

-- ── 2. Sequência para o código das variações ────────────────

CREATE SEQUENCE IF NOT EXISTS public.decoracao_variacao_codigo_seq
  START WITH 1 INCREMENT BY 1;

-- ── 3. Tabela variações ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.decoracao_item_variacoes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID        NOT NULL REFERENCES public.decoracao_itens(id) ON DELETE CASCADE,
  tamanho     TEXT        NULL,
  cor         TEXT        NULL,
  detalhe     TEXT        NULL,
  codigo      TEXT        NOT NULL UNIQUE DEFAULT (
    'DEC-' || lpad(nextval('public.decoracao_variacao_codigo_seq')::text, 6, '0')
  ),
  ordem       INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_decoracao_variacao_ao_menos_um CHECK (
    COALESCE(NULLIF(trim(tamanho), ''), NULLIF(trim(cor), ''), NULLIF(trim(detalhe), '')) IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_decoracao_item_variacoes_item
  ON public.decoracao_item_variacoes (item_id);

-- ── 4. GRANTS (papel authenticated do PostgREST) ─────────────

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.decoracao_itens TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.decoracao_item_variacoes TO authenticated;

GRANT USAGE ON SEQUENCE public.decoracao_variacao_codigo_seq TO authenticated;

-- ── 5. Triggers updated_at ───────────────────────────────────

CREATE OR REPLACE TRIGGER trg_decoracao_itens_updated_at
  BEFORE UPDATE ON public.decoracao_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE TRIGGER trg_decoracao_item_variacoes_updated_at
  BEFORE UPDATE ON public.decoracao_item_variacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 6. RLS — decoracao_itens ─────────────────────────────────

ALTER TABLE public.decoracao_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "decoracao_itens: view"   ON public.decoracao_itens;
DROP POLICY IF EXISTS "decoracao_itens: create" ON public.decoracao_itens;
DROP POLICY IF EXISTS "decoracao_itens: edit"   ON public.decoracao_itens;
DROP POLICY IF EXISTS "decoracao_itens: delete" ON public.decoracao_itens;

CREATE POLICY "decoracao_itens: view"
  ON public.decoracao_itens FOR SELECT TO authenticated
  USING (is_global_viewer() OR check_permission(auth.uid(), 'decoracao', 'view'));

CREATE POLICY "decoracao_itens: create"
  ON public.decoracao_itens FOR INSERT TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'create'));

CREATE POLICY "decoracao_itens: edit"
  ON public.decoracao_itens FOR UPDATE TO authenticated
  USING  (check_permission(auth.uid(), 'decoracao', 'edit'))
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_itens: delete"
  ON public.decoracao_itens FOR DELETE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'delete'));

-- ── 7. RLS — decoracao_item_variacoes ────────────────────────

ALTER TABLE public.decoracao_item_variacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "decoracao_item_variacoes: view"   ON public.decoracao_item_variacoes;
DROP POLICY IF EXISTS "decoracao_item_variacoes: create" ON public.decoracao_item_variacoes;
DROP POLICY IF EXISTS "decoracao_item_variacoes: edit"   ON public.decoracao_item_variacoes;
DROP POLICY IF EXISTS "decoracao_item_variacoes: delete" ON public.decoracao_item_variacoes;

CREATE POLICY "decoracao_item_variacoes: view"
  ON public.decoracao_item_variacoes FOR SELECT TO authenticated
  USING (is_global_viewer() OR check_permission(auth.uid(), 'decoracao', 'view'));

CREATE POLICY "decoracao_item_variacoes: create"
  ON public.decoracao_item_variacoes FOR INSERT TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'create'));

CREATE POLICY "decoracao_item_variacoes: edit"
  ON public.decoracao_item_variacoes FOR UPDATE TO authenticated
  USING  (check_permission(auth.uid(), 'decoracao', 'edit'))
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_item_variacoes: delete"
  ON public.decoracao_item_variacoes FOR DELETE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'delete'));

-- ── 8. RPCs atômicas (SECURITY INVOKER — RLS aplica naturalmente) ──
-- Padrão idêntico ao create/update_decoracao_os_with_items (mig. 100).
-- Variação: id opcional. Se omitido → INSERT (codigo via DEFAULT).
-- Se id presente → UPDATE. IDs ausentes na lista enviada → DELETE.

CREATE OR REPLACE FUNCTION public.create_decoracao_item_with_variacoes(
  p_nome          text,
  p_tipo          text,
  p_fornecedor_id uuid,
  p_foto_path     text,
  p_observacoes   text,
  p_ativo         boolean,
  p_variacoes     jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item_id uuid;
  v_var     jsonb;
  v_fornecedor uuid;
BEGIN
  IF p_nome IS NULL OR length(trim(p_nome)) = 0 THEN
    RAISE EXCEPTION 'nome_obrigatorio' USING ERRCODE = '22023';
  END IF;
  IF p_tipo NOT IN ('proprio', 'alugado') THEN
    RAISE EXCEPTION 'tipo_invalido' USING ERRCODE = '22023';
  END IF;
  IF p_variacoes IS NULL OR jsonb_typeof(p_variacoes) <> 'array' OR jsonb_array_length(p_variacoes) = 0 THEN
    RAISE EXCEPTION 'pelo_menos_uma_variacao' USING ERRCODE = '22023';
  END IF;

  -- tipo=proprio → fornecedor sempre NULL (espelha o CHECK constraint)
  v_fornecedor := CASE WHEN p_tipo = 'proprio' THEN NULL ELSE p_fornecedor_id END;

  INSERT INTO public.decoracao_itens (
    nome, tipo, fornecedor_id, foto_path, observacoes, ativo, created_by
  )
  VALUES (
    trim(p_nome), p_tipo, v_fornecedor,
    NULLIF(p_foto_path, ''), NULLIF(p_observacoes, ''),
    COALESCE(p_ativo, true), auth.uid()
  )
  RETURNING id INTO v_item_id;

  FOR v_var IN SELECT * FROM jsonb_array_elements(p_variacoes)
  LOOP
    INSERT INTO public.decoracao_item_variacoes (
      item_id, tamanho, cor, detalhe, ordem
    )
    VALUES (
      v_item_id,
      NULLIF(trim(v_var->>'tamanho'), ''),
      NULLIF(trim(v_var->>'cor'),     ''),
      NULLIF(trim(v_var->>'detalhe'), ''),
      COALESCE((v_var->>'ordem')::int, 0)
    );
  END LOOP;

  RETURN v_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_decoracao_item_with_variacoes(
  p_id            uuid,
  p_nome          text,
  p_tipo          text,
  p_fornecedor_id uuid,
  p_foto_path     text,
  p_observacoes   text,
  p_ativo         boolean,
  p_variacoes     jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_var        jsonb;
  v_var_id     uuid;
  v_kept_ids   uuid[] := ARRAY[]::uuid[];
  v_fornecedor uuid;
BEGIN
  IF p_nome IS NULL OR length(trim(p_nome)) = 0 THEN
    RAISE EXCEPTION 'nome_obrigatorio' USING ERRCODE = '22023';
  END IF;
  IF p_tipo NOT IN ('proprio', 'alugado') THEN
    RAISE EXCEPTION 'tipo_invalido' USING ERRCODE = '22023';
  END IF;
  IF p_variacoes IS NULL OR jsonb_typeof(p_variacoes) <> 'array' OR jsonb_array_length(p_variacoes) = 0 THEN
    RAISE EXCEPTION 'pelo_menos_uma_variacao' USING ERRCODE = '22023';
  END IF;

  v_fornecedor := CASE WHEN p_tipo = 'proprio' THEN NULL ELSE p_fornecedor_id END;

  UPDATE public.decoracao_itens
  SET nome          = trim(p_nome),
      tipo          = p_tipo,
      fornecedor_id = v_fornecedor,
      foto_path     = NULLIF(p_foto_path, ''),
      observacoes   = NULLIF(p_observacoes, ''),
      ativo         = COALESCE(p_ativo, true)
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_nao_encontrado_ou_sem_permissao' USING ERRCODE = '42501';
  END IF;

  -- Reconcilia variações: upsert + delete dos ausentes
  FOR v_var IN SELECT * FROM jsonb_array_elements(p_variacoes)
  LOOP
    v_var_id := NULLIF(v_var->>'id', '')::uuid;

    IF v_var_id IS NULL THEN
      INSERT INTO public.decoracao_item_variacoes (
        item_id, tamanho, cor, detalhe, ordem
      )
      VALUES (
        p_id,
        NULLIF(trim(v_var->>'tamanho'), ''),
        NULLIF(trim(v_var->>'cor'),     ''),
        NULLIF(trim(v_var->>'detalhe'), ''),
        COALESCE((v_var->>'ordem')::int, 0)
      )
      RETURNING id INTO v_var_id;
    ELSE
      UPDATE public.decoracao_item_variacoes
      SET tamanho = NULLIF(trim(v_var->>'tamanho'), ''),
          cor     = NULLIF(trim(v_var->>'cor'),     ''),
          detalhe = NULLIF(trim(v_var->>'detalhe'), ''),
          ordem   = COALESCE((v_var->>'ordem')::int, 0)
      WHERE id = v_var_id AND item_id = p_id;
    END IF;

    v_kept_ids := v_kept_ids || v_var_id;
  END LOOP;

  DELETE FROM public.decoracao_item_variacoes
  WHERE item_id = p_id AND NOT (id = ANY(v_kept_ids));
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_decoracao_item_with_variacoes(text, text, uuid, text, text, boolean, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_decoracao_item_with_variacoes(uuid, text, text, uuid, text, text, boolean, jsonb) TO authenticated;

-- ── 9. Bucket privado 'decoracao-itens' + policies (padrão 099) ──

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'decoracao-itens',
  'decoracao-itens',
  false,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "decoracao-itens: authenticated select" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-itens: authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-itens: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-itens: authenticated delete" ON storage.objects;

CREATE POLICY "decoracao-itens: authenticated select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'decoracao-itens');

CREATE POLICY "decoracao-itens: authenticated insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'decoracao-itens');

CREATE POLICY "decoracao-itens: authenticated update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'decoracao-itens');

CREATE POLICY "decoracao-itens: authenticated delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'decoracao-itens');

-- ── 10. Reload schema PostgREST ──────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
