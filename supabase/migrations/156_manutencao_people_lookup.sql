-- supabase/migrations/156_manutencao_people_lookup.sql
-- Fase B-1 — RPC de exibição read-only para resolver NOMES de usuários no módulo Manutenção.
--
-- PROBLEMA: a RLS de public.users só permite que super_admin/diretor (quem tem
-- 'usuarios','view') vejam OUTROS usuários; qualquer outro cargo — incluindo o técnico
-- de manutenção — só enxerga a própria linha (policy "users: self view": id = auth_user_id()).
-- Por isso os embeds PostgREST de users (assigned_to_user, opened_by_user, internal_user,
-- responsible_user, cost_approved_by, concluded_by, changed_by) voltam NULL para técnicos,
-- deixando os nomes em branco na tela de detalhe do chamado.
--
-- SOLUÇÃO: uma função SECURITY DEFINER read-only, gated por manutencao 'view', que resolve
-- (id, name, avatar_url) APENAS para usuários que aparecem em chamados/execuções DENTRO DAS
-- UNIDADES ACESSÍVEIS AO CHAMADOR. Não é o diretório inteiro de staff — o escopo de unidade
-- é reimposto manualmente (SECURITY DEFINER bypassa RLS), reusando EXATAMENTE o mesmo predicado
-- da RLS de maintenance_tickets: is_global_viewer() OR unit_id = ANY(get_user_unit_ids()).
--
-- Sem alteração de RLS. Sem novas permissões de escrita.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_maintenance_people(p_unit_id uuid DEFAULT NULL)
  RETURNS TABLE (id uuid, name text, avatar_url text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Exibição read-only de nomes do módulo = leitura de manutenção.
  IF NOT check_permission(auth.uid(), 'manutencao', 'view') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH scoped_tickets AS (
    -- Chamados que o chamador já pode ver — MESMO predicado de escopo da RLS de
    -- maintenance_tickets ("maintenance_tickets: view"). p_unit_id, quando informado,
    -- restringe a essa unidade (só surte efeito se também acessível ao chamador, pois
    -- o predicado de acesso é ANDado).
    SELECT t.id, t.opened_by, t.assigned_to_user_id,
           t.concluded_by_user_id, t.created_by_user_id
    FROM public.maintenance_tickets t
    WHERE (is_global_viewer() OR t.unit_id = ANY (get_user_unit_ids()))
      AND (p_unit_id IS NULL OR t.unit_id = p_unit_id)
  ),
  person_ids AS (
    -- Todo user id que pode ser exibido na tela de detalhe de um chamado em escopo.
    SELECT st.opened_by            AS uid FROM scoped_tickets st
    UNION
    SELECT st.assigned_to_user_id  FROM scoped_tickets st
    UNION
    SELECT st.concluded_by_user_id FROM scoped_tickets st
    UNION
    SELECT st.created_by_user_id   FROM scoped_tickets st
    UNION
    SELECT e.internal_user_id      FROM public.maintenance_executions e
      JOIN scoped_tickets st ON st.id = e.ticket_id
    UNION
    SELECT e.responsible_user_id   FROM public.maintenance_executions e
      JOIN scoped_tickets st ON st.id = e.ticket_id
    UNION
    SELECT e.cost_approved_by      FROM public.maintenance_executions e
      JOIN scoped_tickets st ON st.id = e.ticket_id
    UNION
    SELECT h.changed_by            FROM public.maintenance_status_history h
      JOIN scoped_tickets st ON st.id = h.ticket_id
  )
  SELECT DISTINCT u.id, u.name, u.avatar_url
  FROM public.users u
  JOIN person_ids p ON p.uid = u.id
  WHERE p.uid IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION public.get_maintenance_people(uuid) IS
  'Fase B-1: resolve (id, name, avatar_url) dos usuários exibidos no módulo Manutenção '
  '(responsável, solicitante, executor interno, aprovador de custo, autor de status, etc.). '
  'SECURITY DEFINER read-only, gated por manutencao view. Escopo de privacidade: só usuários '
  'que aparecem em chamados/execuções das unidades acessíveis ao chamador (reusa o predicado '
  'is_global_viewer() OR unit_id = ANY(get_user_unit_ids()) da RLS de maintenance_tickets). '
  'Existe porque a RLS de public.users só deixa super_admin/diretor verem outros usuários.';

GRANT EXECUTE ON FUNCTION public.get_maintenance_people(uuid) TO authenticated;

COMMIT;
