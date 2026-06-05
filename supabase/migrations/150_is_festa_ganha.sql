-- ============================================================
-- Migration 150 — Critério canônico de festa ganha (Fase 3a)
-- ============================================================
-- Função-regra única do critério de "ganho", reutilizada pelas 9 RPCs do BI
-- que hoje repetem o predicado `status_id=2 OR stage_id=60004787`.
--
-- Critério: Ganho (status 2) OU stage Festa Fechada (60004787) com status != Perdido.
-- Inclui "Em aberto em Festa Fechada" (venda registrada, status não-flipado);
-- EXCLUI "Perdido preso em Festa Fechada" (o bug que inflava ganhos).
--
-- NÃO altera RPCs aqui (isso é a migration 151) nem dado.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_festa_ganha(p_status_id integer, p_stage_id bigint)
RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
AS $$
  SELECT p_status_id = 2 OR (p_stage_id = 60004787 AND p_status_id <> 3);
$$;

COMMENT ON FUNCTION public.is_festa_ganha(integer, bigint) IS
  'Critério canônico de festa ganha: status Ganho (2) OU stage Festa Fechada (60004787) com status != Perdido (3). Inclui Em-aberto-em-Festa-Fechada (venda registrada); exclui Perdido-em-Festa-Fechada. Fonte única reutilizada pelas RPCs do BI. Função pura SQL IMMUTABLE (inlinada pelo planner).';

GRANT EXECUTE ON FUNCTION public.is_festa_ganha(integer, bigint) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
