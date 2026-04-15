-- ============================================================
-- Cachola OS — Migration 044: Módulo Atas de Reunião
-- ============================================================
-- Cria as tabelas meeting_minutes, meeting_participants e
-- meeting_action_items com RLS especial (visibilidade por
-- criador + participante + roles elevadas).
--
-- Destaques:
--   - Função auxiliar can_view_meeting() SECURITY DEFINER para
--     evitar dependência circular de RLS entre tabelas filhas
--     e a tabela pai (meeting_minutes).
--   - is_global_viewer() cobre super_admin e diretor.
--   - Gerente verificado via user_units.role explicitamente.
-- ============================================================

-- ============================================================
-- 1. TABELAS
-- ============================================================

-- 1.1 meeting_minutes — a ata em si
CREATE TABLE public.meeting_minutes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  meeting_date  TIMESTAMPTZ NOT NULL,
  location      TEXT,
  summary       TEXT,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published')),
  created_by    UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_meeting_minutes_updated_at
  BEFORE UPDATE ON public.meeting_minutes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_meeting_minutes_unit_id    ON public.meeting_minutes(unit_id);
CREATE INDEX idx_meeting_minutes_created_by ON public.meeting_minutes(created_by);
CREATE INDEX idx_meeting_minutes_meeting_date ON public.meeting_minutes(meeting_date DESC);
CREATE INDEX idx_meeting_minutes_status     ON public.meeting_minutes(status);
CREATE INDEX idx_meeting_minutes_fts        ON public.meeting_minutes
  USING GIN (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(notes, '')));

-- 1.2 meeting_participants — participantes da ata
CREATE TABLE public.meeting_participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  UUID NOT NULL REFERENCES public.meeting_minutes(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'participant'
              CHECK (role IN ('organizer', 'participant', 'absent')),
  notified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (meeting_id, user_id)
);

CREATE TRIGGER set_meeting_participants_updated_at
  BEFORE UPDATE ON public.meeting_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_meeting_participants_meeting_id ON public.meeting_participants(meeting_id);
CREATE INDEX idx_meeting_participants_user_id    ON public.meeting_participants(user_id);

-- 1.3 meeting_action_items — itens de ação da ata
CREATE TABLE public.meeting_action_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id   UUID NOT NULL REFERENCES public.meeting_minutes(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  assigned_to  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  due_date     DATE,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'in_progress', 'done')),
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_meeting_action_items_updated_at
  BEFORE UPDATE ON public.meeting_action_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_meeting_action_items_meeting_id  ON public.meeting_action_items(meeting_id);
CREATE INDEX idx_meeting_action_items_assigned_to ON public.meeting_action_items(assigned_to);
CREATE INDEX idx_meeting_action_items_status      ON public.meeting_action_items(status);

-- ============================================================
-- 2. FUNÇÃO AUXILIAR — evita dependência circular de RLS
-- ============================================================
-- As tabelas filhas (participants, action_items) precisam verificar
-- se o usuário pode ver a ata pai, mas não podem referenciar
-- meeting_minutes via SELECT normal (pois o RLS da tabela pai
-- filtraria o resultado, criando recursão).
-- Solução: função SECURITY DEFINER que lê meeting_minutes
-- bypassando RLS e verifica as condições de visibilidade diretamente.

CREATE OR REPLACE FUNCTION public.can_view_meeting(p_meeting_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meeting_minutes mm
    WHERE mm.id = p_meeting_id
      AND (
        -- Criador sempre pode ver
        mm.created_by = auth.uid()
        -- Participante pode ver
        OR EXISTS (
          SELECT 1
          FROM public.meeting_participants mp
          WHERE mp.meeting_id = mm.id
            AND mp.user_id = auth.uid()
        )
        -- super_admin e diretor veem tudo (is_global_viewer)
        OR is_global_viewer()
        -- Gerente da unidade da ata também vê tudo
        OR EXISTS (
          SELECT 1
          FROM public.user_units uu
          WHERE uu.user_id  = auth.uid()
            AND uu.unit_id  = mm.unit_id
            AND uu.role     = 'gerente'
        )
      )
  );
$$;

-- ============================================================
-- 3. RLS
-- ============================================================

ALTER TABLE public.meeting_minutes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;

-- ── 3.1 meeting_minutes ──────────────────────────────────────

-- SELECT: visibilidade especial (criador | participante | elevated role)
CREATE POLICY "meeting_minutes_select" ON public.meeting_minutes
  FOR SELECT TO authenticated
  USING (
    -- Acesso à unidade
    (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
    -- Visibilidade da ata em si
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.meeting_participants mp
        WHERE mp.meeting_id = meeting_minutes.id
          AND mp.user_id = auth.uid()
      )
      OR is_global_viewer()
      OR EXISTS (
        SELECT 1 FROM public.user_units uu
        WHERE uu.user_id = auth.uid()
          AND uu.unit_id = meeting_minutes.unit_id
          AND uu.role    = 'gerente'
      )
    )
  );

-- INSERT: usuário com permissão de criação na unidade
CREATE POLICY "meeting_minutes_insert" ON public.meeting_minutes
  FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'minutes', 'create')
    AND unit_id = ANY(get_user_unit_ids())
    AND created_by = auth.uid()
  );

