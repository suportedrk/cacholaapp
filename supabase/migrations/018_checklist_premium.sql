-- =============================================================================
-- Migration 018: Checklist Premium Schema
-- Expande o módulo de checklists para suporte a:
--   - Tipos (event / standalone / recurring)
--   - Recorrência com tabela dedicada (checklist_recurrence)
--   - Prioridade, descrição, completed_by, created_by, duplicated_from
--   - Items com assigned_to, due_date, estimated_minutes
--   - Templates com description, default_priority, recurrence_rule, estimated_duration_minutes
--   - Template items com default_priority, default_estimated_minutes, default_assigned_to,
--     notes_template, requires_photo, is_required
--   - Nova tabela: checklist_item_comments
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABELA: checklist_recurrence
--    Regras de recorrência desacopladas do checklist (N checklists : 1 regra)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checklist_recurrence (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id             UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  template_id         UUID REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
  rule                JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- rule shape: { frequency: 'daily'|'weekly'|'monthly', interval: int,
  --               days_of_week: int[], day_of_month: int,
  --               time_of_day: 'HH:MM', end_date: ISO, max_occurrences: int }
  next_due_date       TIMESTAMPTZ,
  last_generated_at   TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- trigger updated_at
CREATE TRIGGER set_checklist_recurrence_updated_at
  BEFORE UPDATE ON public.checklist_recurrence
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- 2. ALTER TABLE: checklists — novos campos
-- ---------------------------------------------------------------------------

-- tipo do checklist
ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'event'
    CHECK (type IN ('event', 'standalone', 'recurring'));

-- prioridade (alinhado com maintenance_orders)
ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- descrição livre
ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS description TEXT;

-- quem criou (registra criador independente de assigned_to)
ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- conclusão
ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- duplicação: aponta para o checklist de origem quando copiado de evento anterior
ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS duplicated_from UUID REFERENCES public.checklists(id) ON DELETE SET NULL;

-- FK para regra de recorrência (nulo quando type != 'recurring')
ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS recurrence_id UUID REFERENCES public.checklist_recurrence(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. ALTER TABLE: checklist_items — novos campos
-- ---------------------------------------------------------------------------

-- responsável pelo item (independente do responsável geral do checklist)
ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- prazo individual do item
ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- estimativa de tempo em minutos
ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER CHECK (estimated_minutes > 0);

-- ---------------------------------------------------------------------------
-- 4. ALTER TABLE: checklist_templates — novos campos
-- ---------------------------------------------------------------------------

ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER CHECK (estimated_duration_minutes > 0);

ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS default_priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (default_priority IN ('low', 'medium', 'high', 'urgent'));

-- regra de recorrência padrão para este template (JSONB — mesma shape de checklist_recurrence.rule)
ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS recurrence_rule JSONB;

-- ---------------------------------------------------------------------------
-- 5. ALTER TABLE: template_items — novos campos
-- ---------------------------------------------------------------------------

ALTER TABLE public.template_items
  ADD COLUMN IF NOT EXISTS default_estimated_minutes INTEGER CHECK (default_estimated_minutes > 0);

-- instrução padrão exibida como placeholder nas notas do item
ALTER TABLE public.template_items
  ADD COLUMN IF NOT EXISTS notes_template TEXT;

-- item obriga registro de foto ao concluir
ALTER TABLE public.template_items
  ADD COLUMN IF NOT EXISTS requires_photo BOOLEAN NOT NULL DEFAULT FALSE;

-- prioridade individual do item no template
ALTER TABLE public.template_items
  ADD COLUMN IF NOT EXISTS default_priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (default_priority IN ('low', 'medium', 'high', 'urgent'));

-- responsável padrão: role ou usuário específico (JSONB para flexibilidade)
-- shape: { type: 'role'|'user', value: 'manutencao'|'<uuid>' }
ALTER TABLE public.template_items
  ADD COLUMN IF NOT EXISTS default_assigned_to JSONB;

-- item é obrigatório para concluir o checklist
ALTER TABLE public.template_items
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- 6. NOVA TABELA: checklist_item_comments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checklist_item_comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id     UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (LENGTH(TRIM(body)) > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_checklist_item_comments_updated_at
  BEFORE UPDATE ON public.checklist_item_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- 7. INDEXES
-- ---------------------------------------------------------------------------

-- checklist_recurrence
CREATE INDEX IF NOT EXISTS idx_checklist_recurrence_unit_id
  ON public.checklist_recurrence(unit_id);

CREATE INDEX IF NOT EXISTS idx_checklist_recurrence_template_id
  ON public.checklist_recurrence(template_id);

CREATE INDEX IF NOT EXISTS idx_checklist_recurrence_next_due
  ON public.checklist_recurrence(next_due_date) WHERE is_active = TRUE;

-- checklists — novos campos consultados em filtros
CREATE INDEX IF NOT EXISTS idx_checklists_type
  ON public.checklists(type);

CREATE INDEX IF NOT EXISTS idx_checklists_priority
  ON public.checklists(priority);

CREATE INDEX IF NOT EXISTS idx_checklists_created_by
  ON public.checklists(created_by);

CREATE INDEX IF NOT EXISTS idx_checklists_recurrence_id
  ON public.checklists(recurrence_id);

CREATE INDEX IF NOT EXISTS idx_checklists_unit_type
  ON public.checklists(unit_id, type);

-- checklist_items — assign + due_date são críticos para "Minhas Tarefas" (Prompt 9)
CREATE INDEX IF NOT EXISTS idx_checklist_items_assigned_to
  ON public.checklist_items(assigned_to);

CREATE INDEX IF NOT EXISTS idx_checklist_items_due_date
  ON public.checklist_items(due_date);

CREATE INDEX IF NOT EXISTS idx_checklist_items_assigned_due
  ON public.checklist_items(assigned_to, due_date) WHERE assigned_to IS NOT NULL;

-- checklist_item_comments
CREATE INDEX IF NOT EXISTS idx_checklist_item_comments_item_id
  ON public.checklist_item_comments(item_id);

CREATE INDEX IF NOT EXISTS idx_checklist_item_comments_user_id
  ON public.checklist_item_comments(user_id);

-- ---------------------------------------------------------------------------
-- 8. RLS — checklist_recurrence
-- ---------------------------------------------------------------------------
ALTER TABLE public.checklist_recurrence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_recurrence: view" ON public.checklist_recurrence
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "checklist_recurrence: manage" ON public.checklist_recurrence
  FOR ALL USING (
    check_permission(auth.uid(), 'checklists', 'create')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- ---------------------------------------------------------------------------
-- 9. RLS — checklist_item_comments
--    Segue a mesma lógica de checklist_items: acesso via checklist pai
-- ---------------------------------------------------------------------------
ALTER TABLE public.checklist_item_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_item_comments: view" ON public.checklist_item_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.checklist_items ci
      JOIN public.checklists c ON c.id = ci.checklist_id
      WHERE ci.id = checklist_item_comments.item_id
        AND (
          check_permission(auth_user_id(), 'checklists', 'view')
          OR c.assigned_to = auth_user_id()
        )
    )
  );

-- qualquer usuário com acesso ao checklist pode comentar
CREATE POLICY "checklist_item_comments: create" ON public.checklist_item_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.checklist_items ci
      JOIN public.checklists c ON c.id = ci.checklist_id
      WHERE ci.id = checklist_item_comments.item_id
        AND (
          check_permission(auth_user_id(), 'checklists', 'view')
          OR c.assigned_to = auth_user_id()
        )
    )
  );

