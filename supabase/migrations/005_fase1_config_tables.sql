-- ============================================================
-- Cachola OS — Migration 005: Tabelas de Configuração (Fase 1)
-- ============================================================
-- Cria: event_types, packages, venues, checklist_categories
-- Inclui: RLS + seeds iniciais
-- Execute com:
--   docker exec cacholaos-db bash -c "psql -U postgres -d postgres -f /docker-entrypoint-migrations/005_fase1_config_tables.sql"
-- ============================================================

-- ============================================================
-- EVENT_TYPES — Tipos de Evento
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_types (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;

-- Todos os usuários autenticados podem ver tipos ativos
CREATE POLICY "event_types: view"
  ON public.event_types FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Apenas quem tem permissão de settings pode editar
CREATE POLICY "event_types: create"
  ON public.event_types FOR INSERT
  WITH CHECK (check_permission(auth_user_id(), 'settings', 'edit'));

CREATE POLICY "event_types: update"
  ON public.event_types FOR UPDATE
  USING (check_permission(auth_user_id(), 'settings', 'edit'));

CREATE POLICY "event_types: delete"
  ON public.event_types FOR DELETE
  USING (check_permission(auth_user_id(), 'settings', 'delete'));

-- Seed
INSERT INTO public.event_types (name, sort_order) VALUES
  ('Aniversário',  1),
  ('Casamento',    2),
  ('Corporativo',  3),
  ('Outros',       4)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- PACKAGES — Pacotes Contratados
-- ============================================================
CREATE TABLE IF NOT EXISTS public.packages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packages: view"
  ON public.packages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "packages: create"
  ON public.packages FOR INSERT
  WITH CHECK (check_permission(auth_user_id(), 'settings', 'edit'));

CREATE POLICY "packages: update"
  ON public.packages FOR UPDATE
  USING (check_permission(auth_user_id(), 'settings', 'edit'));

CREATE POLICY "packages: delete"
  ON public.packages FOR DELETE
  USING (check_permission(auth_user_id(), 'settings', 'delete'));

-- Seed
INSERT INTO public.packages (name, sort_order) VALUES
  ('Básico',   1),
  ('Premium',  2),
  ('Luxo',     3)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- VENUES — Locais / Salões
-- ============================================================
CREATE TABLE IF NOT EXISTS public.venues (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL UNIQUE,
  capacity   INTEGER,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venues: view"
  ON public.venues FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "venues: create"
  ON public.venues FOR INSERT
  WITH CHECK (check_permission(auth_user_id(), 'settings', 'edit'));

CREATE POLICY "venues: update"
  ON public.venues FOR UPDATE
  USING (check_permission(auth_user_id(), 'settings', 'edit'));

CREATE POLICY "venues: delete"
  ON public.venues FOR DELETE
  USING (check_permission(auth_user_id(), 'settings', 'delete'));

-- Seed
INSERT INTO public.venues (name, capacity, sort_order) VALUES
  ('Salão Principal', 200, 1),
  ('Salão 2',         100, 2),
  ('Área Externa',    150, 3)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- CHECKLIST_CATEGORIES — Categorias de Checklist
-- ============================================================
CREATE TABLE IF NOT EXISTS public.checklist_categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.checklist_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_categories: view"
  ON public.checklist_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "checklist_categories: create"
  ON public.checklist_categories FOR INSERT
  WITH CHECK (check_permission(auth_user_id(), 'settings', 'edit'));

CREATE POLICY "checklist_categories: update"
  ON public.checklist_categories FOR UPDATE
  USING (check_permission(auth_user_id(), 'settings', 'edit'));

CREATE POLICY "checklist_categories: delete"
  ON public.checklist_categories FOR DELETE
  USING (check_permission(auth_user_id(), 'settings', 'delete'));

-- Seed
INSERT INTO public.checklist_categories (name, sort_order) VALUES
  ('Decoração',       1),
  ('Limpeza',         2),
  ('Cozinha',         3),
  ('Pós-Evento',      4),
  ('Carga/Entrega',   5),
  ('Equipamentos',    6)
ON CONFLICT (name) DO NOTHING;
