-- supabase/migrations/106_decoracao_transferencias.sql
-- Objetivo: Bloco 4 do estoque de decoração — transferências (romaneio) entre locais.
-- Tabelas:
--   decoracao_transferencias          (cabeçalho da movimentação)
--   decoracao_transferencia_itens     (linhas: variação × quantidade)
-- Fluxo (3 RPCs SECURITY INVOKER, transacionais):
--   criar_transferencia    → SAI saldo da origem,    status = 'em_transito'
--   receber_transferencia  → ENTRA saldo no destino,  status = 'recebida'
--   cancelar_transferencia → DEVOLVE saldo à origem,  status = 'cancelada'
-- RLS global (sem unit_id), módulo 'decoracao'.

BEGIN;

-- ── Tabela: cabeçalho ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.decoracao_transferencias (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_local_id   UUID         NOT NULL
                                  REFERENCES public.decoracao_locais(id)
                                  ON DELETE RESTRICT,
  destino_local_id  UUID         NOT NULL
                                  REFERENCES public.decoracao_locais(id)
                                  ON DELETE RESTRICT,
  status            TEXT         NOT NULL DEFAULT 'em_transito'
                                  CHECK (status IN ('em_transito','recebida','cancelada')),
  observacoes       TEXT         NULL,
  created_by        UUID         NULL REFERENCES public.users(id) ON DELETE SET NULL,
  recebido_por      UUID         NULL REFERENCES public.users(id) ON DELETE SET NULL,
  data_envio        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  data_recebimento  TIMESTAMPTZ  NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT chk_transferencia_origem_destino CHECK (origem_local_id <> destino_local_id)
);

CREATE INDEX IF NOT EXISTS idx_transferencias_status
  ON public.decoracao_transferencias (status);

CREATE INDEX IF NOT EXISTS idx_transferencias_origem
  ON public.decoracao_transferencias (origem_local_id);

CREATE INDEX IF NOT EXISTS idx_transferencias_destino
  ON public.decoracao_transferencias (destino_local_id);

CREATE INDEX IF NOT EXISTS idx_transferencias_data_envio
  ON public.decoracao_transferencias (data_envio DESC);

-- ── Tabela: itens ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.decoracao_transferencia_itens (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  transferencia_id  UUID         NOT NULL
                                  REFERENCES public.decoracao_transferencias(id)
                                  ON DELETE CASCADE,
  variacao_id       UUID         NOT NULL
                                  REFERENCES public.decoracao_item_variacoes(id)
                                  ON DELETE RESTRICT,
  quantidade        INTEGER      NOT NULL CHECK (quantidade > 0),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transferencia_itens_transf
  ON public.decoracao_transferencia_itens (transferencia_id);

CREATE INDEX IF NOT EXISTS idx_transferencia_itens_variacao
  ON public.decoracao_transferencia_itens (variacao_id);

-- ── Trigger updated_at ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_transferencias_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transferencias_updated_at ON public.decoracao_transferencias;
CREATE TRIGGER trg_transferencias_updated_at
  BEFORE UPDATE ON public.decoracao_transferencias
  FOR EACH ROW EXECUTE FUNCTION public.trg_transferencias_updated_at();

-- ── GRANTS ────────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.decoracao_transferencias
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.decoracao_transferencia_itens
  TO authenticated;

-- ── RLS — padrão global dos catálogos de decoração ───────────────────────────

ALTER TABLE public.decoracao_transferencias       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decoracao_transferencia_itens  ENABLE ROW LEVEL SECURITY;

-- decoracao_transferencias --------------------------------------------------
DROP POLICY IF EXISTS "decoracao_transferencias: view"   ON public.decoracao_transferencias;
DROP POLICY IF EXISTS "decoracao_transferencias: create" ON public.decoracao_transferencias;
DROP POLICY IF EXISTS "decoracao_transferencias: edit"   ON public.decoracao_transferencias;
DROP POLICY IF EXISTS "decoracao_transferencias: delete" ON public.decoracao_transferencias;

CREATE POLICY "decoracao_transferencias: view"
  ON public.decoracao_transferencias FOR SELECT TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'view'));

