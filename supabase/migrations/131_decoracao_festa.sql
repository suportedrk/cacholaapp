-- ============================================================
-- Migration 131 — Decoração Bloco C: Festa Puxa o Tema
-- Vincular um tema a uma festa (evento) PUXA a receita do tema como
-- uma lista EDITÁVEL de itens da festa (SNAPSHOT — cópia, não vínculo
-- vivo). Permite trocar a foto na festa (override) e gerar romaneio.
--
-- DECISÃO TRAVADA: SEM reserva/baixa de estoque ao puxar. A decoração
-- vai e volta; a baixa fica para o encerramento (Bloco D).
--
-- Snapshot: ao vincular, COPIA decoracao_tema_itens → decoracao_festa_itens.
-- Editar a festa NÃO altera a receita do tema; mudar a receita depois
-- NÃO altera festas já montadas. Re-vincular substitui a lista.
--
-- RLS (espelha o Bloco B / migration 130):
--   decoracao_festa        → SELECT='view', INSERT='create',
--                            UPDATE='edit', DELETE='delete'
--   decoracao_festa_itens  → SELECT='view', INSERT/UPDATE/DELETE='edit'
--   (filha: mexer na lista é EDITAR a decoração; gatear DELETE por
--    'delete' quebraria a reconciliação para cargos edit-only —
--    gerente/decoracao têm view/create/edit mas NÃO delete.)
--
-- Foto override: bucket privado decoracao-festa (espelha mig 099). Sem
-- override, a UI herda a foto modelo do tema (decoracao_temas.foto_url,
-- bucket decoracao-temas).
--
-- Rollback: 131_decoracao_festa_rollback.sql
-- ============================================================

BEGIN;

-- ── 1. Tabela decoracao_festa (1 por evento) ─────────────────

CREATE TABLE IF NOT EXISTS public.decoracao_festa (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  tema_id     uuid        REFERENCES public.decoracao_temas(id) ON DELETE RESTRICT,
  foto_path   text,
  observacoes text,
  created_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Tabela decoracao_festa_itens (filha) ───────────────────

CREATE TABLE IF NOT EXISTS public.decoracao_festa_itens (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  festa_decoracao_id uuid        NOT NULL REFERENCES public.decoracao_festa(id) ON DELETE CASCADE,
  variacao_id        uuid        NOT NULL REFERENCES public.decoracao_item_variacoes(id) ON DELETE RESTRICT,
  quantidade         int         NOT NULL CHECK (quantidade > 0),
  ordem              int         NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_decoracao_festa_itens_festa_variacao UNIQUE (festa_decoracao_id, variacao_id)
);

-- ── 3. Índices ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_decoracao_festa_event
  ON public.decoracao_festa (event_id);
CREATE INDEX IF NOT EXISTS idx_decoracao_festa_tema
  ON public.decoracao_festa (tema_id);
CREATE INDEX IF NOT EXISTS idx_decoracao_festa_itens_festa
  ON public.decoracao_festa_itens (festa_decoracao_id);
CREATE INDEX IF NOT EXISTS idx_decoracao_festa_itens_variacao
  ON public.decoracao_festa_itens (variacao_id);

-- ── 4. GRANT (papel authenticated do PostgREST) ───────────────
-- Sem GRANT explícito o PostgREST retorna "permission denied" ANTES
-- de avaliar a RLS.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decoracao_festa       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decoracao_festa_itens TO authenticated;

-- ── 5. Triggers updated_at ────────────────────────────────────

CREATE OR REPLACE TRIGGER trg_decoracao_festa_updated_at
  BEFORE UPDATE ON public.decoracao_festa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE TRIGGER trg_decoracao_festa_itens_updated_at
  BEFORE UPDATE ON public.decoracao_festa_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 6. RLS — decoracao_festa ──────────────────────────────────
-- check_permission() — 3 args. CRUD separado (create/edit/delete),
-- como decoracao_temas (mig 128).

ALTER TABLE public.decoracao_festa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "decoracao_festa: view"   ON public.decoracao_festa;
DROP POLICY IF EXISTS "decoracao_festa: insert" ON public.decoracao_festa;
DROP POLICY IF EXISTS "decoracao_festa: update" ON public.decoracao_festa;
DROP POLICY IF EXISTS "decoracao_festa: delete" ON public.decoracao_festa;

CREATE POLICY "decoracao_festa: view"
  ON public.decoracao_festa FOR SELECT TO authenticated
  USING (is_global_viewer() OR check_permission(auth.uid(), 'decoracao', 'view'));

CREATE POLICY "decoracao_festa: insert"
  ON public.decoracao_festa FOR INSERT TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'create'));

CREATE POLICY "decoracao_festa: update"
  ON public.decoracao_festa FOR UPDATE TO authenticated
  USING      (check_permission(auth.uid(), 'decoracao', 'edit'))
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_festa: delete"
  ON public.decoracao_festa FOR DELETE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'delete'));

-- ── 7. RLS — decoracao_festa_itens (filha) ────────────────────
-- INSERT/UPDATE/DELETE gateados por 'edit' (lição Bloco B): mexer na
-- lista da festa = EDITAR a decoração.

