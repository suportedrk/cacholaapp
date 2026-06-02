-- ══════════════════════════════════════════════════════════════
-- Rollback 142 — Remove foto_path de decoracao_item_variacoes
-- e restaura os corpos verbatim originais das duas RPCs.
-- ══════════════════════════════════════════════════════════════

-- ── 1. Remove a coluna ────────────────────────────────────────

ALTER TABLE public.decoracao_item_variacoes
  DROP COLUMN IF EXISTS foto_path;

-- ── 2. Restaurar create_decoracao_item_with_variacoes ─────────
-- Corpo verbatim conforme migration 104 / pg_get_functiondef.

CREATE OR REPLACE FUNCTION public.create_decoracao_item_with_variacoes(
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
SET search_path TO 'public'
AS $function$
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
$function$;

-- ── 3. Restaurar update_decoracao_item_with_variacoes ─────────
-- Corpo verbatim conforme migration 104 / pg_get_functiondef.

CREATE OR REPLACE FUNCTION public.update_decoracao_item_with_variacoes(
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
SET search_path TO 'public'
AS $function$
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
$function$;

-- ── 4. Notifica PostgREST ─────────────────────────────────────

NOTIFY pgrst, 'reload schema';
