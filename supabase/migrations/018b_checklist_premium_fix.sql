-- =============================================================================
-- Migration 018b: Checklist Premium — Correções e complementos da 018
--
-- Diferenças resolvidas entre 018 e o spec do Prompt 1:
--   1. checklist_items: + priority, + actual_minutes; RENAME due_date → due_at
--   2. checklist_recurrence: DROP (JSONB rule) → RECREATE com colunas explícitas
--      (frequency, day_of_week[], day_of_month, time_of_day, next_generation_at,
--       title_prefix, description, assigned_to)
--   3. checklist_item_comments: DROP (sem unit_id/photo_url) → RECREATE com spec correto
--   4. Storage bucket: checklist-comment-photos
--   5. Seed data para desenvolvimento
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. checklist_items — coluna due_date → due_at + priority + actual_minutes
-- ---------------------------------------------------------------------------

-- Renomear due_date para due_at (itens têm prazo próprio diferente do checklist.due_date)
ALTER TABLE public.checklist_items
  RENAME COLUMN due_date TO due_at;

-- Prioridade individual por item (o índice de status já existe, este é novo)
ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Tempo real gasto em minutos (preenchido ao concluir o item)
ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS actual_minutes INTEGER CHECK (actual_minutes > 0);

-- Atualizar índice de due_at (o anterior idx_checklist_items_due_date está obsoleto)
DROP INDEX IF EXISTS public.idx_checklist_items_due_date;

CREATE INDEX IF NOT EXISTS idx_checklist_items_due_at
  ON public.checklist_items(due_at)
  WHERE due_at IS NOT NULL AND status = 'pending';

-- ---------------------------------------------------------------------------
-- 2. checklist_recurrence — DROP e RECREATE com colunas explícitas
--    (a tabela foi criada com JSONB rule na 018 — sem dados ainda)
-- ---------------------------------------------------------------------------

-- Remover FK em checklists antes de dropar a tabela
ALTER TABLE public.checklists DROP COLUMN IF EXISTS recurrence_id;

-- Remover tabela da publicação realtime se estiver lá
DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.checklist_recurrence';
EXCEPTION WHEN others THEN
  NULL; -- ignora se não estava na publicação
END $$;

DROP TABLE IF EXISTS public.checklist_recurrence CASCADE;

