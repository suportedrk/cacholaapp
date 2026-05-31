-- ============================================================
-- Migration 130 — Decoração Bloco B: Tema vira Receita
-- Cada tema (catálogo) ganha uma "receita": lista de variações de
-- item + quantidade que compõem a "mesa padrão" do tema.
--
-- Tabela GLOBAL (sem unit_id), padrão dos catálogos decoracao_*.
-- A foto "modelo" é a foto que o tema JÁ tem (decoracao_temas.foto_url) —
-- nada de foto nova aqui.
--
-- RLS (espelha o VÍNCULO decoracao_tema_forminhas da 097, NÃO o
-- padrão create/edit/delete separado da 128):
--   SELECT             → 'view'
--   INSERT/UPDATE/DELETE → 'edit'
-- Motivo: mexer na receita é EDITAR o tema. gerente/decoracao têm
-- view/create/edit mas NÃO delete (seed 097). Como o RPC é INVOKER, a
-- RLS aplica ao caller — gatear DELETE por 'delete' quebraria a
-- reconciliação (remoção de linha) para esses cargos.
--
-- Gravação atômica via RPC update_tema_receita (SECURITY INVOKER,
-- estilo dos RPCs de item da 129): upsert por (tema_id, variacao_id) +
-- delete dos ausentes, numa única transação. Evita linhas órfãs.
--
-- Rollback: 130_decoracao_tema_receita_rollback.sql
-- ============================================================

BEGIN;

-- ── 1. Tabela ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.decoracao_tema_itens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tema_id     uuid        NOT NULL REFERENCES public.decoracao_temas(id) ON DELETE CASCADE,
  variacao_id uuid        NOT NULL REFERENCES public.decoracao_item_variacoes(id) ON DELETE RESTRICT,
  quantidade  int         NOT NULL CHECK (quantidade > 0),
  ordem       int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_decoracao_tema_itens_tema_variacao UNIQUE (tema_id, variacao_id)
);

-- ── 1b. Índices ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_decoracao_tema_itens_tema
  ON public.decoracao_tema_itens (tema_id);
CREATE INDEX IF NOT EXISTS idx_decoracao_tema_itens_variacao
  ON public.decoracao_tema_itens (variacao_id);

-- ── 1c. GRANT (papel authenticated do PostgREST) ──────────────
-- Sem GRANT explícito o PostgREST retorna "permission denied" ANTES
-- de avaliar a RLS.

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.decoracao_tema_itens TO authenticated;

-- ── 2. Trigger updated_at ─────────────────────────────────────

CREATE OR REPLACE TRIGGER trg_decoracao_tema_itens_updated_at
  BEFORE UPDATE ON public.decoracao_tema_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 3. RLS ───────────────────────────────────────────────────
-- Tabela global. check_permission() — 3 args. INSERT/UPDATE/DELETE
-- gateados por 'edit' (gerenciar a receita = editar o tema).

ALTER TABLE public.decoracao_tema_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "decoracao_tema_itens: view"   ON public.decoracao_tema_itens;
DROP POLICY IF EXISTS "decoracao_tema_itens: insert" ON public.decoracao_tema_itens;
DROP POLICY IF EXISTS "decoracao_tema_itens: update" ON public.decoracao_tema_itens;
DROP POLICY IF EXISTS "decoracao_tema_itens: delete" ON public.decoracao_tema_itens;

CREATE POLICY "decoracao_tema_itens: view"
  ON public.decoracao_tema_itens FOR SELECT TO authenticated
  USING (is_global_viewer() OR check_permission(auth.uid(), 'decoracao', 'view'));

CREATE POLICY "decoracao_tema_itens: insert"
  ON public.decoracao_tema_itens FOR INSERT TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_tema_itens: update"
  ON public.decoracao_tema_itens FOR UPDATE TO authenticated
  USING      (check_permission(auth.uid(), 'decoracao', 'edit'))
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_tema_itens: delete"
  ON public.decoracao_tema_itens FOR DELETE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'edit'));

-- ── 4. RPC reconciliação atômica da receita ──────────────────
-- SECURITY INVOKER (default) — a RLS acima aplica ao caller.
-- Loop por linha (evita 21000 de ON CONFLICT multi-linha): upsert por
-- (tema_id, variacao_id), acumula kept-ids, depois remove os ausentes.

CREATE OR REPLACE FUNCTION public.update_tema_receita(
  p_tema_id uuid,
  p_itens   jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item      jsonb;
  v_var_id    uuid;
  v_qtd       int;
  v_ordem     int;
  v_kept_ids  uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_tema_id IS NULL THEN
    RAISE EXCEPTION 'tema_obrigatorio' USING ERRCODE = '22023';
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'itens_invalidos' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_var_id := NULLIF(v_item->>'variacao_id', '')::uuid;
    v_qtd    := COALESCE((v_item->>'quantidade')::int, 0);
    v_ordem  := COALESCE((v_item->>'ordem')::int, 0);

    IF v_var_id IS NULL THEN
      RAISE EXCEPTION 'variacao_obrigatoria' USING ERRCODE = '22023';
    END IF;
    IF v_qtd < 1 THEN
      RAISE EXCEPTION 'quantidade_invalida' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.decoracao_tema_itens (tema_id, variacao_id, quantidade, ordem)
    VALUES (p_tema_id, v_var_id, v_qtd, v_ordem)
    ON CONFLICT (tema_id, variacao_id) DO UPDATE
      SET quantidade = EXCLUDED.quantidade,
          ordem      = EXCLUDED.ordem;

    v_kept_ids := v_kept_ids || v_var_id;
  END LOOP;

  DELETE FROM public.decoracao_tema_itens
  WHERE tema_id = p_tema_id
    AND NOT (variacao_id = ANY(v_kept_ids));
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_tema_receita(uuid, jsonb) TO authenticated;

-- ── 5. Reload schema PostgREST ────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
