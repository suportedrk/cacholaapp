-- Migration 167 - Corrige vazamento cross-tenant em get_event_conflicts / get_conflicting_event_ids.
-- Padrao esteira: sem BEGIN/COMMIT/ROLLBACK nem NOTIFY pgrst (a esteira gerencia a transacao e recarrega o schema apos o commit).
--
-- PROBLEMA (achado da varredura AppSec, A01:2025 Broken Access Control):
--   Ambas as funcoes sao SECURITY DEFINER (rodam como owner, contornam a RLS de events)
--   mas NAO tinham guard de unidade nem SET search_path. Qualquer usuario authenticated
--   chamava com o p_unit_id de OUTRA unidade e enumerava os pares de eventos conflitantes
--   (IDs + datas + gap) dela. Vazamento limitado (sem nome de cliente/crianca) mas cross-tenant.
--
-- FIX:
--   (a) get_event_conflicts ganha guard `is_global_viewer() OR p_unit_id = ANY(get_user_unit_ids())`
--       — auth.uid() dentro de SECURITY DEFINER continua sendo o do CHAMADOR, entao o guard
--       verifica o acesso real de quem chama. Corpo verbatim da definicao atual + a clausula.
--   (b) get_conflicting_event_ids herda o guard (chama a anterior); so falta o SET search_path.
--   Assinatura inalterada nas duas -> CREATE OR REPLACE / ALTER, sem DROP.

CREATE OR REPLACE FUNCTION public.get_event_conflicts(p_unit_id uuid)
RETURNS TABLE(event_id_a uuid, event_id_b uuid, conflict_date date, gap_minutes integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    a.id                                              AS event_id_a,
    b.id                                              AS event_id_b,
    a.date                                            AS conflict_date,
    EXTRACT(EPOCH FROM (
      GREATEST(a.start_time, b.start_time) -
      LEAST(a.end_time, b.end_time)
    ))::INTEGER / 60                                  AS gap_minutes
  FROM public.events a
  JOIN public.events b
    ON  a.unit_id = b.unit_id
    AND a.date    = b.date
    AND a.id      < b.id   -- evita duplicar o par (A,B) e (B,A)
  WHERE
    a.unit_id = p_unit_id
    -- guard de unidade: so deixa consultar unidade que o chamador realmente acessa
    AND (public.is_global_viewer() OR p_unit_id = ANY(public.get_user_unit_ids()))
    AND a.status IN ('confirmed', 'in_progress')
    AND b.status IN ('confirmed', 'in_progress')
    AND (
      -- B comeca antes de 2h apos fim de A
      (a.end_time <= b.start_time AND b.start_time - a.end_time < INTERVAL '2 hours')
      OR
      -- A comeca antes de 2h apos fim de B
      (b.end_time <= a.start_time AND a.start_time - b.end_time < INTERVAL '2 hours')
      OR
      -- sobreposicao direta (um comeca antes do outro terminar)
      (a.start_time < b.end_time AND b.start_time < a.end_time)
    );
$function$;

-- get_conflicting_event_ids herda o guard (chama get_event_conflicts); fixa o search_path.
ALTER FUNCTION public.get_conflicting_event_ids(uuid) SET search_path = public;