-- UPDATE: criador ou role elevada
CREATE POLICY "meeting_minutes_update" ON public.meeting_minutes
  FOR UPDATE TO authenticated
  USING (
    (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
    AND (
      created_by = auth.uid()
      OR is_global_viewer()
      OR EXISTS (
        SELECT 1 FROM public.user_units uu
        WHERE uu.user_id = auth.uid()
          AND uu.unit_id = meeting_minutes.unit_id
          AND uu.role    = 'gerente'
      )
    )
  )
  WITH CHECK (
    unit_id = ANY(get_user_unit_ids())
  );

-- DELETE: criador ou role elevada
CREATE POLICY "meeting_minutes_delete" ON public.meeting_minutes
  FOR DELETE TO authenticated
  USING (
    (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
    AND (
      created_by = auth.uid()
      OR is_global_viewer()
      OR EXISTS (
        SELECT 1 FROM public.user_units uu
        WHERE uu.user_id = auth.uid()
          AND uu.unit_id = meeting_minutes.unit_id
          AND uu.role    = 'gerente'
      )
    )
  );

-- ── 3.2 meeting_participants ──────────────────────────────────

-- SELECT: quem pode ver a ata pode ver os participantes
CREATE POLICY "meeting_participants_select" ON public.meeting_participants
  FOR SELECT TO authenticated
  USING (
    can_view_meeting(meeting_id)
  );

-- INSERT/UPDATE/DELETE: quem pode editar a ata (criador ou role elevada)
CREATE POLICY "meeting_participants_insert" ON public.meeting_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND uu.role    = 'gerente'
          )
        )
    )
  );

CREATE POLICY "meeting_participants_update" ON public.meeting_participants
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND uu.role    = 'gerente'
          )
        )
    )
  );

CREATE POLICY "meeting_participants_delete" ON public.meeting_participants
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND uu.role    = 'gerente'
          )
        )
    )
  );

-- ── 3.3 meeting_action_items ──────────────────────────────────

-- SELECT: quem pode ver a ata pode ver os itens de ação
CREATE POLICY "meeting_action_items_select" ON public.meeting_action_items
  FOR SELECT TO authenticated
  USING (
    can_view_meeting(meeting_id)
  );

-- INSERT: quem pode editar a ata
CREATE POLICY "meeting_action_items_insert" ON public.meeting_action_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND uu.role    = 'gerente'
          )
        )
    )
  );

-- UPDATE: quem pode editar a ata OU é o responsável pelo item
CREATE POLICY "meeting_action_items_update" ON public.meeting_action_items
  FOR UPDATE TO authenticated
  USING (
    -- Responsável pode atualizar o status do próprio item
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND uu.role    = 'gerente'
          )
        )
    )
  );

-- DELETE: quem pode editar a ata
CREATE POLICY "meeting_action_items_delete" ON public.meeting_action_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_minutes mm
      WHERE mm.id = meeting_id
        AND (
          mm.created_by = auth.uid()
          OR is_global_viewer()
          OR EXISTS (
            SELECT 1 FROM public.user_units uu
            WHERE uu.user_id = auth.uid()
              AND uu.unit_id = mm.unit_id
              AND uu.role    = 'gerente'
          )
        )
    )
  );

-- ============================================================
-- 4. PERMISSÕES — adicionar módulo 'minutes'
-- ============================================================

-- 4.1 Expandir CHECK constraint de role_default_perms
ALTER TABLE public.role_default_perms
  DROP CONSTRAINT IF EXISTS role_default_perms_module_check;

ALTER TABLE public.role_default_perms
  ADD CONSTRAINT role_default_perms_module_check
  CHECK (module IN (
    'events', 'maintenance', 'checklists', 'users', 'reports',
    'audit_logs', 'notifications', 'settings', 'providers', 'minutes'
  ));

-- 4.2 Expandir CHECK constraint de user_permissions
ALTER TABLE public.user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_module_check;

ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_module_check
  CHECK (module IN (
    'events', 'maintenance', 'checklists', 'users', 'reports',
    'audit_logs', 'notifications', 'settings', 'providers', 'minutes'
  ));

-- 4.3 Permissões padrão por role para o módulo 'minutes'
-- Gestão completa: super_admin, diretor, gerente
INSERT INTO public.role_default_perms (role, module, action, granted) VALUES
  ('super_admin', 'minutes', 'view',   TRUE),
  ('super_admin', 'minutes', 'create', TRUE),
  ('super_admin', 'minutes', 'edit',   TRUE),
  ('super_admin', 'minutes', 'delete', TRUE),
  ('diretor',     'minutes', 'view',   TRUE),
  ('diretor',     'minutes', 'create', TRUE),
  ('diretor',     'minutes', 'edit',   TRUE),
  ('diretor',     'minutes', 'delete', TRUE),
  ('gerente',     'minutes', 'view',   TRUE),
  ('gerente',     'minutes', 'create', TRUE),
  ('gerente',     'minutes', 'edit',   TRUE),
  ('gerente',     'minutes', 'delete', TRUE)
ON CONFLICT (role, module, action) DO NOTHING;

-- Somente visualização para os demais roles
-- (RLS garante que só veem atas em que participam)
INSERT INTO public.role_default_perms (role, module, action, granted) VALUES
  ('vendedora',   'minutes', 'view', TRUE),
  ('decoracao',   'minutes', 'view', TRUE),
  ('manutencao',  'minutes', 'view', TRUE),
  ('financeiro',  'minutes', 'view', TRUE),
  ('rh',          'minutes', 'view', TRUE),
  ('freelancer',  'minutes', 'view', TRUE),
  ('entregador',  'minutes', 'view', TRUE)
ON CONFLICT (role, module, action) DO NOTHING;