ALTER TABLE public.decoracao_festa_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "decoracao_festa_itens: view"   ON public.decoracao_festa_itens;
DROP POLICY IF EXISTS "decoracao_festa_itens: insert" ON public.decoracao_festa_itens;
DROP POLICY IF EXISTS "decoracao_festa_itens: update" ON public.decoracao_festa_itens;
DROP POLICY IF EXISTS "decoracao_festa_itens: delete" ON public.decoracao_festa_itens;

CREATE POLICY "decoracao_festa_itens: view"
  ON public.decoracao_festa_itens FOR SELECT TO authenticated
  USING (is_global_viewer() OR check_permission(auth.uid(), 'decoracao', 'view'));

CREATE POLICY "decoracao_festa_itens: insert"
  ON public.decoracao_festa_itens FOR INSERT TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_festa_itens: update"
  ON public.decoracao_festa_itens FOR UPDATE TO authenticated
  USING      (check_permission(auth.uid(), 'decoracao', 'edit'))
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_festa_itens: delete"
  ON public.decoracao_festa_itens FOR DELETE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'edit'));

-- ── 8. Bucket decoracao-festa (foto override) ─────────────────
-- Privado, espelha o padrão da mig 099. RLS authenticated por bucket_id.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'decoracao-festa',
  'decoracao-festa',
  false,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "decoracao-festa: authenticated select" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-festa: authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-festa: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-festa: authenticated delete" ON storage.objects;

CREATE POLICY "decoracao-festa: authenticated select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'decoracao-festa');

CREATE POLICY "decoracao-festa: authenticated insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'decoracao-festa');

CREATE POLICY "decoracao-festa: authenticated update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'decoracao-festa');

CREATE POLICY "decoracao-festa: authenticated delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'decoracao-festa');

-- ── 9. RPC vincular_tema_festa — SNAPSHOT ─────────────────────
-- SECURITY INVOKER (default) — a RLS acima aplica ao caller.
-- Cria/atualiza decoracao_festa e COPIA a receita do tema para
-- decoracao_festa_itens (delete-all + insert). Re-vincular substitui.
-- Tema com receita vazia → 0 itens (não é erro).

CREATE OR REPLACE FUNCTION public.vincular_tema_festa(
  p_event_id uuid,
  p_tema_id  uuid
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_festa_id uuid;
BEGIN
  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'evento_obrigatorio' USING ERRCODE = '22023';
  END IF;
  IF p_tema_id IS NULL THEN
    RAISE EXCEPTION 'tema_obrigatorio' USING ERRCODE = '22023';
  END IF;

  -- Cria a decoração da festa (1 por evento) ou atualiza o tema.
  INSERT INTO public.decoracao_festa (event_id, tema_id, created_by)
  VALUES (p_event_id, p_tema_id, auth.uid())
  ON CONFLICT (event_id) DO UPDATE
    SET tema_id = EXCLUDED.tema_id
  RETURNING id INTO v_festa_id;

  -- SNAPSHOT: substitui a lista pela receita atual do tema.
  DELETE FROM public.decoracao_festa_itens
  WHERE festa_decoracao_id = v_festa_id;

  INSERT INTO public.decoracao_festa_itens (festa_decoracao_id, variacao_id, quantidade, ordem)
  SELECT v_festa_id, ti.variacao_id, ti.quantidade, ti.ordem
  FROM public.decoracao_tema_itens ti
  WHERE ti.tema_id = p_tema_id;

  RETURN v_festa_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vincular_tema_festa(uuid, uuid) TO authenticated;

-- ── 10. RPC update_festa_decoracao_itens — reconciliação ──────
-- SECURITY INVOKER. Espelha update_tema_receita (mig 130): upsert por
-- (festa_decoracao_id, variacao_id) + delete dos ausentes, sem órfãos.

CREATE OR REPLACE FUNCTION public.update_festa_decoracao_itens(
  p_festa_decoracao_id uuid,
  p_itens              jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item     jsonb;
  v_var_id   uuid;
  v_qtd      int;
  v_ordem    int;
  v_kept_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_festa_decoracao_id IS NULL THEN
    RAISE EXCEPTION 'festa_obrigatoria' USING ERRCODE = '22023';
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

    INSERT INTO public.decoracao_festa_itens (festa_decoracao_id, variacao_id, quantidade, ordem)
    VALUES (p_festa_decoracao_id, v_var_id, v_qtd, v_ordem)
    ON CONFLICT (festa_decoracao_id, variacao_id) DO UPDATE
      SET quantidade = EXCLUDED.quantidade,
          ordem      = EXCLUDED.ordem;

    v_kept_ids := v_kept_ids || v_var_id;
  END LOOP;

  DELETE FROM public.decoracao_festa_itens
  WHERE festa_decoracao_id = p_festa_decoracao_id
    AND NOT (variacao_id = ANY(v_kept_ids));
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_festa_decoracao_itens(uuid, jsonb) TO authenticated;

-- ── 11. Reload schema PostgREST ───────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
