-- ============================================================
-- Migration 031: Modulo de Manutencao -- Tabelas base
-- ============================================================

-- 1. SETORES DE MANUTENCAO (separado da tabela sectors legada)
CREATE TABLE IF NOT EXISTS public.maintenance_sectors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. CATEGORIAS DE MANUTENCAO (ex: Eletrica, Hidraulica, Limpeza)
CREATE TABLE IF NOT EXISTS public.maintenance_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text,
  icon        text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. ITENS / LOCAIS (ex: Geladeira Cozinha, AC Sala 1, Banheiro Feminino)
CREATE TABLE IF NOT EXISTS public.maintenance_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  sector_id   uuid REFERENCES public.maintenance_sectors(id) ON DELETE SET NULL,
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 4. SLA (prazo por urgencia, por unidade)
CREATE TABLE IF NOT EXISTS public.maintenance_sla (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id          uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  urgency_level    text NOT NULL CHECK (urgency_level IN ('critical','high','medium','low')),
  resolution_hours integer NOT NULL,
  response_hours   integer NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, urgency_level)
);

-- 5. CHAMADOS (tabela principal)
CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  sector_id       uuid REFERENCES public.maintenance_sectors(id) ON DELETE SET NULL,
  category_id     uuid REFERENCES public.maintenance_categories(id) ON DELETE SET NULL,
  item_id         uuid REFERENCES public.maintenance_items(id) ON DELETE SET NULL,
  nature          text NOT NULL DEFAULT 'pontual'
                  CHECK (nature IN ('emergencial','pontual','agendado','preventivo')),
  urgency         text NOT NULL DEFAULT 'medium'
                  CHECK (urgency IN ('critical','high','medium','low')),
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','waiting_part','concluded','cancelled')),
  scheduled_date  timestamptz,
  concluded_at    timestamptz,
  due_at          timestamptz,
  opened_by       uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  total_cost      numeric(10,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 6. EXECUCOES (quem executa o chamado)
CREATE TABLE IF NOT EXISTS public.maintenance_executions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id        uuid NOT NULL REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE,
  executor_type    text NOT NULL CHECK (executor_type IN ('internal','external')),
  internal_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  provider_id      uuid REFERENCES public.service_providers(id) ON DELETE SET NULL,
  description      text,
  cost             numeric(10,2) NOT NULL DEFAULT 0,
  cost_approved    boolean NOT NULL DEFAULT false,
  cost_approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  cost_approved_at timestamptz,
  status           text NOT NULL DEFAULT 'assigned'
                   CHECK (status IN ('assigned','in_progress','concluded')),
  started_at       timestamptz,
  concluded_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT executor_must_be_set CHECK (
    (executor_type = 'internal' AND internal_user_id IS NOT NULL) OR
    (executor_type = 'external' AND provider_id IS NOT NULL)
  )
);

-- 7. FOTOS / ANEXOS dos chamados
CREATE TABLE IF NOT EXISTS public.maintenance_ticket_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE,
  url         text NOT NULL,
  caption     text,
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 8. HISTORICO DE STATUS (timeline do chamado)
CREATE TABLE IF NOT EXISTS public.maintenance_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE,
  from_status text,
  to_status   text NOT NULL,
  changed_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
