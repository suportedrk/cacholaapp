-- ============================================================
-- ROLLBACK da Migration 170 — remove o guard interno das RPCs de Decoração
-- ============================================================
-- Recria as 5 RPCs nas suas definições ORIGINAIS (sem a linha
-- PERFORM check_permission_or_raise). A autorização continua garantida pela RLS
-- das tabelas-alvo (decoracao_estoque_saldo etc.), que NÃO é tocada aqui — este
-- rollback só remove a camada extra de defense-in-depth. Idempotente.
-- ============================================================

-- ── criar_transferencia (original) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.criar_transferencia(p_origem uuid, p_destino uuid, p_observacoes text, p_itens jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$

;

-- ── receber_transferencia (original) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.receber_transferencia(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$

;

-- ── cancelar_transferencia (original) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancelar_transferencia(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$

;

-- ── encerrar_festa_decoracao (original) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encerrar_festa_decoracao(p_festa_decoracao_id uuid, p_itens jsonb, p_local_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$

;

-- ── resolver_quarentena (original) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolver_quarentena(p_quarentena_id uuid, p_resolucao text, p_local_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$

;

