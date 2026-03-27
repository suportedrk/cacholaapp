-- ============================================================
-- Cachola OS — Migration 010: Multi-Unidade (Fase 2.5)
-- ============================================================
-- 1. Cria tabela `units` (unidades do buffet)
-- 2. Cria tabela `user_units` (relação N:N usuário ↔ unidade)
-- 3. Adiciona `unit_id` nas tabelas operacionais e de configuração
-- 4. Adiciona `unit_id` em `user_permissions` (permissões por unidade)
-- 5. Seed: unidade padrão + vínculo do super_admin
-- 6. Funções RLS: get_user_unit_ids(), is_global_viewer()
-- 7. Atualiza todas as RLS policies
-- ============================================================
-- Execute com:
--   docker exec cacholaos-db bash -c "psql -U postgres -d postgres -f /docker-entrypoint-migrations/010_fase25_units.sql"
-- ============================================================

-- ============================================================
-- 1. TABELA: units
-- ============================================================
CREATE TABLE IF NOT EXISTS public.units (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,
  address    TEXT,
  phone      TEXT,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_units_slug      ON public.units(slug);
CREATE INDEX idx_units_is_active ON public.units(is_active);

-- RLS
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "units: authenticated view"
  ON public.units FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "units: super_admin manage"
  ON public.units FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ============================================================
-- 2. TABELA: user_units
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_units (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  unit_id    UUID        NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN (
               'super_admin', 'diretor', 'gerente', 'vendedora',
               'decoracao', 'manutencao', 'financeiro', 'rh',
               'freelancer', 'entregador'
             )),
  is_default BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, unit_id)
);

CREATE INDEX idx_user_units_user_id ON public.user_units(user_id);
CREATE INDEX idx_user_units_unit_id ON public.user_units(unit_id);

-- RLS
ALTER TABLE public.user_units ENABLE ROW LEVEL SECURITY;

-- Usuário vê seus próprios vínculos
CREATE POLICY "user_units: self view"
  ON public.user_units FOR SELECT
  USING (user_id = auth.uid());

-- Admin vê todos os vínculos
CREATE POLICY "user_units: admin view"
  ON public.user_units FOR SELECT
  USING (check_permission(auth.uid(), 'users', 'view'));

-- Admin gerencia vínculos
CREATE POLICY "user_units: admin manage"
  ON public.user_units FOR ALL
  USING (check_permission(auth.uid(), 'users', 'edit'));

-- ============================================================
-- 3. SEED: Unidade padrão
-- ============================================================
INSERT INTO public.units (name, slug, address, phone)
VALUES (
  'Buffet Cachola Pinheiros',
  'pinheiros',
  'Rua Amaro Cavalheiro, 496 - Pinheiros, São Paulo - SP, 05425-011',
  '+55 11 95345-3280'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 4. ADICIONAR unit_id NAS TABELAS DE DADOS OPERACIONAIS
-- Estratégia: nullable → preencher → NOT NULL
-- ============================================================

-- 4a. events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id) ON DELETE RESTRICT;

UPDATE public.events SET unit_id = (SELECT id FROM public.units WHERE slug = 'pinheiros')
  WHERE unit_id IS NULL;

ALTER TABLE public.events ALTER COLUMN unit_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_unit_id ON public.events(unit_id);

-- 4b. checklists
ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id) ON DELETE RESTRICT;

UPDATE public.checklists SET unit_id = (SELECT id FROM public.units WHERE slug = 'pinheiros')
  WHERE unit_id IS NULL;

ALTER TABLE public.checklists ALTER COLUMN unit_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_checklists_unit_id ON public.checklists(unit_id);

-- 4c. checklist_templates
ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id) ON DELETE RESTRICT;

UPDATE public.checklist_templates SET unit_id = (SELECT id FROM public.units WHERE slug = 'pinheiros')
  WHERE unit_id IS NULL;

ALTER TABLE public.checklist_templates ALTER COLUMN unit_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_checklist_templates_unit_id ON public.checklist_templates(unit_id);

-- 4d. maintenance_orders
ALTER TABLE public.maintenance_orders
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id) ON DELETE RESTRICT;

UPDATE public.maintenance_orders SET unit_id = (SELECT id FROM public.units WHERE slug = 'pinheiros')
  WHERE unit_id IS NULL;

