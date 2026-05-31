-- ============================================================
-- Migration 132 — Decoração Bloco D: Encerramento + Quarentena
-- No fim da festa, a equipe percorre os itens e registra o desfecho
-- de cada um (default "tudo OK"). Estoque (Opção 1 — itens não saíram
-- ao puxar): OK não mexe; quebrou/sumiu/quarentena dão BAIXA no saldo
-- do LOCAL escolhido; o que vai para quarentena também sai do disponível
-- e gera uma linha de quarentena para conserto/descarte.
--
-- Granularidade: POR ITEM COM QUANTIDADES. A soma dos quatro desfechos
-- (ok+quebrado+perdido+quarentena) de cada linha = quantidade da linha,
-- validada DENTRO do RPC (nunca via CHECK de coluna — linha aberta é
-- 0/0/0/0 e um CHECK rejeitaria o estado normal).
--
-- Baixa de estoque: GREATEST(0, saldo − baixa). O encerramento NUNCA
-- trava por saldo insuficiente; o saldo no máximo zera (decisão de
-- negócio — a festa aconteceu). Itens cuja baixa excedeu o saldo do
-- local voltam num array `avisos` (não-bloqueante).
--
-- Local da baixa: sempre o `p_local_id` explícito (a UI sugere por
-- best-effort casando o slug da unidade da festa com o nome do local;
-- o usuário confirma/troca).
--
-- RLS (padrão global decoracao; lição da tabela-filha do Bloco B):
--   colunas novas em decoracao_festa/itens → cobertas pela RLS existente.
--   decoracao_quarentena → SELECT='view', INSERT/UPDATE='edit'
--   (gerar/resolver = operar a decoração), DELETE='delete'.
--
-- RPCs SECURITY INVOKER (a RLS aplica ao caller; gerente/decoracao têm
-- view/create/edit e dão baixa/geram/resolvem normalmente):
--   encerrar_festa_decoracao(festa, itens jsonb, local) → jsonb {avisos}
--   resolver_quarentena(quarentena, resolucao, local)   → void
--
-- Sem "reabrir/desfazer" encerramento nesta versão (backlog).
--
-- Rollback: 132_decoracao_encerramento_quarentena_rollback.sql
-- ============================================================

BEGIN;

-- ── 1. Colunas de encerramento em decoracao_festa ─────────────

ALTER TABLE public.decoracao_festa
  ADD COLUMN IF NOT EXISTS status       text        NOT NULL DEFAULT 'aberta'
                                          CHECK (status IN ('aberta', 'encerrada')),
  ADD COLUMN IF NOT EXISTS encerrada_em timestamptz,
  ADD COLUMN IF NOT EXISTS encerrada_by uuid        REFERENCES public.users(id) ON DELETE SET NULL;

-- ── 2. Colunas de desfecho em decoracao_festa_itens ───────────
-- Pré-encerramento toda linha é 0/0/0/0. A regra soma=quantidade é
-- validada no RPC, NUNCA como CHECK de coluna.

ALTER TABLE public.decoracao_festa_itens
  ADD COLUMN IF NOT EXISTS qtd_ok         int NOT NULL DEFAULT 0 CHECK (qtd_ok >= 0),
  ADD COLUMN IF NOT EXISTS qtd_quebrado   int NOT NULL DEFAULT 0 CHECK (qtd_quebrado >= 0),
  ADD COLUMN IF NOT EXISTS qtd_perdido    int NOT NULL DEFAULT 0 CHECK (qtd_perdido >= 0),
  ADD COLUMN IF NOT EXISTS qtd_quarentena int NOT NULL DEFAULT 0 CHECK (qtd_quarentena >= 0);

-- ── 3. Tabela decoracao_quarentena ────────────────────────────

