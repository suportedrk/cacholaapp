-- ============================================================
-- Rollback Migration 129 — itens: categoria, preços e origem
-- Reverte origem→tipo (acervo→proprio, fornecedor→alugado), remove
-- categoria_id/preços, e restaura as RPCs antigas (corpo verbatim da 104).
-- ============================================================

BEGIN;

-- ── 1. DROP novas RPCs ────────────────────────────────────────

DROP FUNCTION IF EXISTS public.create_decoracao_item_with_variacoes(text, text, uuid, uuid, numeric, numeric, text, text, boolean, jsonb);
DROP FUNCTION IF EXISTS public.update_decoracao_item_with_variacoes(uuid, text, text, uuid, uuid, numeric, numeric, text, text, boolean, jsonb);

-- ── 2. DROP constraints novas + índice ────────────────────────

ALTER TABLE public.decoracao_itens
  DROP CONSTRAINT IF EXISTS chk_decoracao_itens_origem,
  DROP CONSTRAINT IF EXISTS chk_decoracao_itens_fornecedor_por_origem;

DROP INDEX IF EXISTS public.idx_decoracao_itens_categoria;

-- ── 3. RENAME origem → tipo + UPDATE reverso ──────────────────

ALTER TABLE public.decoracao_itens RENAME COLUMN origem TO tipo;

UPDATE public.decoracao_itens
SET tipo = CASE WHEN tipo = 'fornecedor' THEN 'alugado' ELSE 'proprio' END;

-- ── 4. DROP colunas novas ─────────────────────────────────────

ALTER TABLE public.decoracao_itens
  DROP COLUMN IF EXISTS categoria_id,
  DROP COLUMN IF EXISTS preco_custo,
  DROP COLUMN IF EXISTS preco_venda;

-- ── 5. Restaura CHECK constraints antigas ─────────────────────

ALTER TABLE public.decoracao_itens
  ADD CONSTRAINT chk_decoracao_itens_tipo CHECK (tipo IN ('proprio', 'alugado')),
  ADD CONSTRAINT chk_decoracao_itens_fornecedor_por_tipo CHECK (
    (tipo = 'proprio'  AND fornecedor_id IS NULL) OR
    (tipo = 'alugado')
  );

-- ── 6. Restaura RPCs antigas (corpo verbatim da 104) ──────────

CREATE FUNCTION public.create_decoracao_item_with_variacoes(
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

CREATE FUNCTION public.update_decoracao_item_with_variacoes(
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

NOTIFY pgrst, 'reload schema';

COMMIT;
