-- ============================================================
-- Cachola OS — Migration 001: Schema Inicial
-- ============================================================
-- Execute com:
--   docker compose exec supabase-db psql -U postgres -d postgres \
--     -f /docker-entrypoint-initdb.d/001_initial_schema.sql
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- busca textual fuzzy
CREATE EXTENSION IF NOT EXISTS "unaccent"; -- busca sem acentos

-- ============================================================
-- Função utilitária: atualiza updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- USERS — Usuários do sistema
-- (Espelha auth.users do Supabase GoTrue)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  phone         TEXT,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'freelancer'
                  CHECK (role IN (
                    'super_admin', 'diretor', 'gerente', 'vendedora',
                    'decoracao', 'manutencao', 'financeiro', 'rh',
                    'freelancer', 'entregador'
                  )),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  preferences   JSONB NOT NULL DEFAULT '{
    "notifications": {
      "email": true,
      "push": true,
      "events": true,
      "maintenance": true,
      "checklists": true
    }
  }'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Índices
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_is_active ON public.users(is_active);
CREATE INDEX idx_users_email ON public.users(email);

-- ============================================================
-- ROLE_DEFAULT_PERMS — Template de permissões por role
-- ============================================================
CREATE TABLE IF NOT EXISTS public.role_default_perms (
  id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role     TEXT NOT NULL CHECK (role IN (
             'super_admin', 'diretor', 'gerente', 'vendedora',
             'decoracao', 'manutencao', 'financeiro', 'rh',
             'freelancer', 'entregador'
           )),
  module   TEXT NOT NULL CHECK (module IN (
             'events', 'maintenance', 'checklists', 'users',
             'reports', 'audit_logs', 'notifications', 'settings'
           )),
  action   TEXT NOT NULL CHECK (action IN (
             'view', 'create', 'edit', 'delete', 'export'
           )),
  granted  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (role, module, action)
);

-- ============================================================
-- USER_PERMISSIONS — Permissões granulares por usuário
-- (sobrescreve role_default_perms por usuário)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  module   TEXT NOT NULL CHECK (module IN (
             'events', 'maintenance', 'checklists', 'users',
             'reports', 'audit_logs', 'notifications', 'settings'
           )),
  action   TEXT NOT NULL CHECK (action IN (
             'view', 'create', 'edit', 'delete', 'export'
           )),
  granted  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (user_id, module, action)
);

CREATE INDEX idx_user_permissions_user_id ON public.user_permissions(user_id);

-- ============================================================
-- EVENTS — Eventos/festas agendadas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ploomes_deal_id   TEXT,                    -- integração futura (Fase 2)
  title             TEXT NOT NULL,
  date              DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  event_type        TEXT NOT NULL DEFAULT 'festa_infantil',
  package           TEXT,
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN (
                        'draft', 'confirmed', 'in_progress',
                        'completed', 'cancelled'
                      )),
  client_name       TEXT NOT NULL,
  birthday_person   TEXT,
  birthday_age      INTEGER,
  guest_count       INTEGER,
  notes             TEXT,
  venue             TEXT,
  created_by        UUID NOT NULL REFERENCES public.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_events_date ON public.events(date);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_created_by ON public.events(created_by);
CREATE INDEX idx_events_ploomes_deal_id ON public.events(ploomes_deal_id) WHERE ploomes_deal_id IS NOT NULL;

-- ============================================================
-- EVENT_STAFF — Funcionários escalados por evento
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_staff (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_in_event   TEXT NOT NULL,     -- ex: 'garcom', 'monitor', 'decoradora', 'gerente_evento'
  UNIQUE (event_id, user_id)
);

CREATE INDEX idx_event_staff_event_id ON public.event_staff(event_id);
CREATE INDEX idx_event_staff_user_id ON public.event_staff(user_id);

-- ============================================================
-- CHECKLIST_TEMPLATES — Templates reutilizáveis
-- ============================================================
CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT NOT NULL,
  category    TEXT NOT NULL,  -- ex: 'pre_evento', 'pos_evento', 'manutencao', 'abertura_dia'
  created_by  UUID NOT NULL REFERENCES public.users(id),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER checklist_templates_updated_at
  BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TEMPLATE_ITEMS — Itens dos templates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.template_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id  UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_template_items_template_id ON public.template_items(template_id);