CREATE TABLE IF NOT EXISTS public.decoracao_quarentena (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  variacao_id     uuid        NOT NULL REFERENCES public.decoracao_item_variacoes(id) ON DELETE RESTRICT,
  quantidade      int         NOT NULL CHECK (quantidade > 0),
  motivo          text        NOT NULL,
  origem_festa_id uuid        REFERENCES public.decoracao_festa(id) ON DELETE SET NULL,
  local_id        uuid        NOT NULL REFERENCES public.decoracao_locais(id) ON DELETE RESTRICT,
  status          text        NOT NULL DEFAULT 'pendente'
                               CHECK (status IN ('pendente', 'resolvido')),
  resolucao       text        CHECK (resolucao IN ('consertado', 'descartado')),
  resolvido_em    timestamptz,
  resolvido_by    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decoracao_quarentena_status
  ON public.decoracao_quarentena (status);
CREATE INDEX IF NOT EXISTS idx_decoracao_quarentena_variacao
  ON public.decoracao_quarentena (variacao_id);
CREATE INDEX IF NOT EXISTS idx_decoracao_quarentena_local
  ON public.decoracao_quarentena (local_id);
CREATE INDEX IF NOT EXISTS idx_decoracao_quarentena_festa
  ON public.decoracao_quarentena (origem_festa_id);

-- ── 4. Trigger updated_at ─────────────────────────────────────

CREATE OR REPLACE TRIGGER trg_decoracao_quarentena_updated_at
  BEFORE UPDATE ON public.decoracao_quarentena
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 5. GRANT (papel authenticated do PostgREST) ───────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decoracao_quarentena TO authenticated;

-- ── 6. RLS — decoracao_quarentena ─────────────────────────────
-- view = global viewer OU view granted; INSERT/UPDATE = edit (gerar/
-- resolver = operar a decoração); DELETE = delete.

ALTER TABLE public.decoracao_quarentena ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "decoracao_quarentena: view"   ON public.decoracao_quarentena;
DROP POLICY IF EXISTS "decoracao_quarentena: insert" ON public.decoracao_quarentena;
DROP POLICY IF EXISTS "decoracao_quarentena: update" ON public.decoracao_quarentena;
DROP POLICY IF EXISTS "decoracao_quarentena: delete" ON public.decoracao_quarentena;

CREATE POLICY "decoracao_quarentena: view"
  ON public.decoracao_quarentena FOR SELECT TO authenticated
  USING (is_global_viewer() OR check_permission(auth.uid(), 'decoracao', 'view'));

CREATE POLICY "decoracao_quarentena: insert"
  ON public.decoracao_quarentena FOR INSERT TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_quarentena: update"
  ON public.decoracao_quarentena FOR UPDATE TO authenticated
  USING      (check_permission(auth.uid(), 'decoracao', 'edit'))
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_quarentena: delete"
  ON public.decoracao_quarentena FOR DELETE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'delete'));

-- ── 7. RPC encerrar_festa_decoracao ───────────────────────────
-- SECURITY INVOKER (default). Server-authoritative: itera os itens DA
-- PRÓPRIA festa; itens omitidos em p_itens → "tudo OK" (qtd_ok = qtd).
-- Valida soma por linha, grava desfechos, dá baixa no saldo do local
-- com GREATEST(0,…), gera linhas de quarentena e marca a festa encerrada.
-- Tudo numa transação (corpo plpgsql). Retorna {festa_id, avisos[]}.