ALTER TABLE public.maintenance_orders ALTER COLUMN unit_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_orders_unit_id ON public.maintenance_orders(unit_id);

-- 4e. audit_logs (nullable — logs globais vs por unidade)
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_unit_id ON public.audit_logs(unit_id);

-- ============================================================
-- 5. ADICIONAR unit_id NAS TABELAS DE CONFIGURAÇÃO (por unidade)
-- ============================================================

-- 5a. event_types — remover UNIQUE(name), substituir por UNIQUE(name, unit_id)
ALTER TABLE public.event_types
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE;

UPDATE public.event_types SET unit_id = (SELECT id FROM public.units WHERE slug = 'pinheiros')
  WHERE unit_id IS NULL;

ALTER TABLE public.event_types ALTER COLUMN unit_id SET NOT NULL;

ALTER TABLE public.event_types DROP CONSTRAINT IF EXISTS event_types_name_key;
ALTER TABLE public.event_types ADD CONSTRAINT event_types_name_unit_key UNIQUE (name, unit_id);

CREATE INDEX IF NOT EXISTS idx_event_types_unit_id ON public.event_types(unit_id);

-- 5b. packages
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE;

UPDATE public.packages SET unit_id = (SELECT id FROM public.units WHERE slug = 'pinheiros')
  WHERE unit_id IS NULL;

ALTER TABLE public.packages ALTER COLUMN unit_id SET NOT NULL;

ALTER TABLE public.packages DROP CONSTRAINT IF EXISTS packages_name_key;
ALTER TABLE public.packages ADD CONSTRAINT packages_name_unit_key UNIQUE (name, unit_id);

CREATE INDEX IF NOT EXISTS idx_packages_unit_id ON public.packages(unit_id);

-- 5c. venues
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE;

UPDATE public.venues SET unit_id = (SELECT id FROM public.units WHERE slug = 'pinheiros')
  WHERE unit_id IS NULL;

ALTER TABLE public.venues ALTER COLUMN unit_id SET NOT NULL;

ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_name_key;
ALTER TABLE public.venues ADD CONSTRAINT venues_name_unit_key UNIQUE (name, unit_id);

CREATE INDEX IF NOT EXISTS idx_venues_unit_id ON public.venues(unit_id);

-- 5d. checklist_categories
ALTER TABLE public.checklist_categories
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE;

UPDATE public.checklist_categories SET unit_id = (SELECT id FROM public.units WHERE slug = 'pinheiros')
  WHERE unit_id IS NULL;

ALTER TABLE public.checklist_categories ALTER COLUMN unit_id SET NOT NULL;

ALTER TABLE public.checklist_categories DROP CONSTRAINT IF EXISTS checklist_categories_name_key;
ALTER TABLE public.checklist_categories ADD CONSTRAINT checklist_categories_name_unit_key UNIQUE (name, unit_id);

CREATE INDEX IF NOT EXISTS idx_checklist_categories_unit_id ON public.checklist_categories(unit_id);

-- 5e. sectors
ALTER TABLE public.sectors
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE;

UPDATE public.sectors SET unit_id = (SELECT id FROM public.units WHERE slug = 'pinheiros')
  WHERE unit_id IS NULL;

ALTER TABLE public.sectors ALTER COLUMN unit_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sectors_unit_id ON public.sectors(unit_id);

-- ============================================================
-- 6. user_permissions — adicionar unit_id (nullable = global)
-- ============================================================
ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE;

-- Remover old UNIQUE e criar novo incluindo unit_id
ALTER TABLE public.user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_user_id_module_action_key;

ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_user_unit_module_action_key
  UNIQUE (user_id, unit_id, module, action);

UPDATE public.user_permissions
  SET unit_id = (SELECT id FROM public.units WHERE slug = 'pinheiros')
  WHERE unit_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_permissions_unit_id ON public.user_permissions(unit_id);

-- ============================================================
-- 7. VINCULAR super_admin à unidade padrão
-- ============================================================
INSERT INTO public.user_units (user_id, unit_id, role, is_default)
SELECT
  u.id,
  un.id,
  'super_admin',
  TRUE
FROM public.users u
CROSS JOIN public.units un
WHERE u.email = 'admin@cacholaos.com.br'
  AND un.slug  = 'pinheiros'