CREATE TABLE public.checklist_recurrence (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id          UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  unit_id              UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,

  -- Regra de recorrência (colunas explícitas — melhor para queries e índices)
  frequency            TEXT NOT NULL
    CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  day_of_week          INTEGER[],    -- 0=dom…6=sáb (weekly/biweekly)
  day_of_month         INTEGER,      -- 1-31 (monthly)
  time_of_day          TIME NOT NULL DEFAULT '08:00:00',

  -- Responsável padrão para os checklists gerados
  assigned_to          UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Controle de geração
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  last_generated_at    TIMESTAMPTZ,
  next_generation_at   TIMESTAMPTZ,

  -- Metadados do checklist gerado
  title_prefix         TEXT,         -- ex: "Limpeza Semanal — "
  description          TEXT,

  -- Auditoria
  created_by           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_checklist_recurrence_updated_at
  BEFORE UPDATE ON public.checklist_recurrence
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_checklist_recurrence_unit_id
  ON public.checklist_recurrence(unit_id);

CREATE INDEX IF NOT EXISTS idx_checklist_recurrence_template_id
  ON public.checklist_recurrence(template_id);

CREATE INDEX IF NOT EXISTS idx_checklist_recurrence_next_gen
  ON public.checklist_recurrence(next_generation_at)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_checklist_recurrence_active
  ON public.checklist_recurrence(is_active)
  WHERE is_active = TRUE;

-- RLS
ALTER TABLE public.checklist_recurrence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_recurrence: view" ON public.checklist_recurrence
  FOR SELECT USING (
    check_permission(auth.uid(), 'checklists', 'view')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "checklist_recurrence: manage" ON public.checklist_recurrence
  FOR ALL USING (
    check_permission(auth.uid(), 'checklists', 'create')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- Recriar FK em checklists → checklist_recurrence
ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS recurrence_id UUID
    REFERENCES public.checklist_recurrence(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_checklists_recurrence_id
  ON public.checklists(recurrence_id);

-- ---------------------------------------------------------------------------
-- 3. checklist_item_comments — DROP e RECREATE com spec correto
--    (unit_id direto, photo_url, coluna content em vez de body)
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS public.checklist_item_comments CASCADE;

CREATE TABLE public.checklist_item_comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id     UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (LENGTH(TRIM(content)) > 0),
  photo_url   TEXT,                   -- foto de evidência opcional
  unit_id     UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_checklist_item_comments_updated_at
  BEFORE UPDATE ON public.checklist_item_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_checklist_item_comments_item_id
  ON public.checklist_item_comments(item_id);

CREATE INDEX IF NOT EXISTS idx_checklist_item_comments_user_id
  ON public.checklist_item_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_checklist_item_comments_unit_id
  ON public.checklist_item_comments(unit_id);

-- RLS
ALTER TABLE public.checklist_item_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_item_comments: view" ON public.checklist_item_comments
  FOR SELECT USING (
    check_permission(auth.uid(), 'checklists', 'view')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "checklist_item_comments: create" ON public.checklist_item_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND check_permission(auth.uid(), 'checklists', 'view')
    AND unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "checklist_item_comments: own" ON public.checklist_item_comments
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "checklist_item_comments: manage" ON public.checklist_item_comments
  FOR DELETE USING (
    check_permission(auth.uid(), 'checklists', 'delete')
  );

-- Realtime para comentários
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_item_comments;

-- ---------------------------------------------------------------------------
-- 4. Storage bucket: checklist-comment-photos
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'checklist-comment-photos',
  'checklist-comment-photos',
  FALSE,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "checklist_comment_photos_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'checklist-comment-photos' AND auth.role() = 'authenticated'
  );

CREATE POLICY "checklist_comment_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'checklist-comment-photos' AND auth.role() = 'authenticated'
  );

CREATE POLICY "checklist_comment_photos_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'checklist-comment-photos' AND auth.role() = 'authenticated'
  );

CREATE POLICY "checklist_comment_photos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'checklist-comment-photos' AND auth.role() = 'authenticated'
  );

-- ---------------------------------------------------------------------------
-- 5. Seed data para desenvolvimento
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_unit_id       UUID := '61b94ee5-ed89-4671-baf0-3475f7cdaf0f'; -- Pinheiros
  v_admin_id      UUID;
  v_checklist_id  UUID;
  v_item1_id      UUID;
  v_template_id   UUID;
BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE role = 'super_admin' LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'Nenhum super_admin encontrado — seed de checklists premium pulado.';
    RETURN;
  END IF;

  -- 1. Checklist avulso (standalone)
  INSERT INTO public.checklists (
    title, type, description, priority, assigned_to, status, unit_id, created_by
  ) VALUES (
    'Verificação Semanal de Segurança',
    'standalone',
    'Checklist de verificação de equipamentos de segurança e extintores',
    'high',
    v_admin_id,
    'pending',
    v_unit_id,
    v_admin_id
  )
  RETURNING id INTO v_checklist_id;

  -- 2. Itens com prioridades variadas
  INSERT INTO public.checklist_items
    (checklist_id, description, priority, due_at, estimated_minutes, sort_order, status)
  VALUES
    (v_checklist_id, 'Verificar extintores (validade e pressão)', 'urgent', NOW() + INTERVAL '2 days', 15, 1, 'pending'),
    (v_checklist_id, 'Testar saídas de emergência',               'high',   NOW() + INTERVAL '3 days', 20, 2, 'pending'),
    (v_checklist_id, 'Inspecionar brinquedos infláveis',          'high',   NOW() + INTERVAL '3 days', 30, 3, 'pending'),
    (v_checklist_id, 'Verificar kit de primeiros socorros',       'medium', NOW() + INTERVAL '5 days', 10, 4, 'pending'),
    (v_checklist_id, 'Checar câmeras de segurança',               'low',    NOW() + INTERVAL '7 days', 10, 5, 'pending')
  ;

  -- Pegar o ID do primeiro item (extintores)
  SELECT id INTO v_item1_id
  FROM public.checklist_items
  WHERE checklist_id = v_checklist_id
  ORDER BY sort_order
  LIMIT 1;

  -- 3. Comentário de exemplo no primeiro item
  INSERT INTO public.checklist_item_comments (item_id, user_id, content, unit_id)
  VALUES (
    v_item1_id,
    v_admin_id,
    'Extintor do salão principal vence mês que vem. Agendar recarga.',
    v_unit_id
  );

  -- 4. Regra de recorrência vinculada ao template existente
  SELECT id INTO v_template_id
  FROM public.checklist_templates
  WHERE unit_id = v_unit_id AND is_active = TRUE
  LIMIT 1;

  IF v_template_id IS NOT NULL THEN
    INSERT INTO public.checklist_recurrence (
      template_id, unit_id, frequency, day_of_week, time_of_day,
      assigned_to, is_active, title_prefix, description,
      created_by, next_generation_at
    ) VALUES (
      v_template_id,
      v_unit_id,
      'weekly',
      ARRAY[1, 5],       -- segunda e sexta
      '08:00:00',
      v_admin_id,
      TRUE,
      'Limpeza Semanal — ',
      'Checklist de limpeza geral gerado automaticamente toda segunda e sexta',
      v_admin_id,
      (NOW() + INTERVAL '1 day')::DATE + '08:00:00'::TIME
    );
  END IF;

  RAISE NOTICE 'Seed de checklists premium concluído! checklist_id=%', v_checklist_id;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Comentários de documentação
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.checklist_recurrence.frequency IS
  'daily | weekly | biweekly | monthly';
COMMENT ON COLUMN public.checklist_recurrence.day_of_week IS
  'Array de inteiros 0=dom…6=sáb. Usado para weekly/biweekly.';
COMMENT ON COLUMN public.checklist_recurrence.next_generation_at IS
  'Próxima execução do cron que gera o checklist. Atualizado após cada geração.';
COMMENT ON COLUMN public.checklist_item_comments.photo_url IS
  'Storage path em checklist-comment-photos (privado). Usar signed URL para exibição.';
