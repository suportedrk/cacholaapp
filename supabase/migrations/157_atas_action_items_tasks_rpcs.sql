-- Migration 157: Atas — RPCs para a tela "Minhas Tarefas" (Fase A1).
-- Objetivo: expor, para o responsável de um item de ação, apenas a PRÓPRIA tarefa
-- + dados mínimos da ata (título, data, unidade) — NUNCA o conteúdo completo da ata.
--
-- Decisão de produto: um responsável que NÃO é participante da reunião deve conseguir
-- ver e atualizar a própria tarefa, mas continuar sem acesso ao corpo da ata, lista de
-- participantes ou demais itens. O cadeado é a PROPRIEDADE do item (assigned_to = auth.uid()),
-- não a permissão de módulo — segue o padrão owner-pattern (ver cachola-rbac-pattern).
--
-- Esta migration NÃO altera RLS, NÃO altera can_view_meeting e NÃO toca nenhuma policy
-- existente. Apenas adiciona DUAS funções novas SECURITY DEFINER.
--
-- can_view_full = public.can_view_meeting(meeting_id): permite ao frontend decidir se
-- oferece o link para a ata completa (true) ou apenas a tarefa isolada (false).

BEGIN;

-- ─── (a) get_my_action_items ────────────────────────────────────────────────
-- Lista os itens de ação atribuídos ao usuário autenticado, com metadados mínimos
-- da ata. SEM nenhuma coluna de conteúdo da ata (sem corpo/notas, sem participantes).
CREATE OR REPLACE FUNCTION public.get_my_action_items()
RETURNS TABLE (
  item_id       UUID,
  description   TEXT,
  due_date      DATE,
  status        TEXT,
  completed_at  TIMESTAMPTZ,
  meeting_id    UUID,
  meeting_title TEXT,
  meeting_date  TIMESTAMPTZ,
  unit_id       UUID,
  unit_name     TEXT,
  unit_slug     TEXT,
  can_view_full BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ai.id            AS item_id,
    ai.description,
    ai.due_date,
    ai.status,
    ai.completed_at,
    ai.meeting_id,
    mm.title         AS meeting_title,
    mm.meeting_date,
    mm.unit_id,
    u.name           AS unit_name,
    u.slug           AS unit_slug,
    public.can_view_meeting(ai.meeting_id) AS can_view_full
  FROM public.meeting_action_items ai
  JOIN public.meeting_minutes mm ON mm.id = ai.meeting_id
  LEFT JOIN public.units u ON u.id = mm.unit_id
  WHERE ai.assigned_to = auth.uid()
  ORDER BY (ai.due_date IS NULL) ASC, ai.due_date ASC;
$$;

COMMENT ON FUNCTION public.get_my_action_items() IS
  'Atas Fase A1: itens de ação atribuídos ao usuário autenticado (assigned_to = auth.uid()) '
  'com metadados mínimos da ata (título, data, unidade). NÃO retorna conteúdo da ata. '
  'can_view_full = can_view_meeting(meeting_id) indica se o usuário também é participante/global viewer.';

-- ─── (b) set_my_action_item_status ──────────────────────────────────────────
-- Atualiza o status do PRÓPRIO item de ação. Retorna true se uma linha foi afetada,
-- false caso contrário (não lança erro quando o usuário não é o responsável — apenas
-- retorna false, pois o WHERE assigned_to = auth.uid() não casa nenhuma linha).
CREATE OR REPLACE FUNCTION public.set_my_action_item_status(
  p_item_id UUID,
  p_status  TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF p_status NOT IN ('pending', 'in_progress', 'done') THEN
    RAISE EXCEPTION 'invalid_status: %', p_status
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.meeting_action_items
  SET status       = p_status,
      completed_at = CASE WHEN p_status = 'done' THEN now() ELSE NULL END,
      updated_at   = now()
  WHERE id = p_item_id
    AND assigned_to = auth.uid();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

COMMENT ON FUNCTION public.set_my_action_item_status(UUID, TEXT) IS
  'Atas Fase A1: atualiza o status do próprio item de ação (assigned_to = auth.uid()). '
  'Valida p_status IN (pending, in_progress, done). Seta completed_at quando done, NULL caso contrário. '
  'Retorna true se afetou linha; false se o item não pertence ao usuário (sem erro).';

-- ─── GRANTs (least privilege — padrão da migration 070) ─────────────────────
REVOKE ALL ON FUNCTION public.get_my_action_items() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_action_items() TO authenticated;

REVOKE ALL ON FUNCTION public.set_my_action_item_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_action_item_status(UUID, TEXT) TO authenticated;

COMMIT;

-- Recarrega o schema cache do PostgREST para reconhecer as novas funções.
NOTIFY pgrst, 'reload schema';