ON CONFLICT (user_id, unit_id) DO NOTHING;

-- ============================================================
-- 8. FUNÇÕES RLS AUXILIARES
-- ============================================================

-- Retorna array de unit_ids que o usuário autenticado pode acessar
CREATE OR REPLACE FUNCTION public.get_user_unit_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT unit_id
    FROM public.user_units
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Retorna true se o usuário é super_admin ou diretor em QUALQUER unidade
-- (visão consolidada — vê dados de todas as unidades)
CREATE OR REPLACE FUNCTION public.is_global_viewer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_units
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'diretor')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 9. ATUALIZAR POLÍTICAS RLS COM FILTRO DE UNIDADE
-- ============================================================

-- ──────────────── events ────────────────
DROP POLICY IF EXISTS "events: view"   ON public.events;
DROP POLICY IF EXISTS "events: create" ON public.events;
DROP POLICY IF EXISTS "events: update" ON public.events;
DROP POLICY IF EXISTS "events: delete" ON public.events;

CREATE POLICY "events: view"
  ON public.events FOR SELECT
  USING (
    (
      check_permission(auth.uid(), 'events', 'view')
      OR created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.event_staff
        WHERE event_id = events.id AND user_id = auth.uid()
      )
    )
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "events: create"
  ON public.events FOR INSERT
  WITH CHECK (
    check_permission(auth.uid(), 'events', 'create')
    AND unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "events: update"
  ON public.events FOR UPDATE
  USING (
    check_permission(auth.uid(), 'events', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "events: delete"
  ON public.events FOR DELETE
  USING (
    check_permission(auth.uid(), 'events', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- ──────────────── event_staff ────────────────
DROP POLICY IF EXISTS "event_staff: view"   ON public.event_staff;
DROP POLICY IF EXISTS "event_staff: manage" ON public.event_staff;

CREATE POLICY "event_staff: view"
  ON public.event_staff FOR SELECT
  USING (
    check_permission(auth.uid(), 'events', 'view')
    OR user_id = auth.uid()
  );

CREATE POLICY "event_staff: manage"
  ON public.event_staff FOR ALL
  USING (check_permission(auth.uid(), 'events', 'edit'));

-- ──────────────── checklists ────────────────
DROP POLICY IF EXISTS "checklists: view"   ON public.checklists;
DROP POLICY IF EXISTS "checklists: create" ON public.checklists;
DROP POLICY IF EXISTS "checklists: update" ON public.checklists;
DROP POLICY IF EXISTS "checklists: delete" ON public.checklists;

CREATE POLICY "checklists: view"
  ON public.checklists FOR SELECT
  USING (
    (
      check_permission(auth.uid(), 'checklists', 'view')
      OR assigned_to = auth.uid()
    )
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "checklists: create"
  ON public.checklists FOR INSERT
  WITH CHECK (
    check_permission(auth.uid(), 'checklists', 'create')
    AND unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "checklists: update"
  ON public.checklists FOR UPDATE
  USING (
    (
      check_permission(auth.uid(), 'checklists', 'edit')
      OR assigned_to = auth.uid()
    )
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "checklists: delete"
  ON public.checklists FOR DELETE
  USING (
    check_permission(auth.uid(), 'checklists', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- ──────────────── checklist_templates ────────────────
DROP POLICY IF EXISTS "checklist_templates: view"   ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates: manage" ON public.checklist_templates;

CREATE POLICY "checklist_templates: view"
  ON public.checklist_templates FOR SELECT
  USING (
    check_permission(auth.uid(), 'checklists', 'view')
    AND is_active = TRUE
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "checklist_templates: manage"
  ON public.checklist_templates FOR ALL
  USING (
    check_permission(auth.uid(), 'checklists', 'create')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- ──────────────── maintenance_orders ────────────────
DROP POLICY IF EXISTS "maintenance: view"   ON public.maintenance_orders;
DROP POLICY IF EXISTS "maintenance: create" ON public.maintenance_orders;
DROP POLICY IF EXISTS "maintenance: update" ON public.maintenance_orders;
DROP POLICY IF EXISTS "maintenance: delete" ON public.maintenance_orders;

CREATE POLICY "maintenance: view"
  ON public.maintenance_orders FOR SELECT
  USING (
    (
      check_permission(auth.uid(), 'maintenance', 'view')
      OR assigned_to = auth.uid()
      OR created_by = auth.uid()
    )
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "maintenance: create"
  ON public.maintenance_orders FOR INSERT
  WITH CHECK (
    check_permission(auth.uid(), 'maintenance', 'create')
    AND unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "maintenance: update"
  ON public.maintenance_orders FOR UPDATE
  USING (
    (
      check_permission(auth.uid(), 'maintenance', 'edit')
      OR assigned_to = auth.uid()
    )
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "maintenance: delete"
  ON public.maintenance_orders FOR DELETE
  USING (
    check_permission(auth.uid(), 'maintenance', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- ──────────────── config tables (event_types, packages, venues, sectors, checklist_categories) ────────────────

DROP POLICY IF EXISTS "event_types: view"   ON public.event_types;
DROP POLICY IF EXISTS "event_types: create" ON public.event_types;
DROP POLICY IF EXISTS "event_types: update" ON public.event_types;
DROP POLICY IF EXISTS "event_types: delete" ON public.event_types;

CREATE POLICY "event_types: view"
  ON public.event_types FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "event_types: create"
  ON public.event_types FOR INSERT
  WITH CHECK (
    check_permission(auth.uid(), 'settings', 'edit')
    AND unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "event_types: update"
  ON public.event_types FOR UPDATE
  USING (
    check_permission(auth.uid(), 'settings', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "event_types: delete"
  ON public.event_types FOR DELETE
  USING (
    check_permission(auth.uid(), 'settings', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- packages
DROP POLICY IF EXISTS "packages: view"   ON public.packages;
DROP POLICY IF EXISTS "packages: create" ON public.packages;
DROP POLICY IF EXISTS "packages: update" ON public.packages;
DROP POLICY IF EXISTS "packages: delete" ON public.packages;

CREATE POLICY "packages: view"
  ON public.packages FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "packages: create"
  ON public.packages FOR INSERT
  WITH CHECK (
    check_permission(auth.uid(), 'settings', 'edit')
    AND unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "packages: update"
  ON public.packages FOR UPDATE
  USING (
    check_permission(auth.uid(), 'settings', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "packages: delete"
  ON public.packages FOR DELETE
  USING (
    check_permission(auth.uid(), 'settings', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- venues
DROP POLICY IF EXISTS "venues: view"   ON public.venues;
DROP POLICY IF EXISTS "venues: create" ON public.venues;
DROP POLICY IF EXISTS "venues: update" ON public.venues;
DROP POLICY IF EXISTS "venues: delete" ON public.venues;

CREATE POLICY "venues: view"
  ON public.venues FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "venues: create"
  ON public.venues FOR INSERT
  WITH CHECK (
    check_permission(auth.uid(), 'settings', 'edit')
    AND unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "venues: update"
  ON public.venues FOR UPDATE
  USING (
    check_permission(auth.uid(), 'settings', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "venues: delete"
  ON public.venues FOR DELETE
  USING (
    check_permission(auth.uid(), 'settings', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- checklist_categories
DROP POLICY IF EXISTS "checklist_categories: view"   ON public.checklist_categories;
DROP POLICY IF EXISTS "checklist_categories: create" ON public.checklist_categories;
DROP POLICY IF EXISTS "checklist_categories: update" ON public.checklist_categories;
DROP POLICY IF EXISTS "checklist_categories: delete" ON public.checklist_categories;

CREATE POLICY "checklist_categories: view"
  ON public.checklist_categories FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "checklist_categories: create"
  ON public.checklist_categories FOR INSERT
  WITH CHECK (
    check_permission(auth.uid(), 'settings', 'edit')
    AND unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "checklist_categories: update"
  ON public.checklist_categories FOR UPDATE
  USING (
    check_permission(auth.uid(), 'settings', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "checklist_categories: delete"
  ON public.checklist_categories FOR DELETE
  USING (
    check_permission(auth.uid(), 'settings', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- sectors
DROP POLICY IF EXISTS "sectors: view"   ON public.sectors;
DROP POLICY IF EXISTS "sectors: manage" ON public.sectors;

CREATE POLICY "sectors: view"
  ON public.sectors FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "sectors: manage"
  ON public.sectors FOR ALL
  USING (
    check_permission(auth.uid(), 'settings', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
