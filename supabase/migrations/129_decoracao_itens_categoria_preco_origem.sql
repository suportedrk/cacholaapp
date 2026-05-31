-- ============================================================
-- Migration 129 — Decoração: itens ganham categoria, preços e origem
-- Bloco A2. Faz parte do Bloco A (deploy junto com A1 como v1.33.0).
--
-- FRENTE 1 (feature):
--   - categoria_id  → FK decoracao_categorias (NULL no banco, obrigatório na UI)
--   - preco_custo / preco_venda numeric(12,2) NOT NULL DEFAULT 0
--   - refactor tipo (proprio|alugado) → origem (acervo|fornecedor)
--
-- Ordem estrita DDL→DML→DDL (lição mig 072): DROP constraints →
-- ADD colunas/RENAME → UPDATE dados → ADD novo CHECK.
--
-- Mapeamento de dados:
--   proprio                       → acervo
--   alugado COM fornecedor        → fornecedor
--   alugado SEM fornecedor (órfão) → acervo  (decisão aprovada: o novo
--     CHECK exige fornecedor_id NOT NULL quando origem='fornecedor';
--     mapear órfãos para acervo é defensivo p/ qualquer contagem em prod)
--
-- RPCs: DROP + CREATE (NÃO replace) — a assinatura muda, então
-- CREATE OR REPLACE criaria overload duplicado. Corpo copiado verbatim
-- do banco vivo (pg_get_functiondef), trocando só origem/categoria/preços.
-- ============================================================

BEGIN;

-- ── 1. DROP constraints antigas (libera os UPDATEs) ───────────

ALTER TABLE public.decoracao_itens
  DROP CONSTRAINT IF EXISTS chk_decoracao_itens_tipo,
  DROP CONSTRAINT IF EXISTS chk_decoracao_itens_fornecedor_por_tipo;

-- ── 2. ADD colunas novas ──────────────────────────────────────

ALTER TABLE public.decoracao_itens
  ADD COLUMN IF NOT EXISTS categoria_id UUID NULL
    REFERENCES public.decoracao_categorias(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS preco_custo NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preco_venda NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ── 3. RENAME tipo → origem ───────────────────────────────────

ALTER TABLE public.decoracao_itens RENAME COLUMN tipo TO origem;

-- ── 4. UPDATE migração de dados (proprio/alugado → acervo/fornecedor) ──

UPDATE public.decoracao_itens
SET origem = CASE
  WHEN origem = 'alugado' AND fornecedor_id IS NOT NULL THEN 'fornecedor'
  ELSE 'acervo'  -- proprio, ou alugado órfão sem fornecedor
END;

-- ── 5. ADD novo CHECK (origem × fornecedor) ──────────────────

ALTER TABLE public.decoracao_itens
  ADD CONSTRAINT chk_decoracao_itens_origem
    CHECK (origem IN ('acervo', 'fornecedor')),
  ADD CONSTRAINT chk_decoracao_itens_fornecedor_por_origem CHECK (
    (origem = 'acervo'     AND fornecedor_id IS NULL) OR
    (origem = 'fornecedor' AND fornecedor_id IS NOT NULL)
  );

-- ── 5b. Índice em categoria_id ────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_decoracao_itens_categoria
  ON public.decoracao_itens (categoria_id) WHERE categoria_id IS NOT NULL;

-- ── 6. DROP RPCs antigas (assinatura de 7/8 args) ─────────────

DROP FUNCTION IF EXISTS public.create_decoracao_item_with_variacoes(text, text, uuid, text, text, boolean, jsonb);
DROP FUNCTION IF EXISTS public.update_decoracao_item_with_variacoes(uuid, text, text, uuid, text, text, boolean, jsonb);

-- ── 7. CREATE RPC create (nova assinatura) ────────────────────

CREATE FUNCTION public.create_decoracao_item_with_variacoes(
  p_nome          text,
  p_origem        text,
  p_fornecedor_id uuid,
  p_categoria_id  uuid,
  p_preco_custo   numeric,
  p_preco_venda   numeric,
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
  IF p_origem NOT IN ('acervo', 'fornecedor') THEN
    RAISE EXCEPTION 'origem_invalida' USING ERRCODE = '22023';
  END IF;
  IF p_variacoes IS NULL OR jsonb_typeof(p_variacoes) <> 'array' OR jsonb_array_length(p_variacoes) = 0 THEN
    RAISE EXCEPTION 'pelo_menos_uma_variacao' USING ERRCODE = '22023';
  END IF;

  -- origem=acervo → fornecedor sempre NULL (espelha o CHECK constraint)
  v_fornecedor := CASE WHEN p_origem = 'acervo' THEN NULL ELSE p_fornecedor_id END;

  INSERT INTO public.decoracao_itens (
    nome, origem, fornecedor_id, categoria_id, preco_custo, preco_venda,
    foto_path, observacoes, ativo, created_by
  )
  VALUES (
    trim(p_nome), p_origem, v_fornecedor, p_categoria_id,
    COALESCE(p_preco_custo, 0), COALESCE(p_preco_venda, 0),
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

-- ── 8. CREATE RPC update (nova assinatura) ────────────────────

CREATE FUNCTION public.update_decoracao_item_with_variacoes(
  p_id            uuid,
  p_nome          text,
  p_origem        text,
  p_fornecedor_id uuid,
  p_categoria_id  uuid,
  p_preco_custo   numeric,
  p_preco_venda   numeric,
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
  IF p_origem NOT IN ('acervo', 'fornecedor') THEN
    RAISE EXCEPTION 'origem_invalida' USING ERRCODE = '22023';
  END IF;
  IF p_variacoes IS NULL OR jsonb_typeof(p_variacoes) <> 'array' OR jsonb_array_length(p_variacoes) = 0 THEN
    RAISE EXCEPTION 'pelo_menos_uma_variacao' USING ERRCODE = '22023';
  END IF;

  v_fornecedor := CASE WHEN p_origem = 'acervo' THEN NULL ELSE p_fornecedor_id END;

  UPDATE public.decoracao_itens
  SET nome          = trim(p_nome),
      origem        = p_origem,
      fornecedor_id = v_fornecedor,
      categoria_id  = p_categoria_id,
      preco_custo   = COALESCE(p_preco_custo, 0),
      preco_venda   = COALESCE(p_preco_venda, 0),
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

-- ── 9. GRANT EXECUTE nas novas assinaturas ───────────────────

GRANT EXECUTE ON FUNCTION public.create_decoracao_item_with_variacoes(text, text, uuid, uuid, numeric, numeric, text, text, boolean, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_decoracao_item_with_variacoes(uuid, text, text, uuid, uuid, numeric, numeric, text, text, boolean, jsonb) TO authenticated;

-- ── 10. Reload schema PostgREST ───────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
