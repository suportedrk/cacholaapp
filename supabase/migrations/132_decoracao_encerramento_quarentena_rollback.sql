-- ============================================================
-- Rollback da Migration 132 — Decoração Bloco D
-- Remove RPCs, tabela de quarentena e as colunas de encerramento.
-- ============================================================

BEGIN;

DROP FUNCTION IF EXISTS public.resolver_quarentena(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.encerrar_festa_decoracao(uuid, jsonb, uuid);

DROP TABLE IF EXISTS public.decoracao_quarentena CASCADE;

ALTER TABLE public.decoracao_festa_itens
  DROP COLUMN IF EXISTS qtd_ok,
  DROP COLUMN IF EXISTS qtd_quebrado,
  DROP COLUMN IF EXISTS qtd_perdido,
  DROP COLUMN IF EXISTS qtd_quarentena;

ALTER TABLE public.decoracao_festa
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS encerrada_em,
  DROP COLUMN IF EXISTS encerrada_by;

NOTIFY pgrst, 'reload schema';

COMMIT;