-- ============================================================
-- CHECKLISTS — Checklists (instâncias)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.checklists (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  template_id  UUID REFERENCES public.checklist_templates(id),
  event_id     UUID REFERENCES public.events(id) ON DELETE SET NULL,
  assigned_to  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER checklists_updated_at
  BEFORE UPDATE ON public.checklists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_checklists_event_id ON public.checklists(event_id);
CREATE INDEX idx_checklists_assigned_to ON public.checklists(assigned_to);
CREATE INDEX idx_checklists_status ON public.checklists(status);

-- ============================================================
-- CHECKLIST_ITEMS — Itens individuais do checklist
-- ============================================================
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id  UUID NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  is_done       BOOLEAN NOT NULL DEFAULT FALSE,
  done_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  done_at       TIMESTAMPTZ,
  photo_url     TEXT,
  notes         TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_checklist_items_checklist_id ON public.checklist_items(checklist_id);

-- ============================================================
-- MAINTENANCE_ORDERS — Ordens de serviço de manutenção
-- ============================================================
CREATE TABLE IF NOT EXISTS public.maintenance_orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            TEXT NOT NULL,
  description      TEXT,
  type             TEXT NOT NULL DEFAULT 'correctiva'
                     CHECK (type IN ('correctiva', 'preventiva', 'melhoria')),
  priority         TEXT NOT NULL DEFAULT 'medium'
                     CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  sector           TEXT NOT NULL,  -- ex: 'banheiro', 'salao', 'cozinha', 'area_externa'
  equipment        TEXT,           -- ex: 'ar-condicionado 1', 'geladeira estoque'
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN (
                       'open', 'in_progress', 'waiting_parts',
                       'completed', 'cancelled'
                     )),
  assigned_to      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  due_date         TIMESTAMPTZ,
  event_id         UUID REFERENCES public.events(id) ON DELETE SET NULL,
  recurrence_rule  TEXT,           -- RRULE format (ex: 'FREQ=MONTHLY;BYDAY=MO')
  created_by       UUID NOT NULL REFERENCES public.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER maintenance_orders_updated_at
  BEFORE UPDATE ON public.maintenance_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_maintenance_orders_status ON public.maintenance_orders(status);
CREATE INDEX idx_maintenance_orders_priority ON public.maintenance_orders(priority);
CREATE INDEX idx_maintenance_orders_assigned_to ON public.maintenance_orders(assigned_to);
CREATE INDEX idx_maintenance_orders_event_id ON public.maintenance_orders(event_id);

-- ============================================================
-- MAINTENANCE_PHOTOS — Fotos de manutenção (antes/depois)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.maintenance_photos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID NOT NULL REFERENCES public.maintenance_orders(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('before', 'after', 'during')),
  uploaded_by  UUID NOT NULL REFERENCES public.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_maintenance_photos_order_id ON public.maintenance_photos(order_id);

-- ============================================================
-- NOTIFICATIONS — Notificações por usuário
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,   -- ex: 'event_reminder', 'maintenance_assigned', 'checklist_due'
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  link        TEXT,            -- rota interna (ex: '/eventos/uuid')
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(user_id, is_read);

-- ============================================================
-- AUDIT_LOGS — Log de auditoria de todas as operações
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,       -- ex: 'create', 'update', 'delete', 'login', 'logout'
  module       TEXT NOT NULL,
  entity_id    UUID,
  entity_type  TEXT NOT NULL,       -- ex: 'event', 'user', 'maintenance_order'
  old_data     JSONB,               -- estado anterior (UPDATE/DELETE)
  new_data     JSONB,               -- estado novo (CREATE/UPDATE)
  ip           INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_module ON public.audit_logs(module);

-- ============================================================
-- CONFIGURAÇÕES DO SISTEMA (tabela chave-valor)
-- Permite valores de select configuráveis (sem hardcode)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.system_config (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category   TEXT NOT NULL,    -- ex: 'event_types', 'packages', 'sectors', 'roles_in_event'
  key        TEXT NOT NULL,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (category, key)
);

CREATE INDEX idx_system_config_category ON public.system_config(category);