CREATE POLICY "decoracao_transferencias: create"
  ON public.decoracao_transferencias FOR INSERT TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'create'));

CREATE POLICY "decoracao_transferencias: edit"
  ON public.decoracao_transferencias FOR UPDATE TO authenticated
  USING       (check_permission(auth.uid(), 'decoracao', 'edit'))
  WITH CHECK  (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_transferencias: delete"
  ON public.decoracao_transferencias FOR DELETE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'delete'));

-- decoracao_transferencia_itens --------------------------------------------
DROP POLICY IF EXISTS "decoracao_transferencia_itens: view"   ON public.decoracao_transferencia_itens;
DROP POLICY IF EXISTS "decoracao_transferencia_itens: create" ON public.decoracao_transferencia_itens;
DROP POLICY IF EXISTS "decoracao_transferencia_itens: edit"   ON public.decoracao_transferencia_itens;
DROP POLICY IF EXISTS "decoracao_transferencia_itens: delete" ON public.decoracao_transferencia_itens;

CREATE POLICY "decoracao_transferencia_itens: view"
  ON public.decoracao_transferencia_itens FOR SELECT TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'view'));

CREATE POLICY "decoracao_transferencia_itens: create"
  ON public.decoracao_transferencia_itens FOR INSERT TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'create'));

CREATE POLICY "decoracao_transferencia_itens: edit"
  ON public.decoracao_transferencia_itens FOR UPDATE TO authenticated
  USING       (check_permission(auth.uid(), 'decoracao', 'edit'))
  WITH CHECK  (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_transferencia_itens: delete"
  ON public.decoracao_transferencia_itens FOR DELETE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'delete'));

-- ── RPC 1: criar_transferencia ────────────────────────────────────────────────
-- p_itens: jsonb array de { variacao_id: uuid, quantidade: int }
-- Valida saldo na origem, decrementa origem (UPDATE), insere transfer + itens.
-- Atômico — qualquer erro aborta tudo via EXCEPTION.

CREATE OR REPLACE FUNCTION public.criar_transferencia(
  p_origem       UUID,
  p_destino      UUID,
  p_observacoes  TEXT,
  p_itens        JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_transferencia_id UUID;
  v_item             JSONB;
  v_variacao_id      UUID;
  v_quantidade       INT;
  v_saldo_atual      INT;
  v_codigo           TEXT;
BEGIN
  IF p_origem IS NULL OR p_destino IS NULL THEN
    RAISE EXCEPTION 'Origem e destino são obrigatórios.';
  END IF;

  IF p_origem = p_destino THEN
    RAISE EXCEPTION 'Origem e destino devem ser diferentes.';
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Inclua ao menos um item na transferência.';
  END IF;

  -- 1) Valida saldo na origem e DECREMENTA (transação atômica)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_variacao_id := (v_item->>'variacao_id')::UUID;
    v_quantidade  := (v_item->>'quantidade')::INT;

    IF v_variacao_id IS NULL OR v_quantidade IS NULL OR v_quantidade <= 0 THEN
      RAISE EXCEPTION 'Item inválido: variacao_id e quantidade (> 0) são obrigatórios.';
    END IF;

    SELECT quantidade INTO v_saldo_atual
      FROM public.decoracao_estoque_saldo
     WHERE variacao_id = v_variacao_id
       AND local_id    = p_origem
     FOR UPDATE;

    IF v_saldo_atual IS NULL THEN v_saldo_atual := 0; END IF;

    IF v_saldo_atual < v_quantidade THEN
      SELECT codigo INTO v_codigo
        FROM public.decoracao_item_variacoes WHERE id = v_variacao_id;

      RAISE EXCEPTION
        'Saldo insuficiente na origem para %: disponível % / solicitado %.',
        COALESCE(v_codigo, v_variacao_id::TEXT), v_saldo_atual, v_quantidade;
    END IF;

    -- Decrementa (linha já existe — saldo >= quantidade implica linha existe e > 0)
    UPDATE public.decoracao_estoque_saldo
       SET quantidade = quantidade - v_quantidade
     WHERE variacao_id = v_variacao_id
       AND local_id    = p_origem;
  END LOOP;

  -- 2) Cria o cabeçalho
  INSERT INTO public.decoracao_transferencias
    (origem_local_id, destino_local_id, status, observacoes, created_by)
  VALUES
    (p_origem, p_destino, 'em_transito', NULLIF(trim(p_observacoes), ''), auth.uid())
  RETURNING id INTO v_transferencia_id;

  -- 3) Cria os itens
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    INSERT INTO public.decoracao_transferencia_itens
      (transferencia_id, variacao_id, quantidade)
    VALUES
      (v_transferencia_id,
       (v_item->>'variacao_id')::UUID,
       (v_item->>'quantidade')::INT);
  END LOOP;

  RETURN v_transferencia_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_transferencia(UUID, UUID, TEXT, JSONB) TO authenticated;