CREATE TRIGGER maintenance_sectors_updated_at
  BEFORE UPDATE ON public.maintenance_sectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER maintenance_categories_updated_at
  BEFORE UPDATE ON public.maintenance_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER maintenance_items_updated_at
  BEFORE UPDATE ON public.maintenance_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER maintenance_sla_updated_at
  BEFORE UPDATE ON public.maintenance_sla
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER maintenance_tickets_updated_at
  BEFORE UPDATE ON public.maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER maintenance_executions_updated_at
  BEFORE UPDATE ON public.maintenance_executions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- TRIGGER: atualizar total_cost em maintenance_tickets
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_ticket_total_cost()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.maintenance_tickets
  SET total_cost = (
    SELECT COALESCE(SUM(cost), 0)
    FROM public.maintenance_executions
    WHERE ticket_id = COALESCE(NEW.ticket_id, OLD.ticket_id)
  )
  WHERE id = COALESCE(NEW.ticket_id, OLD.ticket_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_ticket_total_cost
  AFTER INSERT OR UPDATE OF cost OR DELETE
  ON public.maintenance_executions
  FOR EACH ROW EXECUTE FUNCTION public.update_ticket_total_cost();

-- ============================================================
-- TRIGGER: registrar historico de status automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_ticket_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.maintenance_status_history
      (ticket_id, from_status, to_status, changed_by)
    VALUES
      (NEW.id, OLD.status, NEW.status, NEW.opened_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER track_ticket_status
  AFTER UPDATE OF status ON public.maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION public.record_ticket_status_change();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.maintenance_sectors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_sla             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tickets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_executions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_ticket_photos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_status_history  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unit_read_sectors" ON public.maintenance_sectors
  FOR SELECT TO authenticated USING (unit_id = ANY(get_user_unit_ids()));
CREATE POLICY "unit_manage_sectors" ON public.maintenance_sectors
  FOR ALL TO authenticated USING (unit_id = ANY(get_user_unit_ids()));

CREATE POLICY "unit_read_categories" ON public.maintenance_categories
  FOR SELECT TO authenticated USING (unit_id = ANY(get_user_unit_ids()));
CREATE POLICY "unit_manage_categories" ON public.maintenance_categories
  FOR ALL TO authenticated USING (unit_id = ANY(get_user_unit_ids()));

CREATE POLICY "unit_read_items" ON public.maintenance_items
  FOR SELECT TO authenticated USING (unit_id = ANY(get_user_unit_ids()));
CREATE POLICY "unit_manage_items" ON public.maintenance_items
  FOR ALL TO authenticated USING (unit_id = ANY(get_user_unit_ids()));

CREATE POLICY "unit_read_sla" ON public.maintenance_sla
  FOR SELECT TO authenticated USING (unit_id = ANY(get_user_unit_ids()));
CREATE POLICY "unit_manage_sla" ON public.maintenance_sla
  FOR ALL TO authenticated USING (unit_id = ANY(get_user_unit_ids()));

CREATE POLICY "unit_read_tickets" ON public.maintenance_tickets
  FOR SELECT TO authenticated USING (unit_id = ANY(get_user_unit_ids()));
CREATE POLICY "unit_insert_tickets" ON public.maintenance_tickets
  FOR INSERT TO authenticated WITH CHECK (unit_id = ANY(get_user_unit_ids()));
CREATE POLICY "unit_update_tickets" ON public.maintenance_tickets
  FOR UPDATE TO authenticated USING (unit_id = ANY(get_user_unit_ids()));

CREATE POLICY "unit_read_executions" ON public.maintenance_executions
  FOR SELECT TO authenticated
  USING (ticket_id IN (
    SELECT id FROM public.maintenance_tickets WHERE unit_id = ANY(get_user_unit_ids())
  ));
CREATE POLICY "unit_manage_executions" ON public.maintenance_executions
  FOR ALL TO authenticated
  USING (ticket_id IN (
    SELECT id FROM public.maintenance_tickets WHERE unit_id = ANY(get_user_unit_ids())
  ));

CREATE POLICY "unit_read_photos" ON public.maintenance_ticket_photos
  FOR SELECT TO authenticated
  USING (ticket_id IN (
    SELECT id FROM public.maintenance_tickets WHERE unit_id = ANY(get_user_unit_ids())
  ));
CREATE POLICY "unit_manage_photos" ON public.maintenance_ticket_photos
  FOR ALL TO authenticated
  USING (ticket_id IN (
    SELECT id FROM public.maintenance_tickets WHERE unit_id = ANY(get_user_unit_ids())
  ));

CREATE POLICY "unit_read_history" ON public.maintenance_status_history
  FOR SELECT TO authenticated
  USING (ticket_id IN (
    SELECT id FROM public.maintenance_tickets WHERE unit_id = ANY(get_user_unit_ids())
  ));

-- ============================================================
-- GRANTS
-- ============================================================
GRANT ALL ON public.maintenance_sectors        TO authenticated;
GRANT ALL ON public.maintenance_categories     TO authenticated;
GRANT ALL ON public.maintenance_items          TO authenticated;
GRANT ALL ON public.maintenance_sla            TO authenticated;
GRANT ALL ON public.maintenance_tickets        TO authenticated;
GRANT ALL ON public.maintenance_executions     TO authenticated;
GRANT ALL ON public.maintenance_ticket_photos  TO authenticated;
GRANT ALL ON public.maintenance_status_history TO authenticated;