-- apenas o autor pode editar/deletar o próprio comentário
CREATE POLICY "checklist_item_comments: own" ON public.checklist_item_comments
  FOR ALL USING (user_id = auth.uid());

-- managers podem deletar qualquer comentário
CREATE POLICY "checklist_item_comments: manage" ON public.checklist_item_comments
  FOR DELETE USING (
    check_permission(auth.uid(), 'checklists', 'delete')
  );

-- ---------------------------------------------------------------------------
-- 10. GRANT REALTIME para a nova tabela (comentários em tempo real)
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_item_comments;

-- ---------------------------------------------------------------------------
-- 11. Comentários de documentação nas colunas críticas
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.checklists.type IS
  'Tipo: event (vinculado a evento), standalone (avulso), recurring (gerado por recorrência)';
COMMENT ON COLUMN public.checklists.recurrence_id IS
  'FK para checklist_recurrence — preenchido apenas quando type = recurring';
COMMENT ON COLUMN public.checklists.duplicated_from IS
  'UUID do checklist original quando criado via duplicação (Prompt 8)';
COMMENT ON COLUMN public.template_items.default_assigned_to IS
  'JSONB: { type: "role"|"user", value: "<role_name>"|"<user_uuid>" }';
COMMENT ON COLUMN public.checklist_recurrence.rule IS
  'JSONB: { frequency, interval, days_of_week, day_of_month, time_of_day, end_date, max_occurrences }';