CREATE OR REPLACE FUNCTION public.encerrar_festa_decoracao(
  p_festa_decoracao_id uuid,
  p_itens              jsonb,
  p_local_id           uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_festa       public.decoracao_festa%ROWTYPE;
  v_row         RECORD;
  v_desfecho    jsonb;
  v_ok          int;
  v_quebrado    int;
  v_perdido     int;
  v_quarentena  int;
  v_motivo      text;
  v_baixa       int;
  v_saldo_antes int;
  v_avisos      jsonb := '[]'::jsonb;
BEGIN
  IF p_festa_decoracao_id IS NULL THEN
    RAISE EXCEPTION 'festa_obrigatoria' USING ERRCODE = '22023';
  END IF;
  IF p_local_id IS NULL THEN
    RAISE EXCEPTION 'local_obrigatorio' USING ERRCODE = '22023';
  END IF;

  -- Trava a festa (encerramento concorrente) e valida o estado.
  SELECT * INTO v_festa
  FROM public.decoracao_festa
  WHERE id = p_festa_decoracao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festa_nao_encontrada' USING ERRCODE = '22023';
  END IF;
  IF v_festa.status = 'encerrada' THEN
    RAISE EXCEPTION 'festa_ja_encerrada' USING ERRCODE = '22023';
  END IF;

  -- Percorre os itens DA PRÓPRIA festa (default tudo OK).
  FOR v_row IN
    SELECT id, variacao_id, quantidade
    FROM public.decoracao_festa_itens
    WHERE festa_decoracao_id = p_festa_decoracao_id
  LOOP
    SELECT elem INTO v_desfecho
    FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb)) elem
    WHERE NULLIF(elem->>'variacao_id', '')::uuid = v_row.variacao_id
    LIMIT 1;

    IF v_desfecho IS NULL THEN
      v_ok := v_row.quantidade; v_quebrado := 0; v_perdido := 0; v_quarentena := 0;
      v_motivo := NULL;
    ELSE
      v_ok         := COALESCE((v_desfecho->>'qtd_ok')::int, 0);
      v_quebrado   := COALESCE((v_desfecho->>'qtd_quebrado')::int, 0);
      v_perdido    := COALESCE((v_desfecho->>'qtd_perdido')::int, 0);
      v_quarentena := COALESCE((v_desfecho->>'qtd_quarentena')::int, 0);
      v_motivo     := NULLIF(btrim(COALESCE(v_desfecho->>'motivo', '')), '');
    END IF;

    IF v_ok < 0 OR v_quebrado < 0 OR v_perdido < 0 OR v_quarentena < 0 THEN
      RAISE EXCEPTION 'desfecho_negativo' USING ERRCODE = '22023';
    END IF;
    IF (v_ok + v_quebrado + v_perdido + v_quarentena) <> v_row.quantidade THEN
      RAISE EXCEPTION 'soma_invalida_variacao_%', v_row.variacao_id USING ERRCODE = '22023';
    END IF;

    UPDATE public.decoracao_festa_itens
    SET qtd_ok         = v_ok,
        qtd_quebrado   = v_quebrado,
        qtd_perdido    = v_perdido,
        qtd_quarentena = v_quarentena
    WHERE id = v_row.id;

    v_baixa := v_quebrado + v_perdido + v_quarentena;

    IF v_baixa > 0 THEN
      -- saldo atual no local da baixa (trava a linha se existir)
      SELECT quantidade INTO v_saldo_antes
      FROM public.decoracao_estoque_saldo
      WHERE variacao_id = v_row.variacao_id AND local_id = p_local_id
      FOR UPDATE;

      IF FOUND THEN
        UPDATE public.decoracao_estoque_saldo
        SET quantidade = GREATEST(0, v_saldo_antes - v_baixa)
        WHERE variacao_id = v_row.variacao_id AND local_id = p_local_id;
      ELSE
        v_saldo_antes := 0;  -- sem linha de saldo → nada a debitar
      END IF;

      -- aviso não-bloqueante quando a baixa excedeu o saldo do local
      IF v_saldo_antes < v_baixa THEN
        v_avisos := v_avisos || jsonb_build_object(
          'variacao_id', v_row.variacao_id,
          'baixa',       v_baixa,
          'saldo_antes', v_saldo_antes
        );
      END IF;
    END IF;

    IF v_quarentena > 0 THEN
      INSERT INTO public.decoracao_quarentena
        (variacao_id, quantidade, motivo, origem_festa_id, local_id, status)
      VALUES
        (v_row.variacao_id, v_quarentena,
         COALESCE(v_motivo, 'Avariado no encerramento da festa'),
         p_festa_decoracao_id, p_local_id, 'pendente');
    END IF;
  END LOOP;

  -- Marca a festa encerrada.
  UPDATE public.decoracao_festa
  SET status       = 'encerrada',
      encerrada_em = now(),
      encerrada_by = auth.uid()
  WHERE id = p_festa_decoracao_id;

  RETURN jsonb_build_object(
    'festa_id', p_festa_decoracao_id,
    'avisos',   v_avisos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.encerrar_festa_decoracao(uuid, jsonb, uuid) TO authenticated;

-- ── 8. RPC resolver_quarentena ────────────────────────────────
-- SECURITY INVOKER. 'consertado' devolve a quantidade ao saldo do
-- p_local_id (cria a linha de saldo se não existir — política INSERT
-- = 'create', que os cargos de gestão têm) e marca resolvido.
-- 'descartado' apenas marca resolvido (o saldo segue baixado). Atômica.

CREATE OR REPLACE FUNCTION public.resolver_quarentena(
  p_quarentena_id uuid,
  p_resolucao     text,
  p_local_id      uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_q public.decoracao_quarentena%ROWTYPE;
BEGIN
  IF p_quarentena_id IS NULL THEN
    RAISE EXCEPTION 'quarentena_obrigatoria' USING ERRCODE = '22023';
  END IF;
  IF p_resolucao NOT IN ('consertado', 'descartado') THEN
    RAISE EXCEPTION 'resolucao_invalida' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_q
  FROM public.decoracao_quarentena
  WHERE id = p_quarentena_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quarentena_nao_encontrada' USING ERRCODE = '22023';
  END IF;
  IF v_q.status = 'resolvido' THEN
    RAISE EXCEPTION 'quarentena_ja_resolvida' USING ERRCODE = '22023';
  END IF;

  IF p_resolucao = 'consertado' THEN
    IF p_local_id IS NULL THEN
      RAISE EXCEPTION 'local_obrigatorio' USING ERRCODE = '22023';
    END IF;
    -- devolve ao saldo do local (cria a linha se não existir)
    INSERT INTO public.decoracao_estoque_saldo (variacao_id, local_id, quantidade)
    VALUES (v_q.variacao_id, p_local_id, v_q.quantidade)
    ON CONFLICT (variacao_id, local_id) DO UPDATE
      SET quantidade = public.decoracao_estoque_saldo.quantidade + EXCLUDED.quantidade;
  END IF;

  UPDATE public.decoracao_quarentena
  SET status       = 'resolvido',
      resolucao    = p_resolucao,
      resolvido_em = now(),
      resolvido_by = auth.uid()
  WHERE id = p_quarentena_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolver_quarentena(uuid, text, uuid) TO authenticated;

-- ── 9. Reload schema PostgREST ────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
