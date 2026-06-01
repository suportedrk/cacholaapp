-- supabase/migrations/136_manutencao_bloco_b_nature_e_created_by.sql
-- Bloco B — Abertura do chamado.
--
-- Cobre três mudanças de schema:
--   1. Novos valores de 'nature' (preventiva/corretiva/emergencial/melhoria_estetica),
--      default 'corretiva'. Banco vazio — sem migração de dado.
--   2. Coluna created_by_user_id (criador REAL) preenchida por TRIGGER BEFORE INSERT
--      que força auth.uid() — à prova de adulteração. opened_by passa a ser o
--      "solicitante" (selecionável na UI).
--   3. RPC SECURITY DEFINER get_maintenance_requester_options para o seletor de
--      solicitante — a RLS de users/user_units só deixa o técnico ver a si mesmo,
--      então a listagem precisa de uma função gated por check_permission.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. NOVA NATUREZA
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.maintenance_tickets
  DROP CONSTRAINT maintenance_tickets_nature_check;

ALTER TABLE public.maintenance_tickets
  ADD CONSTRAINT maintenance_tickets_nature_check
  CHECK (nature = ANY (ARRAY['preventiva', 'corretiva', 'emergencial', 'melhoria_estetica']));

ALTER TABLE public.maintenance_tickets
  ALTER COLUMN nature SET DEFAULT 'corretiva';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. created_by_user_id + TRIGGER de auditoria
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.maintenance_tickets
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_mtickets_created_by
  ON public.maintenance_tickets (created_by_user_id)
  WHERE created_by_user_id IS NOT NULL;

COMMENT ON COLUMN public.maintenance_tickets.created_by_user_id IS
  'Criador REAL do chamado (auth.uid() forçado por trigger). opened_by é o solicitante selecionável. Usado para notificações técnicas (cron de alertas, e-mail de emergência).';

-- Trigger force-set: ignora qualquer valor enviado pelo client, grava auth.uid().
-- Só em INSERT (created_by é imutável). auth.uid() NULL (seed/service-role) → aceita NULL.
CREATE OR REPLACE FUNCTION public.set_ticket_created_by()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  NEW.created_by_user_id := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_ticket_created_by
  BEFORE INSERT ON public.maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_ticket_created_by();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC get_maintenance_requester_options — seletor de solicitante
-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER bypassa a RLS de users/user_units, mas reimpõe o controle:
--   - guard: quem chama precisa de manutencao.create (mesma permissão do INSERT do ticket)
--   - escopo: só usuários de unidades que o CHAMADOR acessa (is_global_viewer / get_user_unit_ids)
--   - p_unit_id: filtra por unidade SE o chamador tiver acesso a ela; senão retorna vazio
CREATE OR REPLACE FUNCTION public.get_maintenance_requester_options(p_unit_id uuid DEFAULT NULL)
  RETURNS TABLE (id uuid, name text, role text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT check_permission(auth.uid(), 'manutencao', 'create') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id, u.name, u.role::text
  FROM public.users u
  WHERE u.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.user_units uu
      WHERE uu.user_id = u.id
        AND (is_global_viewer() OR uu.unit_id = ANY (get_user_unit_ids()))
        AND (p_unit_id IS NULL OR uu.unit_id = p_unit_id)
    )
  ORDER BY u.name;
END;
$$;

COMMIT;