-- ── RPC 2: receber_transferencia ──────────────────────────────────────────────
-- Soma saldo no destino (upsert), seta status = 'recebida'.

CREATE OR REPLACE FUNCTION public.receber_transferencia(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status          TEXT;
  v_destino         UUID;
  v_item            RECORD;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'ID da transferência é obrigatório.';
  END IF;

  SELECT status, destino_local_id
    INTO v_status, v_destino
    FROM public.decoracao_transferencias
   WHERE id = p_id
   FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Transferência não encontrada.';
  END IF;

  IF v_status <> 'em_transito' THEN
    RAISE EXCEPTION 'Só é possível receber transferências em trânsito (status atual: %).', v_status;
  END IF;

  FOR v_item IN
    SELECT variacao_id, quantidade
      FROM public.decoracao_transferencia_itens
     WHERE transferencia_id = p_id
  LOOP
    INSERT INTO public.decoracao_estoque_saldo (variacao_id, local_id, quantidade)
    VALUES (v_item.variacao_id, v_destino, v_item.quantidade)
    ON CONFLICT (variacao_id, local_id)
    DO UPDATE SET quantidade = decoracao_estoque_saldo.quantidade + EXCLUDED.quantidade;
  END LOOP;

  UPDATE public.decoracao_transferencias
     SET status            = 'recebida',
         data_recebimento  = now(),
         recebido_por      = auth.uid()
   WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.receber_transferencia(UUID) TO authenticated;

-- ── RPC 3: cancelar_transferencia ─────────────────────────────────────────────
-- Devolve saldo à origem (upsert), seta status = 'cancelada'.

CREATE OR REPLACE FUNCTION public.cancelar_transferencia(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status   TEXT;
  v_origem   UUID;
  v_item     RECORD;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'ID da transferência é obrigatório.';
  END IF;

  SELECT status, origem_local_id
    INTO v_status, v_origem
    FROM public.decoracao_transferencias
   WHERE id = p_id
   FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Transferência não encontrada.';
  END IF;

  IF v_status <> 'em_transito' THEN
    RAISE EXCEPTION 'Só é possível cancelar transferências em trânsito (status atual: %).', v_status;
  END IF;

  FOR v_item IN
    SELECT variacao_id, quantidade
      FROM public.decoracao_transferencia_itens
     WHERE transferencia_id = p_id
  LOOP
    INSERT INTO public.decoracao_estoque_saldo (variacao_id, local_id, quantidade)
    VALUES (v_item.variacao_id, v_origem, v_item.quantidade)
    ON CONFLICT (variacao_id, local_id)
    DO UPDATE SET quantidade = decoracao_estoque_saldo.quantidade + EXCLUDED.quantidade;
  END LOOP;

  UPDATE public.decoracao_transferencias
     SET status = 'cancelada'
   WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_transferencia(UUID) TO authenticated;

-- ── Reload PostgREST ──────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
